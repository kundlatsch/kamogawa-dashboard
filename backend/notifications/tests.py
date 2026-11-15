from datetime import date

import pytest

from notifications.models import Notification
from training.models import Assignment, Drill, TrainingSession


@pytest.fixture
def students(make_user):
    return [make_user(name) for name in ["a", "b", "c"]]


def publish(client, session):
    return client.post(f"/api/sessions/{session.id}/publish/")


def test_publishing_sparring_alerts_every_student(coach, api_as, students):
    session = TrainingSession.objects.create(gym=coach.gym, date=date(2026, 11, 21), kind=TrainingSession.Kind.SPARRING)
    publish(api_as(coach), session)
    assert Notification.objects.filter(kind="SPARRING").count() == 3


def test_regular_session_alerts_only_students_with_drills(coach, api_as, students):
    session = TrainingSession.objects.create(gym=coach.gym, date=date(2026, 11, 16))
    assignment = Assignment.objects.create(session=session, drill=Drill.objects.create(gym=coach.gym, name="Bag"))
    assignment.participants.set([students[0]])
    publish(api_as(coach), session)
    assert list(Notification.objects.values_list("recipient", flat=True)) == [students[0].id]


def test_broadcast_alerts_everyone(coach, api_as, students):
    session = TrainingSession.objects.create(gym=coach.gym, date=date(2026, 11, 16))
    Assignment.objects.create(session=session, drill=Drill.objects.create(gym=coach.gym, name="Warm-up"), is_broadcast=True)
    publish(api_as(coach), session)
    assert Notification.objects.count() == 3


def test_republishing_does_not_duplicate(coach, api_as, students):
    session = TrainingSession.objects.create(gym=coach.gym, date=date(2026, 11, 21), kind=TrainingSession.Kind.SPARRING)
    client = api_as(coach)
    publish(client, session)
    client.post(f"/api/sessions/{session.id}/unpublish/")
    publish(client, session)
    assert Notification.objects.count() == 3


def test_student_lists_and_reads_own_notifications(coach, api_as, students):
    session = TrainingSession.objects.create(gym=coach.gym, date=date(2026, 11, 21), kind=TrainingSession.Kind.SPARRING)
    publish(api_as(coach), session)
    client = api_as(students[0])
    data = client.get("/api/notifications/").json()
    assert data["unread"] == 1
    assert data["results"][0]["session"]["kind"] == "SPARRING"
    client.post(f"/api/notifications/{data['results'][0]['id']}/read/")
    assert client.get("/api/notifications/").json()["unread"] == 0


def test_students_cannot_read_others_notifications(coach, api_as, students):
    session = TrainingSession.objects.create(gym=coach.gym, date=date(2026, 11, 21), kind=TrainingSession.Kind.SPARRING)
    publish(api_as(coach), session)
    other = Notification.objects.get(recipient=students[1])
    assert api_as(students[0]).post(f"/api/notifications/{other.id}/read/").status_code == 404
