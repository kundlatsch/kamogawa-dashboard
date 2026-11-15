"""Coaches and students of one gym must never see or touch another gym's data."""
from datetime import date

import pytest
from django.utils import timezone

from accounts.models import User
from training.models import Assignment, Drill, DrillCategory, TrainingSession, WeeklySchedule


@pytest.fixture
def rival(make_user, other_gym):
    session = TrainingSession.objects.create(
        gym=other_gym, date=timezone.localdate(), status=TrainingSession.Status.PUBLISHED
    )
    drill = Drill.objects.create(gym=other_gym, name="Rival drill")
    student = make_user("rival_student", gym=other_gym)
    Assignment.objects.create(session=session, drill=drill, is_broadcast=True)
    return {
        "gym": other_gym,
        "session": session,
        "drill": drill,
        "student": student,
        "category": DrillCategory.objects.create(gym=other_gym, name="Rival category"),
        "coach": make_user("rival_coach", User.Role.COACH, gym=other_gym),
    }


def test_lists_only_show_own_gym(coach, api_as, rival):
    client = api_as(coach)
    for url in ["/api/drills/", "/api/drill-categories/", "/api/sessions/", "/api/students/"]:
        assert client.get(url).json() == [], url


def test_other_gym_objects_are_not_found(coach, api_as, rival):
    client = api_as(coach)
    assert client.get(f"/api/drills/{rival['drill'].id}/").status_code == 404
    assert client.post(f"/api/sessions/{rival['session'].id}/publish/").status_code == 404
    assert client.get(f"/api/assignments/?session={rival['session'].id}").json() == []


def test_cannot_assign_other_gym_drill_session_or_student(coach, api_as, gym, rival):
    own_session = TrainingSession.objects.create(gym=gym, date=date(2026, 11, 16))
    own_drill = Drill.objects.create(gym=gym, name="Own drill")
    client = api_as(coach)
    attempts = [
        {"session": rival["session"].id, "drill": own_drill.id, "is_broadcast": True},
        {"session": own_session.id, "drill": rival["drill"].id, "is_broadcast": True},
        {"session": own_session.id, "drill": own_drill.id, "participants": [rival["student"].id]},
    ]
    for payload in attempts:
        assert client.post("/api/assignments/", payload, format="json").status_code == 400, payload


def test_drill_category_must_belong_to_gym(coach, api_as, rival):
    response = api_as(coach).post("/api/drills/", {"name": "Bag", "category": rival["category"].id})
    assert response.status_code == 400


def test_same_category_name_allowed_in_different_gyms(coach, api_as):
    assert api_as(coach).post("/api/drill-categories/", {"name": "Rival category"}).status_code == 201
    assert api_as(coach).post("/api/drill-categories/", {"name": "rival category"}).status_code == 400


def test_each_gym_has_its_own_schedule(coach, api_as, rival):
    api_as(coach).put("/api/schedule/", {"training_weekdays": [1], "default_start_time": "07:00"}, format="json")
    assert WeeklySchedule.for_gym(rival["gym"]).training_weekdays == [0, 2, 5]


def test_generation_ignores_other_gyms_sessions(coach, api_as, rival):
    TrainingSession.objects.create(gym=rival["gym"], date=date(2026, 11, 16))
    api_as(coach).post("/api/sessions/generate/", {"from": "2026-11-16", "to": "2026-11-16"}, format="json")
    assert TrainingSession.objects.filter(gym=coach.gym, date=date(2026, 11, 16)).exists()


def test_students_only_see_own_gym_routine(make_user, api_as, rival):
    student = make_user("ana")
    assert api_as(student).get("/api/me/routine/").json()["sessions"] == []
    assert len(api_as(rival["student"]).get("/api/me/routine/").json()["sessions"]) == 1


def test_sparring_alerts_stay_inside_the_gym(coach, api_as, make_user, rival):
    make_user("ana")
    session = TrainingSession.objects.create(gym=coach.gym, date=date(2026, 11, 21), kind="SPARRING")
    api_as(coach).post(f"/api/sessions/{session.id}/publish/")
    assert api_as(rival["student"]).get("/api/notifications/").json()["unread"] == 0
