from datetime import date

from accounts.models import User
from training.models import TrainingSession, WeeklySchedule

# 2026-11-16 is a Monday.
MONDAY = date(2026, 11, 16)


def test_default_schedule_is_monday_wednesday_saturday(coach, api_as):
    data = api_as(coach).get("/api/schedule/").json()
    assert data["training_weekdays"] == [0, 2, 5]


def test_schedule_is_configurable(coach, api_as):
    response = api_as(coach).put(
        "/api/schedule/", {"training_weekdays": [1, 3], "default_start_time": "18:30"}, format="json"
    )
    assert response.status_code == 200
    assert WeeklySchedule.for_gym(coach.gym).training_weekdays == [1, 3]


def test_schedule_rejects_invalid_weekdays(coach, api_as):
    response = api_as(coach).put(
        "/api/schedule/", {"training_weekdays": [9], "default_start_time": "18:30"}, format="json"
    )
    assert response.status_code == 400


def test_generate_creates_sessions_on_training_days_only(coach, api_as):
    response = api_as(coach).post(
        "/api/sessions/generate/", {"from": "2026-11-16", "to": "2026-11-22"}, format="json"
    )
    assert response.status_code == 201
    dates = sorted(TrainingSession.objects.values_list("date", flat=True))
    assert [d.isoformat() for d in dates] == ["2026-11-16", "2026-11-18", "2026-11-21"]


def test_generate_is_idempotent_and_respects_existing_days(coach, api_as):
    TrainingSession.objects.create(gym=coach.gym, date=MONDAY, kind=TrainingSession.Kind.SPARRING)
    client = api_as(coach)
    payload = {"from": "2026-11-16", "to": "2026-11-22"}
    client.post("/api/sessions/generate/", payload, format="json")
    client.post("/api/sessions/generate/", payload, format="json")
    assert TrainingSession.objects.count() == 3
    assert TrainingSession.objects.get(date=MONDAY).kind == TrainingSession.Kind.SPARRING


def test_extra_session_on_any_day(coach, api_as):
    response = api_as(coach).post(
        "/api/sessions/", {"date": "2026-11-19", "kind": "EXTRA", "title": "Thursday extra"}
    )
    assert response.status_code == 201
    assert response.json()["status"] == "DRAFT"


def test_sparring_endpoint_forces_sparring_kind(coach, api_as):
    response = api_as(coach).post("/api/sessions/sparring/", {"date": "2026-11-21", "kind": "REGULAR"})
    assert response.status_code == 201
    assert response.json()["kind"] == "SPARRING"


def test_sparring_replaces_empty_regular_draft_on_same_day(coach, api_as):
    TrainingSession.objects.create(gym=coach.gym, date=date(2026, 11, 21))
    api_as(coach).post("/api/sessions/sparring/", {"date": "2026-11-21"})
    assert list(TrainingSession.objects.values_list("kind", flat=True)) == ["SPARRING"]


def test_sparring_keeps_regular_session_with_drills(coach, api_as):
    from training.models import Assignment, Drill

    regular = TrainingSession.objects.create(gym=coach.gym, date=date(2026, 11, 21))
    Assignment.objects.create(session=regular, drill=Drill.objects.create(gym=coach.gym, name="Bag"), is_broadcast=True)
    api_as(coach).post("/api/sessions/sparring/", {"date": "2026-11-21"})
    assert TrainingSession.objects.count() == 2


def test_session_range_filter(coach, api_as):
    TrainingSession.objects.create(gym=coach.gym, date=date(2026, 11, 16))
    TrainingSession.objects.create(gym=coach.gym, date=date(2026, 12, 1))
    data = api_as(coach).get("/api/sessions/?from=2026-11-01&to=2026-11-30").json()
    assert len(data) == 1


def test_convert_class_to_sparring_keeps_drills_and_alerts_students(api_as, make_user, gym):
    from notifications.models import Notification
    from training.models import Assignment, Drill

    coach = make_user("coach2", User.Role.COACH)
    ana = make_user("ana")
    session = TrainingSession.objects.create(gym=gym, date=date(2026, 11, 20), status=TrainingSession.Status.PUBLISHED)
    drill = Drill.objects.create(gym=gym, name="Sombra")
    Assignment.objects.create(session=session, drill=drill, is_broadcast=True)
    client = api_as(coach)
    response = client.post(f"/api/sessions/{session.id}/convert/", {"kind": "SPARRING"})
    assert response.status_code == 200 and response.json()["kind"] == "SPARRING"
    assert session.assignments.count() == 1
    assert Notification.objects.filter(recipient=ana, kind=Notification.Kind.SPARRING, session=session).exists()
    assert client.post(f"/api/sessions/{session.id}/convert/", {"kind": "REGULAR"}).json()["kind"] == "REGULAR"
    assert client.post(f"/api/sessions/{session.id}/convert/", {"kind": "PARTY"}).status_code == 400
    assert api_as(ana).post(f"/api/sessions/{session.id}/convert/", {"kind": "SPARRING"}).status_code == 403


def test_each_weekday_can_have_its_own_class_time(coach, api_as, gym):
    from datetime import time

    from training.scheduling import generate_regular_sessions

    client = api_as(coach)
    response = client.put(
        "/api/schedule/",
        {"training_weekdays": [0, 2, 5], "default_start_time": "19:00", "weekday_times": {"5": "14:00", "2": ""}},
        format="json",
    )
    assert response.status_code == 200 and response.json()["weekday_times"] == {"5": "14:00"}
    sessions = generate_regular_sessions(gym, MONDAY, MONDAY.replace(day=21))
    times = {s.date.weekday(): s.start_time for s in sessions}
    assert times == {0: time(19, 0), 2: time(19, 0), 5: time(14, 0)}
    bad = {"training_weekdays": [0], "default_start_time": "19:00", "weekday_times": {"9": "10:00"}}
    assert client.put("/api/schedule/", bad, format="json").status_code == 400
    bad["weekday_times"] = {"0": "25:99"}
    assert client.put("/api/schedule/", bad, format="json").status_code == 400


def test_changing_times_moves_only_untouched_upcoming_drafts(coach, api_as, gym):
    from datetime import time, timedelta

    from django.utils import timezone

    from training.models import Assignment, Drill

    today = timezone.localdate()
    saturday = today + timedelta(days=(5 - today.weekday()) % 7 or 7)
    untouched = TrainingSession.objects.create(gym=gym, date=saturday, start_time=time(19, 0))
    planned = TrainingSession.objects.create(gym=gym, date=saturday + timedelta(days=7), start_time=time(19, 0))
    Assignment.objects.create(session=planned, drill=Drill.objects.create(gym=gym, name="x"), is_broadcast=True)
    api_as(coach).put("/api/schedule/", {"weekday_times": {"5": "14:00"}}, format="json")
    untouched.refresh_from_db()
    planned.refresh_from_db()
    assert untouched.start_time == time(14, 0)
    assert planned.start_time == time(19, 0)
