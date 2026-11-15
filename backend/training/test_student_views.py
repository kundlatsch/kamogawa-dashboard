from datetime import timedelta

import pytest
from django.utils import timezone

from training.models import Assignment, Drill, TrainingSession


@pytest.fixture
def gym_data(make_user, gym):
    today = timezone.localdate()
    session = TrainingSession.objects.create(gym=gym, date=today, status=TrainingSession.Status.PUBLISHED)
    students = {name: make_user(name) for name in ["a", "b", "c"]}
    bag = Drill.objects.create(gym=gym, name="Heavy bag")
    tap = Drill.objects.create(gym=gym, name="Shoulder tap")
    warmup = Drill.objects.create(gym=gym, name="Jump rope")

    def assign(drill, *names, broadcast=False, order=0):
        assignment = Assignment.objects.create(session=session, drill=drill, is_broadcast=broadcast, order=order)
        assignment.participants.set([students[n] for n in names])
        return assignment

    assign(warmup, broadcast=True, order=0)
    assign(bag, "a", order=1)
    assign(tap, "b", "c", order=2)
    return {"today": today, "session": session, **students}


def routine_names(client):
    sessions = client.get("/api/me/routine/").json()["sessions"]
    return [item["drill"]["name"] for session in sessions for item in session["routine"]]


def test_student_sees_own_and_broadcast_drills_in_order(api_as, gym_data):
    assert routine_names(api_as(gym_data["a"])) == ["Jump rope", "Heavy bag"]


def test_pair_drill_shows_for_both_with_partner(api_as, gym_data):
    for me, partner in [("b", "c"), ("c", "b")]:
        sessions = api_as(gym_data[me]).get("/api/me/routine/").json()["sessions"]
        pair = [i for i in sessions[0]["routine"] if i["drill"]["name"] == "Shoulder tap"][0]
        assert [p["id"] for p in pair["partners"]] == [gym_data[partner].id]


def test_broadcast_reaches_students_created_later(api_as, make_user, gym_data):
    newcomer = make_user("d")
    assert routine_names(api_as(newcomer)) == ["Jump rope"]


def test_draft_sessions_are_hidden(api_as, gym_data):
    gym_data["session"].status = TrainingSession.Status.DRAFT
    gym_data["session"].save()
    assert routine_names(api_as(gym_data["a"])) == []


def test_upcoming_lists_future_published_sessions_without_drills(api_as, gym_data):
    TrainingSession.objects.create(
        gym=gym_data["session"].gym,
        date=gym_data["today"] + timedelta(days=2),
        kind=TrainingSession.Kind.SPARRING,
        status=TrainingSession.Status.PUBLISHED,
    )
    TrainingSession.objects.create(gym=gym_data["session"].gym, date=gym_data["today"] + timedelta(days=3))  # draft
    data = api_as(gym_data["a"]).get("/api/me/upcoming/").json()
    assert [s["kind"] for s in data] == ["SPARRING"]
    assert "routine" not in data[0]


def test_coach_publishes_session(coach, api_as):
    session = TrainingSession.objects.create(gym=coach.gym, date=timezone.localdate())
    response = api_as(coach).post(f"/api/sessions/{session.id}/publish/")
    assert response.json()["status"] == "PUBLISHED"
    assert response.json()["published_at"]
