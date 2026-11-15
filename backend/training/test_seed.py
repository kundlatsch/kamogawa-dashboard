from django.core.management import call_command

from accounts.models import User
from training.models import Drill


def test_seed_demo_is_idempotent(db):
    call_command("seed_demo")
    call_command("seed_demo")
    assert Drill.objects.filter(name="Toque no ombro").count() == 1
    assert User.objects.filter(role=User.Role.STUDENT).count() == 3
    assert User.objects.filter(role=User.Role.COACH).count() == 1
