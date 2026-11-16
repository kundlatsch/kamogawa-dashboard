from datetime import datetime, time, timedelta

import pytest
from django.utils import timezone

from notifications.models import Notification
from training.models import CheckIn, TrainingSession


def published(gym, start: datetime) -> TrainingSession:
    local = timezone.localtime(start)
    return TrainingSession.objects.create(
        gym=gym, date=local.date(), start_time=local.time().replace(microsecond=0), status=TrainingSession.Status.PUBLISHED
    )


@pytest.fixture
def tomorrow_class(gym):
    return published(gym, timezone.now() + timedelta(days=1))


def test_student_checks_in_and_cancels_before_the_deadline(api_as, make_user, tomorrow_class):
    ana = make_user("ana")
    client = api_as(ana)
    url = f"/api/me/checkins/{tomorrow_class.id}/"
    assert client.put(url, {}, format="json").status_code == 201
    upcoming = client.get("/api/me/upcoming/").json()
    assert upcoming[0]["checkin"]["open"] is True
    assert upcoming[0]["checkin"]["mine"]["has_pain"] is False
    assert client.delete(url).status_code == 204
    assert not CheckIn.objects.exists()


def test_check_in_closes_at_the_deadline(api_as, make_user, gym):
    gym.checkin_deadline_minutes = 120
    gym.save()
    soon = published(gym, timezone.now() + timedelta(minutes=90))
    response = api_as(make_user("ana")).put(f"/api/me/checkins/{soon.id}/", {}, format="json")
    assert response.status_code == 400


def test_drafts_can_be_checked_in_but_cancelled_classes_cannot(api_as, make_user, gym, tomorrow_class):
    client = api_as(make_user("ana"))
    tomorrow_class.status = TrainingSession.Status.DRAFT
    tomorrow_class.save()
    assert client.put(f"/api/me/checkins/{tomorrow_class.id}/", {}, format="json").status_code == 201
    tomorrow_class.status = TrainingSession.Status.CANCELLED
    tomorrow_class.save()
    assert client.put(f"/api/me/checkins/{tomorrow_class.id}/", {}, format="json").status_code == 400


def test_pain_report_alerts_coaches_once(api_as, make_user, coach, tomorrow_class):
    ana = make_user("ana")
    client = api_as(ana)
    url = f"/api/me/checkins/{tomorrow_class.id}/"
    report = {"has_pain": True, "pain_location": "Ombro direito", "pain_level": 6}
    assert client.put(url, report, format="json").status_code == 201
    client.put(url, {**report, "pain_level": 7}, format="json")
    alerts = Notification.objects.filter(kind=Notification.Kind.INJURY_REPORTED)
    assert [(n.recipient, n.subject) for n in alerts] == [(coach, ana)]
    assert client.put(url, {**report, "pain_level": 11}, format="json").status_code == 400
    coach_view = api_as(coach).get("/api/notifications/").json()["results"][0]
    assert coach_view["subject"]["display_name"] == "ana"


def test_no_pain_clears_the_details(api_as, make_user, tomorrow_class):
    client = api_as(make_user("ana"))
    url = f"/api/me/checkins/{tomorrow_class.id}/"
    client.put(url, {"has_pain": False, "pain_location": "joelho", "pain_level": 3}, format="json")
    check_in = CheckIn.objects.get()
    assert (check_in.pain_location, check_in.pain_level) == ("", None)


def test_coach_lists_adds_and_confirms_attendance(api_as, make_user, coach, tomorrow_class):
    ana, bia = make_user("ana"), make_user("bia")
    api_as(ana).put(f"/api/me/checkins/{tomorrow_class.id}/", {}, format="json")
    client = api_as(coach)
    added = client.post("/api/checkins/", {"session": tomorrow_class.id, "student": bia.id})
    assert added.status_code == 201 and added.json()["added_by_coach"] is True
    assert client.post("/api/checkins/", {"session": tomorrow_class.id, "student": bia.id}).status_code == 400
    listed = client.get(f"/api/checkins/?session={tomorrow_class.id}").json()
    assert sorted(c["student"] for c in listed) == [ana.id, bia.id]
    response = client.patch(f"/api/checkins/{listed[0]['id']}/", {"attended": True}, format="json")
    assert response.json()["attended"] is True
    assert api_as(ana).get("/api/checkins/").status_code == 403


def test_coach_cannot_check_in_for_themselves(api_as, coach, tomorrow_class):
    assert api_as(coach).put(f"/api/me/checkins/{tomorrow_class.id}/", {}, format="json").status_code == 403


def test_check_ins_are_isolated_between_gyms(api_as, make_user, coach, gym, other_gym):
    rival_session = published(other_gym, timezone.now() + timedelta(days=1))
    rival_student = make_user("zed", gym=other_gym)
    rival_check_in = CheckIn.objects.create(session=rival_session, student=rival_student)
    own_session = published(gym, timezone.now() + timedelta(days=1))
    ana = make_user("ana")
    client = api_as(coach)
    assert client.get("/api/checkins/").json() == []
    assert client.patch(f"/api/checkins/{rival_check_in.id}/", {"attended": True}, format="json").status_code == 404
    assert client.post("/api/checkins/", {"session": rival_session.id, "student": ana.id}).status_code == 400
    assert client.post("/api/checkins/", {"session": own_session.id, "student": rival_student.id}).status_code == 400
    assert api_as(ana).put(f"/api/me/checkins/{rival_session.id}/", {}, format="json").status_code == 404


def test_coach_sets_the_deadline(api_as, coach, gym):
    response = api_as(coach).patch("/api/my-gym/", {"checkin_deadline_minutes": 60})
    assert response.status_code == 200 and response.json()["checkin_deadline_minutes"] == 60
    assert api_as(coach).patch("/api/my-gym/", {"checkin_deadline_minutes": -5}).status_code == 400


def test_session_without_time_uses_the_schedule_default(gym):
    from training.checkins import session_start
    from training.models import WeeklySchedule

    WeeklySchedule.for_gym(gym)
    session = TrainingSession.objects.create(gym=gym, date=timezone.localdate())
    assert timezone.localtime(session_start(session)).time() == time(19, 0)


def test_coach_cancels_and_restores_a_class(api_as, make_user, coach, gym, tomorrow_class):
    from notifications.models import Notification

    ana = make_user("ana")
    client = api_as(coach)
    assert client.post(f"/api/sessions/{tomorrow_class.id}/cancel/", {}).status_code == 400  # reason required
    response = client.post(f"/api/sessions/{tomorrow_class.id}/cancel/", {"reason": "Feriado"})
    assert response.json()["status"] == "CANCELLED" and response.json()["cancel_reason"] == "Feriado"
    assert Notification.objects.filter(recipient=ana, kind=Notification.Kind.SESSION_CANCELLED).exists()
    entry = next(e for e in api_as(ana).get("/api/me/calendar/").json() if e["id"] == tomorrow_class.id)
    assert entry["cancelled"] is True and entry["cancel_reason"] == "Feriado"
    restored = client.post(f"/api/sessions/{tomorrow_class.id}/restore/").json()
    assert restored["status"] == "PUBLISHED" and restored["cancel_reason"] == ""
    assert not Notification.objects.filter(kind=Notification.Kind.SESSION_CANCELLED).exists()
    assert api_as(ana).post(f"/api/sessions/{tomorrow_class.id}/cancel/", {"reason": "x"}).status_code == 403


def test_regular_weekdays_can_be_checked_in_ahead_of_time(api_as, make_user, gym):
    from training.models import WeeklySchedule

    schedule = WeeklySchedule.for_gym(gym)
    schedule.training_weekdays = list(range(7))
    schedule.save()
    client = api_as(make_user("ana"))
    entries = client.get("/api/me/calendar/").json()
    future = [e for e in entries if e["date"] > str(timezone.localdate())]
    assert future and all(e["id"] for e in future)
    assert client.put(f"/api/me/checkins/{future[-1]['id']}/", {}, format="json").status_code == 201
