from datetime import date

from django.db import transaction
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from accounts.models import User
from accounts.permissions import IsCoach, IsCoachOrReadOnly
from notifications.services import notify_session_published

from .models import Assignment, CheckIn, Drill, DrillCategory, TrainingSession, WeeklySchedule
from .scheduling import apply_schedule_times, generate_regular_sessions
from .serializers import (
    AssignmentSerializer,
    CheckInSerializer,
    DrillCategorySerializer,
    DrillSerializer,
    TrainingSessionSerializer,
    WeeklyScheduleSerializer,
)


def parse_date(value, field):
    try:
        return date.fromisoformat(value)
    except (TypeError, ValueError):
        raise ValidationError({field: "Use the YYYY-MM-DD format."})


class GymScopedViewSet(viewsets.ModelViewSet):
    """Every query is limited to the requesting user's gym; new rows are created in it."""

    permission_classes = [IsCoach]

    @property
    def gym(self):
        return self.request.user.gym

    def perform_create(self, serializer):
        serializer.save(gym=self.gym)


class DrillCategoryViewSet(GymScopedViewSet):
    serializer_class = DrillCategorySerializer
    permission_classes = [IsCoachOrReadOnly]

    def get_queryset(self):
        return DrillCategory.objects.filter(gym=self.gym)


class DrillViewSet(GymScopedViewSet):
    """Drill library. Deleting archives the drill so past sessions keep their history."""

    serializer_class = DrillSerializer

    def get_queryset(self):
        queryset = Drill.objects.filter(gym=self.gym).select_related("category")
        if self.request.query_params.get("include_archived") != "true":
            queryset = queryset.filter(archived=False)
        return queryset

    def perform_create(self, serializer):
        serializer.save(gym=self.gym, created_by=self.request.user)

    def perform_destroy(self, instance):
        instance.archived = True
        instance.save(update_fields=["archived", "updated_at"])


class AssignmentViewSet(GymScopedViewSet):
    serializer_class = AssignmentSerializer

    def get_queryset(self):
        queryset = (
            Assignment.objects.filter(session__gym=self.gym)
            .select_related("drill", "drill__category")
            .prefetch_related("participants")
        )
        if "session" in self.request.query_params:
            queryset = queryset.filter(session_id=self.request.query_params["session"])
        return queryset

    def perform_create(self, serializer):
        serializer.save()  # the gym comes from the (gym-scoped) session

    def _student(self, request):
        try:
            return User.objects.get(
                pk=request.data.get("student"), gym=self.gym, role=User.Role.STUDENT, is_active=True
            )
        except (User.DoesNotExist, ValueError, TypeError):
            raise ValidationError({"student": "Unknown student."})

    @action(detail=True, methods=["post"], url_path="add-participant")
    def add_participant(self, request, pk=None):
        """Join a student to an existing drill (turns a solo drill into a pair or group)."""
        assignment = self.get_object()
        if assignment.is_broadcast:
            raise ValidationError("Broadcast assignments already include everyone.")
        assignment.participants.add(self._student(request))
        return Response(self.get_serializer(assignment).data)

    @action(detail=True, methods=["post"], url_path="remove-participant")
    def remove_participant(self, request, pk=None):
        """Remove a student; the assignment is deleted when nobody is left."""
        assignment = self.get_object()
        assignment.participants.remove(self._student(request))
        if not assignment.is_broadcast and not assignment.participants.exists():
            assignment.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
        return Response(self.get_serializer(assignment).data)

    @action(detail=False, methods=["post"])
    @transaction.atomic
    def reorder(self, request):
        """Set the routine order of a session: `{"session": id, "ids": [assignment ids in order]}`."""
        session_id = request.data.get("session")
        ids = request.data.get("ids")
        if not isinstance(ids, list):
            raise ValidationError({"ids": "Send the ordered list of assignment ids."})
        assignments = {a.id: a for a in self.get_queryset().filter(session_id=session_id)}
        if not assignments or set(ids) != set(assignments):
            raise ValidationError({"ids": "The list must contain every assignment of the session."})
        for position, assignment_id in enumerate(ids):
            assignments[assignment_id].order = position
        Assignment.objects.bulk_update(assignments.values(), ["order"])
        return Response(self.get_serializer(self.get_queryset().filter(session_id=session_id), many=True).data)


@api_view(["GET", "PUT"])
@permission_classes([IsCoach])
def weekly_schedule(request):
    schedule = WeeklySchedule.for_gym(request.user.gym)
    if request.method == "PUT":
        serializer = WeeklyScheduleSerializer(schedule, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        apply_schedule_times(request.user.gym, timezone.localdate())
    return Response(WeeklyScheduleSerializer(schedule).data)


class TrainingSessionViewSet(GymScopedViewSet):
    serializer_class = TrainingSessionSerializer

    def get_queryset(self):
        queryset = TrainingSession.objects.filter(gym=self.gym)
        params = self.request.query_params
        if "from" in params:
            queryset = queryset.filter(date__gte=parse_date(params["from"], "from"))
        if "to" in params:
            queryset = queryset.filter(date__lte=parse_date(params["to"], "to"))
        return queryset

    def perform_create(self, serializer):
        serializer.save(gym=self.gym, created_by=self.request.user)

    @action(detail=True, methods=["post"])
    def publish(self, request, pk=None):
        """Make the session visible to students."""
        session = self.get_object()
        if session.status != TrainingSession.Status.PUBLISHED:
            session.status = TrainingSession.Status.PUBLISHED
            session.published_at = timezone.now()
            session.save(update_fields=["status", "published_at"])
            notify_session_published(session)
        return Response(self.get_serializer(session).data)

    @action(detail=True, methods=["post"])
    def unpublish(self, request, pk=None):
        session = self.get_object()
        session.status = TrainingSession.Status.DRAFT
        session.save(update_fields=["status"])
        return Response(self.get_serializer(session).data)

    @action(detail=True, methods=["post"], url_path="convert")
    def convert(self, request, pk=None):
        """Turn a class into sparring (or back into a regular class), keeping its drills.

        Converting a published class to sparring sends the sparring alert right away.
        """
        session = self.get_object()
        kind = request.data.get("kind")
        if kind not in TrainingSession.Kind.values:
            raise ValidationError({"kind": "Unknown session kind."})
        session.kind = kind
        session.save(update_fields=["kind"])
        if kind == TrainingSession.Kind.SPARRING and session.status == TrainingSession.Status.PUBLISHED:
            notify_session_published(session)
        return Response(self.get_serializer(session).data)

    @action(detail=False, methods=["post"])
    def sparring(self, request):
        """Dedicated entry point for sparring sessions (students get a special alert on publish)."""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        # Sparring takes over the day: an untouched regular draft on that date is replaced.
        self.get_queryset().filter(
            date=serializer.validated_data["date"],
            kind=TrainingSession.Kind.REGULAR,
            status=TrainingSession.Status.DRAFT,
            assignments__isnull=True,
        ).delete()
        serializer.save(gym=self.gym, created_by=request.user, kind=TrainingSession.Kind.SPARRING)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=["post"])
    def generate(self, request):
        """Materialize regular sessions from the weekly schedule for a date range."""
        start = parse_date(request.data.get("from"), "from")
        end = parse_date(request.data.get("to"), "to")
        created = generate_regular_sessions(self.gym, start, end, created_by=request.user)
        return Response(
            TrainingSessionSerializer(created, many=True).data, status=status.HTTP_201_CREATED
        )


class CheckInViewSet(GymScopedViewSet):
    """Who is coming to a class (`?session=`), their pain reports, and attendance confirmation."""

    serializer_class = CheckInSerializer

    def get_queryset(self):
        queryset = CheckIn.objects.filter(session__gym=self.gym)
        if "session" in self.request.query_params:
            queryset = queryset.filter(session_id=self.request.query_params["session"])
        return queryset

    def perform_create(self, serializer):
        serializer.save(added_by_coach=True)
