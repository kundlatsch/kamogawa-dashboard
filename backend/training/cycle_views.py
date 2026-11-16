"""Periodization API: coach-editable valences, phases and class blocks, and the cycle plan."""
from django.db import transaction
from django.utils import timezone
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from accounts.permissions import IsCoach, IsCoachOrReadOnly, IsGymMember

from .models import Macrocycle, Mesocycle, Microcycle, MicrocyclePhase, SessionBlock, Valence
from .periodization import GymTimeline, macrocycles_with_cycles
from .serializers import (
    MacrocycleSerializer,
    MesocycleSerializer,
    MicrocyclePhaseSerializer,
    MicrocycleSerializer,
    SessionBlockSerializer,
    ValenceSerializer,
)
from .views import GymScopedViewSet, parse_date


def apply_order(queryset, ids):
    """Rewrite `order` so rows follow `ids`, which must list every row of the queryset."""
    if not isinstance(ids, list):
        raise ValidationError({"ids": "Send the ordered list of ids."})
    rows = {row.id: row for row in queryset}
    if not rows or len(ids) != len(rows) or set(ids) != set(rows):
        raise ValidationError({"ids": "The list must contain every item exactly once."})
    for position, row_id in enumerate(ids):
        rows[row_id].order = position
    queryset.model.objects.bulk_update(rows.values(), ["order"])


class ArchivableListViewSet(GymScopedViewSet):
    """Coach-editable list; deleting archives the item so cycles that use it keep their history."""

    permission_classes = [IsCoachOrReadOnly]
    model = None

    def get_queryset(self):
        queryset = self.model.objects.filter(gym=self.gym)
        if self.request.query_params.get("include_archived") != "true" and self.action == "list":
            queryset = queryset.filter(archived=False)
        return queryset

    def perform_create(self, serializer):
        serializer.save(gym=self.gym, order=self.model.objects.filter(gym=self.gym).count())

    def perform_destroy(self, instance):
        instance.archived = True
        instance.save(update_fields=["archived"])

    @action(detail=False, methods=["post"])
    @transaction.atomic
    def reorder(self, request):
        apply_order(self.model.objects.filter(gym=self.gym, archived=False), request.data.get("ids"))
        return Response(self.get_serializer(self.get_queryset().filter(archived=False), many=True).data)


class ValenceViewSet(ArchivableListViewSet):
    serializer_class = ValenceSerializer
    model = Valence


class MicrocyclePhaseViewSet(ArchivableListViewSet):
    serializer_class = MicrocyclePhaseSerializer
    model = MicrocyclePhase


class SessionBlockViewSet(ArchivableListViewSet):
    """The parts of a class, in order (mobility, warm-ups, boxing school, combat, cool-down)."""

    serializer_class = SessionBlockSerializer
    model = SessionBlock


class MacrocycleViewSet(GymScopedViewSet):
    """Students may read the plan; only coaches change it."""

    serializer_class = MacrocycleSerializer
    permission_classes = [IsCoachOrReadOnly]

    def get_queryset(self):
        return macrocycles_with_cycles(Macrocycle.objects.filter(gym=self.gym))


class MesocycleViewSet(GymScopedViewSet):
    serializer_class = MesocycleSerializer

    def get_queryset(self):
        return Mesocycle.objects.filter(macrocycle__gym=self.gym)

    def perform_create(self, serializer):
        serializer.save()  # the gym comes from the (gym-scoped) macrocycle

    @action(detail=False, methods=["post"])
    @transaction.atomic
    def reorder(self, request):
        """Reorder the valences of a macrocycle: `{"macrocycle": id, "ids": [mesocycle ids]}`."""
        apply_order(self.get_queryset().filter(macrocycle_id=request.data.get("macrocycle")), request.data.get("ids"))
        return Response(status=204)


class MicrocycleViewSet(GymScopedViewSet):
    serializer_class = MicrocycleSerializer

    def get_queryset(self):
        return Microcycle.objects.filter(mesocycle__macrocycle__gym=self.gym)

    def perform_create(self, serializer):
        serializer.save()

    @action(detail=False, methods=["post"])
    @transaction.atomic
    def reorder(self, request):
        """Reorder the weeks of a mesocycle: `{"mesocycle": id, "ids": [microcycle ids]}`."""
        apply_order(self.get_queryset().filter(mesocycle_id=request.data.get("mesocycle")), request.data.get("ids"))
        return Response(status=204)


@api_view(["GET"])
@permission_classes([IsGymMember])
def current_cycle(request):
    """The plan around a date (default today): its macrocycle and the active meso/microcycle ids."""
    day = parse_date(request.query_params["date"], "date") if "date" in request.query_params else timezone.localdate()
    span = GymTimeline(request.user.gym).at(day)
    if span is None:
        return Response({"date": day, "macrocycle": None, "mesocycle": None, "microcycle": None})
    macrocycle = macrocycles_with_cycles(Macrocycle.objects.filter(pk=span.macrocycle.pk)).get()
    return Response(
        {
            "date": day,
            "macrocycle": MacrocycleSerializer(macrocycle, context={"request": request}).data,
            "mesocycle": span.mesocycle.id,
            "microcycle": span.microcycle.id,
        }
    )
