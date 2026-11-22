"""Test data with fixed, known logins (`treinador`/`treinador`, `aluno1`/`aluno1` ... `aluno4`/`aluno4`).

For local testing only: it creates accounts with trivial passwords. It is idempotent and never
changes existing accounts or plans: accounts that already exist are left as they are, and the
next class only receives the sample plan while it is still empty.
"""
import json
from datetime import timedelta

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from accounts.models import Gym, User
from gamification.models import FighterClass
from progress.models import StudentPoint
from training.models import Assignment, CheckIn, Drill, DrillCategory, SessionBlock, TrainingSession
from training.scheduling import generate_regular_sessions

from .seed_demo import FIXTURES


class Command(BaseCommand):
    help = "Load test accounts with known passwords, exercises and a planned next class (idempotent)."

    @transaction.atomic
    def handle(self, *args, **options):
        data = json.loads((FIXTURES / "test_seed_pt-BR.json").read_text(encoding="utf-8"))
        library = json.loads((FIXTURES / "demo_pt-BR.json").read_text(encoding="utf-8"))
        gym, _ = Gym.objects.get_or_create(slug=data["gym"]["slug"], defaults={"name": data["gym"]["name"]})

        categories = {}
        for order, item in enumerate(library["categories"]):
            category, _ = DrillCategory.objects.get_or_create(
                gym=gym, name=item["name"], defaults={"color": item["color"], "order": order}
            )
            categories[category.name] = category
        drills = {}
        for item in library["drills"] + data["extra_drills"]:
            fields = {**item, "category": categories.get(item.get("category"))}
            drill, _ = Drill.objects.get_or_create(gym=gym, name=item["name"], defaults=fields)
            drills[drill.name] = drill

        coach = self.account(gym, data["coach"], User.Role.COACH)
        students = [self.account(gym, item, User.Role.STUDENT) for item in data["students"]]
        self.plan_next_class(gym, coach, students, drills, data["class_plan"])
        self.stdout.write(self.style.SUCCESS(f"Test data ready in '{gym.name}'."))

    def account(self, gym, item, role) -> User:
        fields = {key: value for key, value in item.items() if key not in {"password", "strengths", "weaknesses"}}
        for key in ("fighter_class", "secondary_fighter_class"):
            if key in fields:  # fixture names a style; the gym's starter classes are seeded on gym creation
                fields[key] = FighterClass.objects.filter(gym=gym, name=fields[key]).first()
        user = User.objects.filter(username=item["username"]).first()
        if user:
            self.stdout.write(f"{item['username']} already exists, left unchanged.")
            return user
        user = User(**fields, role=role, gym=gym)
        user.set_password(item["password"])
        user.save()
        for kind, key in [(StudentPoint.Kind.STRENGTH, "strengths"), (StudentPoint.Kind.WEAKNESS, "weaknesses")]:
            for text in item.get(key, []):
                StudentPoint.objects.create(student=user, kind=kind, text=text)
        self.stdout.write(f"Created {role.lower()} {item['username']}.")
        return user

    def plan_next_class(self, gym, coach, students, drills, plan):
        """Publish the next regular class with everyone checked in and a sample exercise per block."""
        today = timezone.localdate()
        generate_regular_sessions(gym, today, today + timedelta(days=14), created_by=coach)
        session = TrainingSession.objects.filter(gym=gym, date__gte=today).order_by("date", "start_time").first()
        if session is None:
            self.stdout.write("No training weekday configured: no class planned.")
            return
        if session.assignments.exists():
            self.stdout.write(f"The class on {session.date} already has exercises, left unchanged.")
            return
        blocks = list(SessionBlock.objects.filter(gym=gym, archived=False))
        own_students = [s for s in students if s.gym_id == gym.id]
        pairs = [own_students[i : i + 2] for i in range(0, len(own_students), 2)]
        order = 0
        for step in plan:
            block = blocks[step["block"]] if step["block"] < len(blocks) else None
            for name in step["drills"]:
                groups = {"everyone": [[]], "each": [[s] for s in own_students], "pairs": pairs}[step["mode"]]
                for group in groups:
                    assignment = Assignment.objects.create(
                        session=session, drill=drills[name], block=block, is_broadcast=not group, order=order
                    )
                    assignment.participants.set(group)
                    order += 1
        session.status = TrainingSession.Status.PUBLISHED
        session.published_at = timezone.now()
        session.save(update_fields=["status", "published_at"])
        for student in own_students:
            CheckIn.objects.get_or_create(session=session, student=student)
        self.stdout.write(f"Planned and published the class on {session.date} with everyone checked in.")
