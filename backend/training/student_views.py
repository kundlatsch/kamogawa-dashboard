"""Endpoints for students: their routine, upcoming classes and check-ins.

A routine is only valid on its own day: students see today's drills, while
upcoming sessions expose just the date, time and kind (so a sparring day can be
announced without revealing the plan ahead of time).
"""
from datetime import timedelta

from django.db.models import F, Prefetch, Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import serializers, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from accounts.models import User
from accounts.permissions import IsGymMember
from accounts.serializers import PublicUserSerializer
from notifications.services import notify_injury_reported

from .checkins import checkin_deadline, checkin_open
from .models import Assignment, CheckIn, SessionBlock, TrainingSession
from .periodization import GymTimeline
from .serializers import DrillSerializer, MyCheckInSerializer

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


def checkin_state(session, user) -> dict:
    """Deadline, whether check-in is still open, and the student's own check-in (or null)."""
    mine = next((c for c in session.check_ins.all() if c.student_id == user.id), None)
    return {
        "deadline": checkin_deadline(session),
        "open": checkin_open(session),
        "mine": MyCheckInSerializer(mine).data if mine else None,
    }


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
        Prefetch("assignments", queryset=assignments, to_attr="my_assignments"),
        Prefetch("check_ins", queryset=CheckIn.objects.filter(student=user)),
    )
    data = []
    timeline = GymTimeline(user.gym)
    for session in sessions:
        item = SessionSummarySerializer(session).data
        item["objective"] = timeline.objective_for(session)
        item["checkin"] = checkin_state(session, user)
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
    ).prefetch_related(Prefetch("check_ins", queryset=CheckIn.objects.filter(student=request.user)))
    return Response(
        [
            {**SessionSummarySerializer(session).data, "checkin": checkin_state(session, request.user)}
            for session in sessions
        ]
    )


@api_view(["PUT", "DELETE"])
@permission_classes([IsGymMember])
def my_checkin(request, session_id):
    """Check in for a published class (PUT, with an optional pain report) or cancel it (DELETE).

    Both are only possible until the gym's deadline; after that only the coach can change it.
    """
    if request.user.role != User.Role.STUDENT:
        return Response(status=status.HTTP_403_FORBIDDEN)
    session = get_object_or_404(published_sessions(request.user), pk=session_id)
    if not checkin_open(session):
        raise ValidationError({"detail": "Check-in for this class is closed."})
    existing = CheckIn.objects.filter(session=session, student=request.user).first()
    if request.method == "DELETE":
        if existing:
            existing.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
    had_pain = bool(existing and existing.has_pain)
    serializer = MyCheckInSerializer(existing, data=request.data)
    serializer.is_valid(raise_exception=True)
    check_in = serializer.save(session=session, student=request.user)
    if check_in.has_pain and not had_pain:
        notify_injury_reported(check_in)
    return Response(serializer.data, status=status.HTTP_200_OK if existing else status.HTTP_201_CREATED)
