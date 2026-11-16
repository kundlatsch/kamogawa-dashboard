"""Starter lists every gym gets (valences, microcycle phases, ...), editable by its coaches.

The names are gym content, not UI copy, so they live in a locale data file next to the demo
fixtures instead of in code.
"""
import json
from pathlib import Path

DEFAULTS_FILE = Path(__file__).parent / "fixtures" / "gym_defaults_pt-BR.json"


def load_defaults() -> dict:
    return json.loads(DEFAULTS_FILE.read_text(encoding="utf-8"))


def seed_gym_defaults(gym, models: dict | None = None) -> None:
    """Create any missing starter rows for the gym; never touches rows the coach already has.

    `models` maps a defaults key to its model class, so data migrations can pass historical
    models; by default the current ones are used.
    """
    if models is None:
        from .models import MicrocyclePhase, SessionBlock, Valence

        models = {"valences": Valence, "microcycle_phases": MicrocyclePhase, "session_blocks": SessionBlock}
    defaults = load_defaults()
    for key, model in models.items():
        if model.objects.filter(gym_id=gym.id).exists():
            continue  # the coach owns this list once it exists
        model.objects.bulk_create(
            model(gym_id=gym.id, order=position, **row) for position, row in enumerate(defaults.get(key, []))
        )
