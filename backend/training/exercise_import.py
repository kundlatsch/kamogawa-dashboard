"""Import an exercise library file into a gym's drill library.

The file format (see `fixtures/exercise_library_pt-BR.json`) is::

    {"version": 1, "categories": [
        {"categoria": "Mobilidade", "exercicios": [{"exercicio": "Rotação tronco", "tempo": "1 min"}, ...]},
        ...
    ]}

Each exercise becomes a `Drill` in the category with the same name (created when missing).
Multi-line exercises are routines: their lines are joined with " · " to form the name, and the
full text is kept in the description, together with the time ("tempo") when there is one.
The import is idempotent: an exercise whose name already exists in the gym (any case) is skipped.
"""
import re
from dataclasses import dataclass, field

from django.db import transaction
from django.db.models import Max

from .models import Drill, DrillCategory

NAME_MAX = Drill._meta.get_field("name").max_length

# Color and card emoji for the categories in the bundled library; other categories get a color from FALLBACK_COLORS.
CATEGORY_STYLE = {
    "mobilidade": ("#2a9d8f", "🤸"),
    "aquecimento": ("#e9b949", "🔥"),
    "aquecimento específico": ("#f77f00", "⚡"),
    "escola de boxe": ("#d62828", "🥊"),
    "escola de combate dirigido": ("#9b5de5", "🎯"),
    "escola de combate condicionado": ("#3a86ff", "💪"),
    "sparring": ("#8d0801", "⚔️"),
    "resfriamento": ("#48cae4", "🧊"),
}
FALLBACK_COLORS = ["#06d6a0", "#ef476f", "#118ab2", "#ffd166", "#8338ec"]


@dataclass
class ImportResult:
    created: int = 0
    skipped: int = 0
    categories_created: list[str] = field(default_factory=list)


def drill_name(text: str) -> str:
    """One-line name for an exercise: its lines joined, cut at a word boundary when too long."""
    name = " · ".join(line.strip() for line in text.splitlines() if line.strip())
    if len(name) <= NAME_MAX:
        return name
    cut = name[: NAME_MAX - 1].rsplit(" ", 1)[0].rstrip(" ·,")
    return f"{cut}…"


def parse_time(tempo: str) -> dict:
    """Default duration or rounds when the time is a single plain value ("3 min", "5 rounds")."""
    tempo = tempo.strip().lower()
    if match := re.fullmatch(r"(\d+) ?min", tempo):
        return {"default_duration_minutes": int(match[1])}
    if match := re.fullmatch(r"(\d+) ?rounds?", tempo):
        return {"default_rounds": int(match[1])}
    return {}


def drill_fields(text: str, tempo: str) -> dict:
    text, tempo = text.strip(), tempo.strip()
    name = drill_name(text)
    details = []
    if "\n" in text or name != text:
        details.append(text)
    if tempo:
        details.append(f"Tempo: {tempo}")
    return {"name": name, "description": "\n\n".join(details), **parse_time(tempo)}


@transaction.atomic
def import_exercises(gym, data: dict, created_by=None) -> ImportResult:
    result = ImportResult()
    categories = {c.name.lower(): c for c in DrillCategory.objects.filter(gym=gym)}
    existing = {name.lower() for name in Drill.objects.filter(gym=gym).values_list("name", flat=True)}
    next_order = (DrillCategory.objects.filter(gym=gym).aggregate(top=Max("order"))["top"] or 0) + 1

    for group in data["categories"]:
        category_name = group["categoria"].strip()
        color, emoji = CATEGORY_STYLE.get(category_name.lower(), (None, "🥊"))
        category = categories.get(category_name.lower())
        if category is None:
            color = color or FALLBACK_COLORS[len(result.categories_created) % len(FALLBACK_COLORS)]
            category = DrillCategory.objects.create(gym=gym, name=category_name, color=color, order=next_order)
            categories[category_name.lower()] = category
            result.categories_created.append(category_name)
            next_order += 1

        for item in group["exercicios"]:
            if not item.get("exercicio", "").strip():
                continue
            fields = drill_fields(item["exercicio"], item.get("tempo", ""))
            if fields["name"].lower() in existing:
                result.skipped += 1
                continue
            Drill.objects.create(
                gym=gym, category=category, emoji=emoji, color=category.color, created_by=created_by, **fields
            )
            existing.add(fields["name"].lower())
            result.created += 1
    return result
