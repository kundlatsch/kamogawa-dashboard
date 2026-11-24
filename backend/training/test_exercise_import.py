import json

import pytest
from django.core.management import CommandError, call_command

from training.exercise_import import drill_fields, drill_name
from training.management.commands.import_exercises import DEFAULT_FILE
from training.models import Drill, DrillCategory


def test_routine_lines_become_one_name_and_the_text_stays_in_the_description():
    fields = drill_fields("Corrida\nPolichinelo\n", "1 min cada")
    assert fields["name"] == "Corrida · Polichinelo"
    assert fields["description"] == "Corrida\nPolichinelo\n\nTempo: 1 min cada"
    assert "default_duration_minutes" not in fields


def test_plain_times_fill_the_defaults():
    assert drill_fields("Sombra leve", "3 min")["default_duration_minutes"] == 3
    assert drill_fields("Sparring", "5 Rounds")["default_rounds"] == 5
    assert drill_fields("Sombra leve", "")["description"] == ""


def test_long_names_are_cut_at_a_word():
    name = drill_name("palavra " * 40)
    assert len(name) <= 120 and name.endswith("palavra…")


def test_bundled_library_imports_once_into_the_gym(gym, other_gym):
    DrillCategory.objects.create(gym=gym, name="Aquecimento", color="#123456")
    Drill.objects.create(gym=gym, name="POLICHINELO")
    total = sum(len(c["exercicios"]) for c in json.loads(DEFAULT_FILE.read_text(encoding="utf-8"))["categories"])

    call_command("import_exercises", gym=gym.slug)
    assert Drill.objects.filter(gym=gym).count() == total  # "Polichinelo" was already there
    assert DrillCategory.objects.filter(gym=gym).count() == 8
    assert Drill.objects.get(gym=gym, name="Rotação tronco").category.name == "Mobilidade"

    call_command("import_exercises", gym=gym.slug)
    assert Drill.objects.filter(gym=gym).count() == total
    assert not Drill.objects.filter(gym=other_gym).exists()


def test_unknown_gym_is_an_error(db):
    with pytest.raises(CommandError):
        call_command("import_exercises", gym="nope")
