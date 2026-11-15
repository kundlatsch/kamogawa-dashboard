from datetime import timedelta

import pytest
from django.utils import timezone

from training.models import Assignment, Drill, TrainingSession


@pytest.fixture
def gym(make_user):
    today = timezone.localdate()
    session = TrainingSession.objects.create(date=today, status=TrainingSession.Status.PUBLISHED)
    students = {name: make_user(name) for name in ["a", "b", "c"]}
    bag = Drill.objects.create(name="Heavy bag")
    tap = Drill.objects.create(name="Shoulder tap")
    warmup = Drill.objects.create(name="Jump rope")

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


def test_student_sees_own_and_broadcast_drills_in_order(api_as, gym):
    assert routine_names(api_as(gym["a"])) == ["Jump rope", "Heavy bag"]


def test_pair_drill_shows_for_both_with_partner(api_as, gym):
    for me, partner in [("b", "c"), ("c", "b")]:
        sessions = api_as(gym[me]).get("/api/me/routine/").json()["sessions"]
        pair = [i for i in sessions[0]["routine"] if i["drill"]["name"] == "Shoulder tap"][0]
        assert [p["id"] for p in pair["partners"]] == [gym[partner].id]


def test_broadcast_reaches_students_created_later(api_as, make_user, gym):
    newcomer = make_user("d")
    assert routine_names(api_as(newcomer)) == ["Jump rope"]


def test_draft_sessions_are_hidden(api_as, gym):
    gym["session"].status = TrainingSession.Status.DRAFT
    gym["session"].save()
    assert routine_names(api_as(gym["a"])) == []


def test_upcoming_lists_future_published_sessions_without_drills(api_as, gym):
    TrainingSession.objects.create(
        date=gym["today"] + timedelta(days=2),
        kind=TrainingSession.Kind.SPARRING,
        status=TrainingSession.Status.PUBLISHED,
    )
    TrainingSession.objects.create(date=gym["today"] + timedelta(days=3))  # draft
    data = api_as(gym["a"]).get("/api/me/upcoming/").json()
    assert [s["kind"] for s in data] == ["SPARRING"]
    assert "routine" not in data[0]


def test_coach_publishes_session(coach, api_as):
    session = TrainingSession.objects.create(date=timezone.localdate())
    response = api_as(coach).post(f"/api/sessions/{session.id}/publish/")
    assert response.json()["status"] == "PUBLISHED"
    assert response.json()["published_at"]
