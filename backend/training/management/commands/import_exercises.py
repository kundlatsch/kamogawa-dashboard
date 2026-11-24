"""Load an exercise library file into a gym (idempotent: existing names are skipped)."""
import json
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError

from accounts.models import Gym
from training.exercise_import import import_exercises

from .seed_demo import FIXTURES

DEFAULT_FILE = FIXTURES / "exercise_library_pt-BR.json"


class Command(BaseCommand):
    help = "Import exercises from a library JSON file into a gym's drill library (idempotent)."

    def add_arguments(self, parser):
        parser.add_argument("--gym", required=True, help="Gym slug, e.g. chacao-boxing-team.")
        parser.add_argument("--file", type=Path, default=DEFAULT_FILE, help="Library file (default: bundled library).")

    def handle(self, *args, gym, file, **options):
        try:
            target = Gym.objects.get(slug=gym)
        except Gym.DoesNotExist:
            slugs = ", ".join(Gym.objects.values_list("slug", flat=True)) or "none"
            raise CommandError(f"No gym with slug '{gym}'. Existing gyms: {slugs}.")
        data = json.loads(Path(file).read_text(encoding="utf-8"))
        result = import_exercises(target, data)
        new = f" New categories: {', '.join(result.categories_created)}." if result.categories_created else ""
        self.stdout.write(
            self.style.SUCCESS(
                f"{result.created} exercises added to '{target.name}', {result.skipped} already there.{new}"
            )
        )
