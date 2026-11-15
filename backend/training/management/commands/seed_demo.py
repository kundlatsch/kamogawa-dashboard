import json
from pathlib import Path

from django.core.management.base import BaseCommand
from django.db import transaction

from accounts.models import User
from accounts.passwords import generate_password
from training.models import Drill, DrillCategory

FIXTURES = Path(__file__).resolve().parents[2] / "fixtures"


class Command(BaseCommand):
    help = "Load demo categories, drills, a coach and students (idempotent). Prints generated passwords."

    def add_arguments(self, parser):
        parser.add_argument("--locale", default="pt-BR", help="Fixture locale (fixtures/demo_<locale>.json).")

    @transaction.atomic
    def handle(self, *args, locale, **options):
        data = json.loads((FIXTURES / f"demo_{locale}.json").read_text(encoding="utf-8"))

        categories = {}
        for order, item in enumerate(data["categories"]):
            category, _ = DrillCategory.objects.get_or_create(
                name=item["name"], defaults={"color": item["color"], "order": order}
            )
            categories[category.name] = category

        for item in data["drills"]:
            fields = {**item, "category": categories.get(item.get("category"))}
            Drill.objects.get_or_create(name=item["name"], defaults=fields)

        accounts = [(data["coach"], User.Role.COACH)] + [(s, User.Role.STUDENT) for s in data["students"]]
        for item, role in accounts:
            if User.objects.filter(username=item["username"]).exists():
                continue
            password = generate_password()
            user = User(**item, role=role)
            user.set_password(password)
            user.save()
            self.stdout.write(f"{role:<8} {item['username']:<12} password: {password}")

        self.stdout.write(self.style.SUCCESS("Demo data ready."))
