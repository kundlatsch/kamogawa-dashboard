from datetime import timedelta

from django.utils import timezone

from accounts.models import User
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


def test_attendance_no_longer_creates_xp(coach, api_as, gym, make_user):
    ana = make_user("ana")
    check_in = CheckIn.objects.create(session=session_today(gym), student=ana)
    api_as(coach).patch(f"/api/checkins/{check_in.id}/", {"attended": True}, format="json")
    assert not XpEvent.objects.exists()
    progress = api_as(ana).get("/api/me/progress/").json()
    assert "xp" not in progress and "events" not in progress


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
    assert progress["missions"][0]["times_completed"] == 1 and progress["missions"][0]["can_complete"] is True
    assert coach_client.get("/api/leaderboard/").json()[0]["missions_completed"] == 1
    assert not XpEvent.objects.exists()  # missions are goals: no XP
    coach_client.post(f"/api/mission-completions/{pending[0]['id']}/reject/")
    assert student.get("/api/me/progress/").json()["missions"][0]["times_completed"] == 0


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


def test_students_cannot_use_coach_endpoints(api_as, make_user):
    client = api_as(make_user("ana"))
    for url in ["/api/leaderboard/", "/api/missions/", "/api/mission-completions/"]:
        assert client.get(url).status_code == 403, url
    assert client.get("/api/fighter-classes/").status_code == 200


def test_gamification_is_isolated_between_gyms(coach, api_as, gym, other_gym, make_user):
    rival = make_user("zed", gym=other_gym)
    rival_mission = Mission.objects.create(gym=other_gym, title="Rival")
    completion = MissionCompletion.objects.create(mission=rival_mission, student=rival)
    client = api_as(coach)
    assert client.get("/api/missions/").json() == []
    assert client.get("/api/mission-completions/").json() == []
    assert client.get("/api/leaderboard/").json() == []
    assert client.post(f"/api/mission-completions/{completion.id}/approve/").status_code == 404
    ana = make_user("ana")
    assert api_as(ana).post(f"/api/me/missions/{rival_mission.id}/complete/").status_code == 404


def test_leaderboard_counts_attendance_and_absences(coach, api_as, gym, make_user):
    ana, bia = make_user("ana"), make_user("bia")
    User.objects.filter(pk__in=[ana.pk, bia.pk]).update(date_joined=timezone.now() - timedelta(days=30))
    late = make_user("cris")  # joined today: earlier classes are not absences
    today = timezone.localdate()
    taken = [TrainingSession.objects.create(gym=gym, date=today - timedelta(days=d)) for d in (1, 2, 3)]
    CheckIn.objects.create(session=taken[0], student=ana, attended=True)
    CheckIn.objects.create(session=taken[1], student=ana, attended=True)
    CheckIn.objects.create(session=taken[2], student=bia, attended=False)
    CheckIn.objects.create(session=taken[0], student=bia, attended=True)
    untaken = TrainingSession.objects.create(gym=gym, date=today - timedelta(days=4))
    CheckIn.objects.create(session=untaken, student=bia)  # attendance never taken: not counted
    board = {row["student"]["display_name"]: row for row in api_as(coach).get("/api/leaderboard/").json()}
    assert (board["ana"]["attended"], board["ana"]["absences"]) == (2, 1)
    assert (board["bia"]["attended"], board["bia"]["absences"]) == (1, 2)
    assert (board[late.display_name]["attended"], board[late.display_name]["absences"]) == (0, 0)


def test_coach_edits_a_class_and_uploads_custom_art(coach, api_as, gym, other_gym, settings, tmp_path):
    from io import BytesIO

    from django.core.files.uploadedfile import SimpleUploadedFile
    from PIL import Image

    settings.MEDIA_ROOT = tmp_path
    client = api_as(coach)
    created = client.post(
        "/api/fighter-classes/", {"name": "Pressure Fighter", "art_key": "swarmer", "color": "#123456"}, format="json"
    )
    assert created.status_code == 201 and created.json()["art_key"] == "swarmer"
    fc_id = created.json()["id"]
    assert client.patch(f"/api/fighter-classes/{fc_id}/", {"art_key": "dragon"}, format="json").status_code == 400
    assert client.patch(f"/api/fighter-classes/{fc_id}/", {"description": "Pressiona"}, format="json").status_code == 200
    buffer = BytesIO()
    Image.new("RGBA", (900, 900), (10, 20, 30, 0)).save(buffer, "PNG")
    upload = SimpleUploadedFile("art.png", buffer.getvalue(), content_type="image/png")
    response = client.post(f"/api/fighter-classes/{fc_id}/image/", {"image": upload}, format="multipart")
    assert response.status_code == 200 and response.json()["image_url"].startswith("/media/fighter-classes/")
    assert client.delete(f"/api/fighter-classes/{fc_id}/image/").json()["image_url"] is None
    rival = FighterClass.objects.filter(gym=other_gym).first()
    assert client.post(f"/api/fighter-classes/{rival.id}/image/", {"image": upload}, format="multipart").status_code == 404


def test_default_classes_use_english_names(gym):
    assert set(FighterClass.objects.filter(gym=gym).values_list("name", flat=True)) == {
        "Out-Boxer",
        "Swarmer",
        "Slugger",
        "Boxer-Puncher",
        "Counterpuncher",
        "Switch-Hitter",
    }
