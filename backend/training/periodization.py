"""Date derivation for macro/meso/microcycles.

Only a macrocycle has a stored date (its start). Mesocycles and microcycles follow one another
in their `order`, each microcycle lasting `length_days`, so the coach can reorder or resize
cycles and every date below shifts with them.
"""
from dataclasses import dataclass
from datetime import date, timedelta

from django.db.models import Prefetch

from .models import Macrocycle, Mesocycle, Microcycle


@dataclass(frozen=True)
class CycleSpan:
    """A microcycle placed on the calendar, with the cycles that contain it."""

    macrocycle: Macrocycle
    mesocycle: Mesocycle
    microcycle: Microcycle
    start: date
    end: date  # inclusive

    def contains(self, day: date) -> bool:
        return self.start <= day <= self.end


def macrocycles_with_cycles(queryset):
    """Prefetch everything needed to lay a macrocycle out on the calendar."""
    microcycles = Microcycle.objects.select_related("phase").order_by("order", "id")
    mesocycles = (
        Mesocycle.objects.select_related("valence")
        .prefetch_related(Prefetch("microcycles", queryset=microcycles))
        .order_by("order", "id")
    )
    return queryset.prefetch_related(Prefetch("mesocycles", queryset=mesocycles))


def layout(macrocycle: Macrocycle) -> list[CycleSpan]:
    """The macrocycle's microcycles in calendar order with their date ranges."""
    spans = []
    cursor = macrocycle.start_date
    for mesocycle in macrocycle.mesocycles.all():
        for microcycle in mesocycle.microcycles.all():
            end = cursor + timedelta(days=max(microcycle.length_days, 1) - 1)
            spans.append(CycleSpan(macrocycle, mesocycle, microcycle, cursor, end))
            cursor = end + timedelta(days=1)
    return spans


class GymTimeline:
    """All of a gym's cycles laid out once, to resolve many dates without extra queries."""

    def __init__(self, gym):
        macrocycles = macrocycles_with_cycles(Macrocycle.objects.filter(gym=gym))
        # When macrocycles overlap, the one that started last wins.
        self.spans = sorted(
            (span for macro in macrocycles for span in layout(macro)),
            key=lambda span: (span.macrocycle.start_date, span.macrocycle.id),
            reverse=True,
        )

    def at(self, day: date) -> CycleSpan | None:
        return next((span for span in self.spans if span.contains(day)), None)

    def objective_for(self, session) -> str:
        if session.objective_override:
            return session.objective_override
        span = self.at(session.date)
        return span.microcycle.objective if span else ""
