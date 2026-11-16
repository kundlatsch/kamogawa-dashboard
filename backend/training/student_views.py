"""Endpoints for students: their routine, calendar, class details and check-ins.

Published classes show the student's drills, also ahead of time. Unpublished classes (and
regular weekdays without a session yet) only appear as "there will be a class" with its time.
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
from .models import Assignment, CheckIn, SessionBlock, TrainingSession, WeeklySchedule
from .periodization import GymTimeline
from .scheduling import generate_regular_sessions
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


def sessions_with_routine(user):
    """Published sessions with the student's drills (own and broadcast) and their check-in."""
    mine = Q(is_broadcast=True) | Q(participants=user)
    assignments = (
        Assignment.objects.filter(mine)
        .distinct()
        .select_related("drill", "block")
        .prefetch_related(Prefetch("participants", queryset=User.objects.filter(is_active=True)))
        # Blocks in class order; drills without a block (created before blocks existed) come last.
        .order_by(F("block__order").asc(nulls_last=True), "order", "id")
    )
    return published_sessions(user).prefetch_related(
        Prefetch("assignments", queryset=assignments, to_attr="my_assignments"),
        Prefetch("check_ins", queryset=CheckIn.objects.filter(student=user)),
    )


def session_detail(session, request, timeline) -> dict:
    item = SessionSummarySerializer(session).data
    item["objective"] = timeline.objective_for(session)
    item["checkin"] = checkin_state(session, request.user)
    item["routine"] = RoutineItemSerializer(session.my_assignments, many=True, context={"request": request}).data
    return item


@api_view(["GET"])
@permission_classes([IsGymMember])
def my_routine(request):
    """Today's published sessions with the drills that apply to the current student."""
    today = timezone.localdate()
    timeline = GymTimeline(request.user.gym)
    sessions = sessions_with_routine(request.user).filter(date=today)
    drafts = TrainingSession.objects.filter(
        gym=request.user.gym, date=today, status=TrainingSession.Status.DRAFT
    ).prefetch_related(Prefetch("check_ins", queryset=CheckIn.objects.filter(student=request.user)))
    return Response(
        {
            "date": today,
            "sessions": [session_detail(s, request, timeline) for s in sessions],
            # Not published yet: the student can check in, nothing else is shown.
            "drafts": [
                {"id": d.id, "date": d.date, "start_time": d.start_time, "checkin": checkin_state(d, request.user)}
                for d in drafts
            ],
        }
    )


@api_view(["GET"])
@permission_classes([IsGymMember])
def my_session(request, session_id):
    """One published class with the student's drills, also ahead of time (Gustavo, 2026-11-16)."""
    session = get_object_or_404(sessions_with_routine(request.user), pk=session_id)
    return Response(session_detail(session, request, GymTimeline(request.user.gym)))


CALENDAR_MAX_DAYS = 62


@api_view(["GET"])
@permission_classes([IsGymMember])
def my_calendar(request):
    """Classes between `?from=` and `?to=` for the student's calendar.

    Published classes come with their id, kind and title (they open with their drills). Draft
    classes (regular weekdays are created on the fly) carry only their time and the student's
    check-in, so nothing about their content leaks before the coach publishes. Cancelled classes
    show their reason.
    """
    from .views import parse_date

    today = timezone.localdate()
    start = parse_date(request.query_params.get("from", today.isoformat()), "from")
    end = parse_date(request.query_params.get("to", (today + timedelta(days=30)).isoformat()), "to")
    end = min(end, start + timedelta(days=CALENDAR_MAX_DAYS))
    gym = request.user.gym
    schedule = WeeklySchedule.for_gym(gym)
    # Regular classes exist ahead of time so students can check in before the coach plans them.
    generate_regular_sessions(gym, max(start, today), end)
    sessions = (
        TrainingSession.objects.filter(gym=gym, date__range=(start, end))
        .prefetch_related(Prefetch("check_ins", queryset=CheckIn.objects.filter(student=request.user)))
        .order_by("date", "start_time", "id")
    )
    days_with_sessions = set()
    entries = []
    for session in sessions:
        days_with_sessions.add(session.date)
        if session.status == TrainingSession.Status.PUBLISHED:
            entries.append(
                {
                    **SessionSummarySerializer(session).data,
                    "published": True,
                    "checkin": checkin_state(session, request.user),
                }
            )
        elif session.status == TrainingSession.Status.CANCELLED:
            entries.append(
                {
                    "id": session.id,
                    "date": session.date,
                    "start_time": session.start_time,
                    "published": False,
                    "cancelled": True,
                    "cancel_reason": session.cancel_reason,
                }
            )
        elif session.date >= today:
            # A draft: students may check in, but nothing about its content is shown.
            entries.append(
                {
                    "id": session.id,
                    "date": session.date,
                    "start_time": session.start_time,
                    "published": False,
                    "checkin": checkin_state(session, request.user),
                }
            )
    day = max(start, today)
    while day <= end:
        if day.weekday() in schedule.training_weekdays and day not in days_with_sessions:
            entries.append(
                {"id": None, "date": day, "start_time": schedule.start_time_for(day.weekday()), "published": False}
            )
        day += timedelta(days=1)
    entries.sort(key=lambda entry: (str(entry["date"]), str(entry["start_time"] or "")))
    return Response(entries)


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
    """Check in for a class (PUT, with an optional pain report) or cancel it (DELETE).

    Any class of the gym that is not cancelled, published or still a draft, until the gym's
    deadline; after that only the coach can change it.
    """
    if request.user.role != User.Role.STUDENT:
        return Response(status=status.HTTP_403_FORBIDDEN)
    session = get_object_or_404(TrainingSession.objects.filter(gym=request.user.gym), pk=session_id)
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
