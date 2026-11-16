from datetime import timedelta

from django.utils import timezone

from gamification.models import FighterClass, Mission, MissionCompletion, XpEvent
from training.models import CheckIn, TrainingSession


def test_new_gym_gets_the_six_fighter_classes_with_art(gym):
    classes = FighterClass.objects.filter(gym=gym)
    assert classes.count() == 6
    assert set(classes.values_list("art_key", flat=True)) == {
        "out-boxer",
        "swarmer",
        "slugger",
        "boxer-puncher",
        "counterpuncher",
        "switch-hitter",
    }


def test_coach_assigns_a_class_but_students_cannot(coach, api_as, gym, other_gym, make_user):
    ana = make_user("ana")
    own = FighterClass.objects.filter(gym=gym).first()
    rival = FighterClass.objects.filter(gym=other_gym).first()
    client = api_as(coach)
    assert client.patch(f"/api/students/{ana.id}/", {"fighter_class": own.id}).json()["fighter_class"] == own.id
    assert client.patch(f"/api/students/{ana.id}/", {"fighter_class": rival.id}).status_code == 400
    ana.refresh_from_db()  # a real request loads the signed-in user fresh from the database
    api_as(ana).patch("/api/auth/me/", {"fighter_class": None}, format="json")
    ana.refresh_from_db()
    assert ana.fighter_class == own


def session_today(gym):
    return TrainingSession.objects.create(gym=gym, date=timezone.localdate(), status=TrainingSession.Status.PUBLISHED)


def test_confirmed_attendance_grants_xp_once_and_undo_removes_it(coach, api_as, gym, make_user):
    ana = make_user("ana")
    session = session_today(gym)
    check_in = CheckIn.objects.create(session=session, student=ana)
    client = api_as(coach)
    client.patch(f"/api/checkins/{check_in.id}/", {"attended": True}, format="json")
    client.patch(f"/api/checkins/{check_in.id}/", {"attended": True}, format="json")
    assert list(XpEvent.objects.values_list("amount", flat=True)) == [10]
    client.patch(f"/api/checkins/{check_in.id}/", {"attended": False}, format="json")
    assert not XpEvent.objects.exists()
    client.patch(f"/api/checkins/{check_in.id}/", {"attended": True}, format="json")
    client.delete(f"/api/checkins/{check_in.id}/")
    assert not XpEvent.objects.exists()


def test_levels_follow_the_gym_settings(coach, api_as, gym, make_user):
    ana = make_user("ana")
    api_as(coach).patch("/api/my-gym/", {"attendance_xp": 30, "xp_per_level": 50})
    for days in range(3):
        session = TrainingSession.objects.create(gym=gym, date=timezone.localdate() - timedelta(days=days))
        CheckIn.objects.create(session=session, student=ana, attended=True)
    progress = api_as(ana).get("/api/me/progress/").json()
    assert (progress["xp"], progress["level"], progress["level_xp"]) == (90, 2, 40)
    board = api_as(coach).get("/api/leaderboard/").json()
    assert board[0]["student"]["id"] == ana.id and board[0]["xp"] == 90


def test_mission_flow_complete_approve_and_repeat(coach, api_as, gym, make_user):
    ana = make_user("ana")
    coach_client, student = api_as(coach), api_as(ana)
    mission = coach_client.post("/api/missions/", {"title": "100 polichinelos", "xp_reward": 25, "repeatable": True}, format="json").json()
    url = f"/api/me/missions/{mission['id']}/complete/"
    assert student.post(url, {"note": "feito!"}).status_code == 201
    assert student.post(url).status_code == 400  # still pending
    pending = coach_client.get("/api/mission-completions/?status=PENDING").json()
    assert coach_client.get("/api/leaderboard/").json()[0]["pending_missions"] == 1
    coach_client.post(f"/api/mission-completions/{pending[0]['id']}/approve/")
    progress = student.get("/api/me/progress/").json()
    assert progress["xp"] == 25
    assert progress["missions"][0]["times_completed"] == 1 and progress["missions"][0]["can_complete"] is True
    coach_client.post(f"/api/mission-completions/{pending[0]['id']}/reject/")
    assert student.get("/api/me/progress/").json()["xp"] == 0


def test_one_time_missions_and_inactive_ones(coach, api_as, gym, make_user):
    ana = make_user("ana")
    once = Mission.objects.create(gym=gym, title="Uma vez", repeatable=False)
    hidden = Mission.objects.create(gym=gym, title="Pausada", active=False)
    expired = Mission.objects.create(gym=gym, title="Velha", ends_on=timezone.localdate() - timedelta(days=1))
    client = api_as(ana)
    assert client.post(f"/api/me/missions/{once.id}/complete/").status_code == 201
    MissionCompletion.objects.update(status=MissionCompletion.Status.APPROVED)
    assert client.post(f"/api/me/missions/{once.id}/complete/").status_code == 400
    for mission in (hidden, expired):
        assert client.post(f"/api/me/missions/{mission.id}/complete/").status_code == 404
    assert [m["title"] for m in client.get("/api/me/progress/").json()["missions"]] == ["Uma vez"]
    assert api_as(coach).post(f"/api/me/missions/{once.id}/complete/").status_code == 403


def test_manual_xp_can_be_granted_and_removed(coach, api_as, make_user, gym):
    ana = make_user("ana")
    client = api_as(coach)
    event = client.post("/api/xp-events/", {"student": ana.id, "amount": 15, "note": "Ajudou na limpeza"}).json()
    assert event["reason"] == "MANUAL"
    assert client.post("/api/xp-events/", {"student": ana.id, "amount": 0}).status_code == 400
    assert client.delete(f"/api/xp-events/{event['id']}/").status_code == 204
    session = session_today(gym)
    CheckIn.objects.create(session=session, student=ana, attended=True)
    attendance = XpEvent.objects.get()
    assert client.delete(f"/api/xp-events/{attendance.id}/").status_code == 400


def test_students_cannot_use_coach_endpoints(api_as, make_user):
    client = api_as(make_user("ana"))
    for url in ["/api/leaderboard/", "/api/missions/", "/api/mission-completions/", "/api/xp-events/"]:
        assert client.get(url).status_code == 403, url
    assert client.get("/api/fighter-classes/").status_code == 200


def test_gamification_is_isolated_between_gyms(coach, api_as, gym, other_gym, make_user):
    rival = make_user("zed", gym=other_gym)
    rival_mission = Mission.objects.create(gym=other_gym, title="Rival")
    completion = MissionCompletion.objects.create(mission=rival_mission, student=rival)
    rival_event = XpEvent.objects.create(student=rival, amount=50, reason=XpEvent.Reason.MANUAL)
    client = api_as(coach)
    assert client.get("/api/missions/").json() == []
    assert client.get("/api/mission-completions/").json() == []
    assert client.get("/api/xp-events/").json() == []
    assert client.get("/api/leaderboard/").json() == []
    assert client.post(f"/api/mission-completions/{completion.id}/approve/").status_code == 404
    assert client.delete(f"/api/xp-events/{rival_event.id}/").status_code == 404
    assert client.post("/api/xp-events/", {"student": rival.id, "amount": 5}).status_code == 400
    ana = make_user("ana")
    assert api_as(ana).post(f"/api/me/missions/{rival_mission.id}/complete/").status_code == 404
