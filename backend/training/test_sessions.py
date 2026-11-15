from datetime import date

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
    assert WeeklySchedule.load().training_weekdays == [1, 3]


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
    TrainingSession.objects.create(date=MONDAY, kind=TrainingSession.Kind.SPARRING)
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


def test_session_range_filter(coach, api_as):
    TrainingSession.objects.create(date=date(2026, 11, 16))
    TrainingSession.objects.create(date=date(2026, 12, 1))
    data = api_as(coach).get("/api/sessions/?from=2026-11-01&to=2026-11-30").json()
    assert len(data) == 1
