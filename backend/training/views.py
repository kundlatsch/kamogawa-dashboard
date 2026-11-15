from datetime import date

from rest_framework import status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from accounts.permissions import IsStaffRole, IsStaffRoleOrReadOnly

from .models import Drill, DrillCategory, TrainingSession, WeeklySchedule
from .scheduling import generate_regular_sessions
from .serializers import (
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


class DrillCategoryViewSet(viewsets.ModelViewSet):
    queryset = DrillCategory.objects.all()
    serializer_class = DrillCategorySerializer
    permission_classes = [IsStaffRoleOrReadOnly]


class DrillViewSet(viewsets.ModelViewSet):
    """Drill library. Deleting archives the drill so past sessions keep their history."""

    serializer_class = DrillSerializer
    permission_classes = [IsStaffRole]

    def get_queryset(self):
        queryset = Drill.objects.select_related("category")
        if self.request.query_params.get("include_archived") != "true":
            queryset = queryset.filter(archived=False)
        return queryset

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    def perform_destroy(self, instance):
        instance.archived = True
        instance.save(update_fields=["archived", "updated_at"])


@api_view(["GET", "PUT"])
@permission_classes([IsStaffRole])
def weekly_schedule(request):
    schedule = WeeklySchedule.load()
    if request.method == "PUT":
        serializer = WeeklyScheduleSerializer(schedule, data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
    return Response(WeeklyScheduleSerializer(schedule).data)


class TrainingSessionViewSet(viewsets.ModelViewSet):
    serializer_class = TrainingSessionSerializer
    permission_classes = [IsStaffRole]

    def get_queryset(self):
        queryset = TrainingSession.objects.all()
        params = self.request.query_params
        if "from" in params:
            queryset = queryset.filter(date__gte=parse_date(params["from"], "from"))
        if "to" in params:
            queryset = queryset.filter(date__lte=parse_date(params["to"], "to"))
        return queryset

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=False, methods=["post"])
    def generate(self, request):
        """Materialize regular sessions from the weekly schedule for a date range."""
        start = parse_date(request.data.get("from"), "from")
        end = parse_date(request.data.get("to"), "to")
        created = generate_regular_sessions(start, end, created_by=request.user)
        return Response(
            TrainingSessionSerializer(created, many=True).data, status=status.HTTP_201_CREATED
        )
