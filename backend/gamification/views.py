from django.db.models import Count, Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.exceptions import ValidationError
from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response

from accounts.avatars import InvalidImage, process_badge
from accounts.models import User
from accounts.permissions import IsCoach, IsGymMember
from accounts.serializers import PublicUserSerializer
from training.cycle_views import ArchivableListViewSet
from training.models import CheckIn, TrainingSession
from training.views import GymScopedViewSet

from .models import FighterClass, Mission, MissionCompletion
from .serializers import FighterClassSerializer, MissionCompletionSerializer, MissionSerializer
from .services import review_completion


class FighterClassViewSet(ArchivableListViewSet):
    serializer_class = FighterClassSerializer
    model = FighterClass

    @action(detail=True, methods=["post", "delete"], parser_classes=[MultiPartParser])
    def image(self, request, pk=None):
        """Upload (multipart field `image`) or remove a custom picture for the class."""
        fighter_class = self.get_object()
        if request.method == "DELETE":
            if fighter_class.image:
                fighter_class.image.delete(save=True)
        else:
            upload = request.FILES.get("image")
            if upload is None:
                raise ValidationError({"image": "Send an image in the `image` field."})
            try:
                content = process_badge(upload)
            except InvalidImage as error:
                raise ValidationError({"image": str(error)})
            old = fighter_class.image.name if fighter_class.image else None
            fighter_class.image.save(content.name, content, save=True)
            if old:
                fighter_class.image.storage.delete(old)
        return Response(self.get_serializer(fighter_class).data)


class MissionViewSet(GymScopedViewSet):
    serializer_class = MissionSerializer

    def get_queryset(self):
        return Mission.objects.filter(gym=self.gym)


class MissionCompletionViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    """Coach review queue (`?status=PENDING`) of missions students say they completed."""

    serializer_class = MissionCompletionSerializer
    permission_classes = [IsCoach]

    def get_queryset(self):
        gym = self.request.user.gym
        queryset = MissionCompletion.objects.filter(mission__gym=gym, student__gym=gym).select_related("mission")
        if "status" in self.request.query_params:
            queryset = queryset.filter(status=self.request.query_params["status"])
        return queryset

    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        return Response(self.get_serializer(review_completion(self.get_object(), request.user, True)).data)

    @action(detail=True, methods=["post"])
    def reject(self, request, pk=None):
        return Response(self.get_serializer(review_completion(self.get_object(), request.user, False)).data)


@api_view(["GET"])
@permission_classes([IsCoach])
def leaderboard(request):
    """Every active student with fighter class, attendance and missions (the UI sorts the ranking)."""
    return Response(ranking_rows(request.user.gym, include_pending=True))


@api_view(["GET"])
@permission_classes([IsGymMember])
def ranking(request):
    """Read-only ranking for students: the same rows without the coach's review queue."""
    return Response(ranking_rows(request.user.gym, include_pending=False))


def ranking_rows(gym, include_pending: bool) -> list[dict]:
    statuses = MissionCompletion.Status
    students = (
        User.objects.filter(gym=gym, role=User.Role.STUDENT, is_active=True)
        .annotate(
            pending=Count("mission_completions", filter=Q(mission_completions__status=statuses.PENDING)),
            completed=Count("mission_completions", filter=Q(mission_completions__status=statuses.APPROVED)),
        )
        .order_by("display_name")
    )
    attendance = attendance_by_student(gym, students)
    rows = []
    for student in students:
        row = {
            "student": PublicUserSerializer(student).data,
            "fighter_class": student.fighter_class_id,
            "missions_completed": student.completed,
            **attendance[student.id],
        }
        if include_pending:
            row["pending_missions"] = student.pending
        rows.append(row)
    return rows


def attendance_by_student(gym, students) -> dict[int, dict]:
    """Classes attended and missed per student.

    Only classes where the coach took attendance (marked anyone as present or absent) count, and
    only from the day the student joined: missing such a class without being marked present is
    an absence, whether or not the student had checked in.
    """
    taken = list(
        TrainingSession.objects.filter(gym=gym, check_ins__attended__isnull=False).distinct().values_list("id", "date")
    )
    present = set(
        CheckIn.objects.filter(session__gym=gym, attended=True).values_list("student_id", "session_id")
    )
    result = {}
    for student in students:
        joined = timezone.localtime(student.date_joined).date()
        counted = [session_id for session_id, day in taken if day >= joined]
        attended = sum((student.id, session_id) in present for session_id in counted)
        result[student.id] = {"attended": attended, "absences": len(counted) - attended}
    return result


def available_missions(user):
    today = timezone.localdate()
    return Mission.objects.filter(gym=user.gym, active=True).filter(
        Q(starts_on__isnull=True) | Q(starts_on__lte=today), Q(ends_on__isnull=True) | Q(ends_on__gte=today)
    )


@api_view(["GET"])
@permission_classes([IsGymMember])
def my_progress(request):
    """The student's fighter class and the missions (weekly goals) they can work on."""
    user = request.user
    completions = list(MissionCompletion.objects.filter(student=user))
    missions = []
    for mission in available_missions(user):
        own = [c for c in completions if c.mission_id == mission.id]
        latest = own[0] if own else None
        can_complete = latest is None or (mission.repeatable and latest.status != MissionCompletion.Status.PENDING)
        missions.append(
            {
                **MissionSerializer(mission).data,
                "status": latest.status if latest else None,
                "times_completed": sum(c.status == MissionCompletion.Status.APPROVED for c in own),
                "can_complete": can_complete,
            }
        )
    return Response(
        {
            "fighter_class": FighterClassSerializer(user.fighter_class).data if user.fighter_class else None,
            "missions": missions,
        }
    )


@api_view(["POST"])
@permission_classes([IsGymMember])
def complete_mission(request, mission_id):
    """A student marks a mission as done; it then waits for the coach to approve it."""
    if request.user.role != User.Role.STUDENT:
        return Response(status=status.HTTP_403_FORBIDDEN)
    mission = get_object_or_404(available_missions(request.user), pk=mission_id)
    latest = MissionCompletion.objects.filter(mission=mission, student=request.user).first()
    if latest and (latest.status == MissionCompletion.Status.PENDING or not mission.repeatable):
        raise ValidationError({"detail": "This mission was already sent."})
    note = str(request.data.get("note", ""))[:300]
    completion = MissionCompletion.objects.create(mission=mission, student=request.user, note=note)
    return Response(MissionCompletionSerializer(completion).data, status=status.HTTP_201_CREATED)
