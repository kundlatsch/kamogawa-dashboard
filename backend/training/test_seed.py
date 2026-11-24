from django.core.management import call_command

from accounts.models import User
from training.models import Drill


def test_seed_demo_is_idempotent(db):
    call_command("seed_demo")
    call_command("seed_demo")
    assert Drill.objects.filter(name="Toque no ombro").count() == 1
    assert User.objects.filter(role=User.Role.STUDENT).count() == 3
    assert User.objects.filter(role=User.Role.COACH).count() == 1


def test_seed_test_creates_known_logins_and_a_planned_class(db, client):
    from training.models import CheckIn, TrainingSession, WeeklySchedule
    from accounts.models import Gym

    call_command("seed_test")
    call_command("seed_test")  # idempotent
    gym = Gym.objects.get(slug="chacao-boxing-team")
    assert gym.name == "Chacão Boxing Team"
    coach = User.objects.get(username="treinador")
    assert coach.role == User.Role.COACH and coach.gym == gym and coach.check_password("treinador")
    for n in range(1, 5):
        student = User.objects.get(username=f"aluno{n}")
        assert student.role == User.Role.STUDENT and student.check_password(f"aluno{n}")
        assert student.level
    assert User.objects.get(username="aluno1").points.count() == 4
    aluno1 = User.objects.get(username="aluno1")
    assert (aluno1.fighter_class.name, aluno1.secondary_fighter_class.name) == ("Out-Boxer", "Counterpuncher")
    assert User.objects.get(username="aluno2").secondary_fighter_class is None
    assert aluno1.focus_text.startswith("Guarda alta")
    assert Drill.objects.filter(gym=gym, name="Mobilidade articular").count() == 1
    assert Drill.objects.filter(gym=gym, category__name="Escola de Boxe").count() > 100  # bundled library

    session = TrainingSession.objects.get(gym=gym, status=TrainingSession.Status.PUBLISHED)
    assert session.date.weekday() in WeeklySchedule.for_gym(gym).training_weekdays
    assert CheckIn.objects.filter(session=session).count() == 4
    blocks = set(session.assignments.values_list("block__name", flat=True))
    assert len(blocks) == 6
    pair = session.assignments.filter(drill__name="Toque no ombro").first()
    assert pair.participants.count() == 2
    first_count = session.assignments.count()
    call_command("seed_test")
    assert session.assignments.count() == first_count

    response = client.post("/api/auth/token/", {"username": "aluno1", "password": "aluno1"})
    assert response.status_code == 200


def test_seed_test_leaves_existing_accounts_alone(db, make_user):
    existing = make_user("treinador", User.Role.COACH, password="real-secret-123")
    call_command("seed_test")
    existing.refresh_from_db()
    assert existing.check_password("real-secret-123")
