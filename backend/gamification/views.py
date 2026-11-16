from django.db.models import Count, Q, Sum
from django.db.models.functions import Coalesce
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from accounts.models import User
from accounts.permissions import IsCoach, IsGymMember
from accounts.serializers import PublicUserSerializer
from training.cycle_views import ArchivableListViewSet
from training.views import GymScopedViewSet

from .models import FighterClass, Mission, MissionCompletion, XpEvent
from .serializers import (
    FighterClassSerializer,
    MissionCompletionSerializer,
    MissionSerializer,
    XpEventSerializer,
)
from .services import level_for, review_completion, total_xp


class FighterClassViewSet(ArchivableListViewSet):
    serializer_class = FighterClassSerializer
    model = FighterClass


class MissionViewSet(GymScopedViewSet):
    serializer_class = MissionSerializer

    def get_queryset(self):
        return Mission.objects.filter(gym=self.gym)


class MissionCompletionViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    """Coach review queue (`?status=PENDING`); approving grants the mission's XP."""

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


class XpEventViewSet(
    mixins.ListModelMixin, mixins.CreateModelMixin, mixins.DestroyModelMixin, viewsets.GenericViewSet
):
    """XP history (`?student=`); coaches grant or remove XP by hand. Only manual events can be deleted."""

    serializer_class = XpEventSerializer
    permission_classes = [IsCoach]

    def get_queryset(self):
        queryset = XpEvent.objects.filter(student__gym=self.request.user.gym).select_related(
            "session", "mission_completion__mission"
        )
        if "student" in self.request.query_params:
            queryset = queryset.filter(student_id=self.request.query_params["student"])
        return queryset

    def perform_create(self, serializer):
        serializer.save(reason=XpEvent.Reason.MANUAL, created_by=self.request.user)

    def perform_destroy(self, instance):
        if instance.reason != XpEvent.Reason.MANUAL:
            raise ValidationError("Attendance and mission XP follow attendance and mission reviews.")
        instance.delete()


@api_view(["GET"])
@permission_classes([IsCoach])
def leaderboard(request):
    """Every active student of the gym with XP, level and fighter class, highest XP first."""
    gym = request.user.gym
    pending = Q(mission_completions__status=MissionCompletion.Status.PENDING)
    students = (
        User.objects.filter(gym=gym, role=User.Role.STUDENT, is_active=True)
        .annotate(xp=Coalesce(Sum("xp_events__amount"), 0))
        .order_by("-xp", "display_name")
    )
    # Counted separately: joining both relations in one query would multiply the XP sum.
    pending_counts = dict(
        User.objects.filter(gym=gym, role=User.Role.STUDENT)
        .annotate(pending=Count("mission_completions", filter=pending))
        .values_list("id", "pending")
    )
    return Response(
        [
            {
                "student": PublicUserSerializer(student).data,
                "fighter_class": student.fighter_class_id,
                "pending_missions": pending_counts.get(student.id, 0),
                **level_for(student.xp, gym.xp_per_level),
            }
            for student in students
        ]
    )


def available_missions(user):
    today = timezone.localdate()
    return Mission.objects.filter(gym=user.gym, active=True).filter(
        Q(starts_on__isnull=True) | Q(starts_on__lte=today), Q(ends_on__isnull=True) | Q(ends_on__gte=today)
    )


@api_view(["GET"])
@permission_classes([IsGymMember])
def my_progress(request):
    """The student's XP, level, fighter class, recent XP events and available missions."""
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
    events = user.xp_events.select_related("session", "mission_completion__mission")[:20]
    return Response(
        {
            **level_for(total_xp(user), user.gym.xp_per_level),
            "attendance_xp": user.gym.attendance_xp,
            "fighter_class": FighterClassSerializer(user.fighter_class).data if user.fighter_class else None,
            "events": XpEventSerializer(events, many=True, context={"request": request}).data,
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
