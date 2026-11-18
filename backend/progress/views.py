from django.db.models import Q
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from accounts.permissions import IsCoach, IsGymMember
from training.cycle_views import ArchivableListViewSet
from training.views import GymScopedViewSet, parse_date

from .models import Assessment, CoachNote, FocusOption, Homework, Metric, WeeklyFocus, week_start
from .serializers import (
    AssessmentSerializer,
    CoachNoteSerializer,
    FocusOptionSerializer,
    HomeworkSerializer,
    MetricSerializer,
    SetAssessmentSerializer,
    SetWeeklyFocusSerializer,
    WeeklyFocusSerializer,
    month_start,
)


class MetricViewSet(ArchivableListViewSet):
    serializer_class = MetricSerializer
    model = Metric


def gym_assessments(gym):
    return Assessment.objects.filter(student__gym=gym, metric__gym=gym)


@api_view(["GET"])
@permission_classes([IsCoach])
def assessments(request):
    """Scores of the coach's gym; filter with `?period=` (any day of the month) and `?student=`."""
    queryset = gym_assessments(request.user.gym)
    params = request.query_params
    if "period" in params:
        queryset = queryset.filter(period=month_start(parse_date(params["period"], "period")))
    if "student" in params:
        queryset = queryset.filter(student_id=params["student"])
    return Response(AssessmentSerializer(queryset, many=True).data)


@api_view(["POST"])
@permission_classes([IsCoach])
def set_assessment(request):
    serializer = SetAssessmentSerializer(data=request.data, context={"request": request})
    serializer.is_valid(raise_exception=True)
    data = serializer.validated_data
    pair = {"student": data["student"], "metric": data["metric"]}
    if data["score"] is None:
        # Without a period, clearing removes the stat entirely (history included), so an older
        # score does not resurface as the current one.
        Assessment.objects.filter(**pair, **({"period": data["period"]} if "period" in data else {})).delete()
        return Response(status=204)
    key = {**pair, "period": data.get("period", month_start(timezone.localdate()))}
    assessment, _ = Assessment.objects.update_or_create(
        **key, defaults={"score": data["score"], "notes": data["notes"], "assessed_by": request.user}
    )
    return Response(AssessmentSerializer(assessment).data)


@api_view(["GET"])
@permission_classes([IsGymMember])
def my_assessments(request):
    """The signed-in student's full score history, oldest month first."""
    return Response(AssessmentSerializer(gym_assessments(request.user.gym).filter(student=request.user), many=True).data)


class FocusOptionViewSet(ArchivableListViewSet):
    serializer_class = FocusOptionSerializer
    model = FocusOption


def requested_week(request):
    """Monday of `?week=` (any day of that week), defaulting to the current week."""
    if "week" in request.query_params:
        return week_start(parse_date(request.query_params["week"], "week"))
    return week_start(timezone.localdate())


@api_view(["GET"])
@permission_classes([IsCoach])
def weekly_focuses(request):
    focuses = WeeklyFocus.objects.filter(
        student__gym=request.user.gym, week_start=requested_week(request)
    ).select_related("focus")
    return Response(WeeklyFocusSerializer(focuses, many=True).data)


@api_view(["POST"])
@permission_classes([IsCoach])
def set_weekly_focus(request):
    serializer = SetWeeklyFocusSerializer(data=request.data, context={"request": request})
    serializer.is_valid(raise_exception=True)
    data = serializer.validated_data
    key = {"student": data["student"], "week_start": data["week"], "position": data["position"]}
    if data["focus"] is None:
        WeeklyFocus.objects.filter(**key).delete()
        return Response(status=204)
    focus, _ = WeeklyFocus.objects.update_or_create(**key, defaults={"focus": data["focus"], "note": data["note"]})
    return Response(WeeklyFocusSerializer(focus).data)


class CoachNoteViewSet(GymScopedViewSet):
    """Coach observations about students; filter with `?student=`."""

    serializer_class = CoachNoteSerializer

    def get_queryset(self):
        queryset = CoachNote.objects.filter(student__gym=self.gym).select_related("author")
        if "student" in self.request.query_params:
            queryset = queryset.filter(student_id=self.request.query_params["student"])
        return queryset

    def perform_create(self, serializer):
        serializer.save(author=self.request.user)


class HomeworkViewSet(GymScopedViewSet):
    """Weekly homework; filter with `?week=` (any day of that week)."""

    serializer_class = HomeworkSerializer

    def get_queryset(self):
        queryset = Homework.objects.filter(gym=self.gym).select_related("drill").prefetch_related("participants")
        if "week" in self.request.query_params:
            queryset = queryset.filter(week_start=requested_week(self.request))
        return queryset


@api_view(["GET"])
@permission_classes([IsGymMember])
def my_week(request):
    """What the student needs this week (or `?week=`): their two focuses, homework and visible notes."""
    user = request.user
    week = requested_week(request)
    focuses = WeeklyFocus.objects.filter(student=user, week_start=week, focus__gym=user.gym).select_related("focus")
    homework = (
        Homework.objects.filter(gym=user.gym, week_start=week)
        .filter(Q(is_broadcast=True) | Q(participants=user))
        .distinct()
        .select_related("drill")
    )
    notes = CoachNote.objects.filter(student=user, visible_to_student=True).select_related("author")[:10]
    return Response(
        {
            "week_start": week,
            "focuses": WeeklyFocusSerializer(focuses, many=True).data,
            "homework": [
                {key: value for key, value in item.items() if key != "participants"}
                for item in HomeworkSerializer(homework, many=True, context={"request": request}).data
            ],
            "notes": CoachNoteSerializer(notes, many=True, context={"request": request}).data,
        }
    )
