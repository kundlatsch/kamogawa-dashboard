"""Read-only endpoints for students.

A routine is only valid on its own day: students see today's drills, while
upcoming sessions expose just the date, time and kind (so a sparring day can be
announced without revealing the plan ahead of time).
"""
from datetime import timedelta

from django.db.models import F, Prefetch, Q
from django.utils import timezone
from rest_framework import serializers
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from accounts.models import User
from accounts.permissions import IsGymMember
from accounts.serializers import PublicUserSerializer

from .models import Assignment, SessionBlock, TrainingSession
from .periodization import GymTimeline
from .serializers import DrillSerializer

UPCOMING_DAYS = 30


class RoutineBlockSerializer(serializers.ModelSerializer):
    class Meta:
        model = SessionBlock
        fields = ["id", "name", "color", "mode", "start_offset_minutes", "order"]


class RoutineItemSerializer(serializers.ModelSerializer):
    drill = DrillSerializer(read_only=True)
    block = RoutineBlockSerializer(read_only=True)
    partners = serializers.SerializerMethodField()

    class Meta:
        model = Assignment
        fields = ["id", "drill", "block", "is_broadcast", "order", "notes", "rounds", "duration_minutes", "partners"]

    def get_partners(self, assignment):
        me = self.context["request"].user
        return PublicUserSerializer(
            [p for p in assignment.participants.all() if p.id != me.id], many=True
        ).data


class SessionSummarySerializer(serializers.ModelSerializer):
    class Meta:
        model = TrainingSession
        fields = ["id", "date", "start_time", "title", "notes", "kind"]


def published_sessions(user):
    return TrainingSession.objects.filter(gym=user.gym, status=TrainingSession.Status.PUBLISHED)


@api_view(["GET"])
@permission_classes([IsGymMember])
def my_routine(request):
    """Today's published sessions with the drills that apply to the current student."""
    today = timezone.localdate()
    user = request.user
    mine = Q(is_broadcast=True) | Q(participants=user)
    assignments = (
        Assignment.objects.filter(mine)
        .distinct()
        .select_related("drill", "block")
        .prefetch_related(Prefetch("participants", queryset=User.objects.filter(is_active=True)))
        # Blocks in class order; drills without a block (created before blocks existed) come last.
        .order_by(F("block__order").asc(nulls_last=True), "order", "id")
    )
    sessions = published_sessions(user).filter(date=today).prefetch_related(
        Prefetch("assignments", queryset=assignments, to_attr="my_assignments")
    )
    data = []
    timeline = GymTimeline(user.gym)
    for session in sessions:
        item = SessionSummarySerializer(session).data
        item["objective"] = timeline.objective_for(session)
        item["routine"] = RoutineItemSerializer(
            session.my_assignments, many=True, context={"request": request}
        ).data
        data.append(item)
    return Response({"date": today, "sessions": data})


@api_view(["GET"])
@permission_classes([IsGymMember])
def my_upcoming(request):
    today = timezone.localdate()
    sessions = published_sessions(request.user).filter(
        date__gt=today, date__lte=today + timedelta(days=UPCOMING_DAYS)
    )
    return Response(SessionSummarySerializer(sessions, many=True).data)
