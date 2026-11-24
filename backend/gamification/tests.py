from datetime import timedelta

from django.utils import timezone

from accounts.models import User
from gamification.models import FighterClass, XpEvent
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


def test_coach_sets_an_optional_secondary_style_that_differs_from_the_main_one(coach, api_as, gym, other_gym, make_user):
    ana = make_user("ana")
    out_boxer, counter, slugger = FighterClass.objects.filter(gym=gym)[:3]
    rival = FighterClass.objects.filter(gym=other_gym).first()
    client = api_as(coach)
    url = f"/api/students/{ana.id}/"
    assert client.patch(url, {"secondary_fighter_class": counter.id}).status_code == 400  # no main style yet
    body = client.patch(url, {"fighter_class": out_boxer.id, "secondary_fighter_class": counter.id}).json()
    assert (body["fighter_class"], body["secondary_fighter_class"]) == (out_boxer.id, counter.id)
    assert client.patch(url, {"secondary_fighter_class": out_boxer.id}).status_code == 400
    assert client.patch(url, {"secondary_fighter_class": rival.id}).status_code == 400
    # Making the secondary style the main one drops it as secondary; a different main style keeps it.
    assert client.patch(url, {"fighter_class": slugger.id}).json()["secondary_fighter_class"] == counter.id
    assert client.patch(url, {"fighter_class": counter.id}).json()["secondary_fighter_class"] is None
    client.patch(url, {"secondary_fighter_class": slugger.id})
    assert client.patch(url, {"fighter_class": None}, format="json").json()["secondary_fighter_class"] is None
    # Students cannot change it themselves.
    client.patch(url, {"fighter_class": out_boxer.id, "secondary_fighter_class": counter.id})
    ana.refresh_from_db()
    api_as(ana).patch("/api/auth/me/", {"secondary_fighter_class": None}, format="json")
    ana.refresh_from_db()
    assert ana.secondary_fighter_class == counter


def session_today(gym):
    return TrainingSession.objects.create(gym=gym, date=timezone.localdate(), status=TrainingSession.Status.PUBLISHED)


def test_attendance_no_longer_creates_xp(coach, api_as, gym, make_user):
    ana = make_user("ana")
    check_in = CheckIn.objects.create(session=session_today(gym), student=ana)
    api_as(coach).patch(f"/api/checkins/{check_in.id}/", {"attended": True}, format="json")
    assert not XpEvent.objects.exists()


def test_students_cannot_use_coach_endpoints(api_as, make_user):
    client = api_as(make_user("ana"))
    assert client.get("/api/leaderboard/").status_code == 403
    assert client.get("/api/fighter-classes/").status_code == 200


def test_ranking_is_isolated_between_gyms(coach, api_as, other_gym, make_user):
    make_user("zed", gym=other_gym)
    assert api_as(coach).get("/api/leaderboard/").json() == []


def test_missions_are_gone(coach, api_as, make_user):
    make_user("ana")
    client = api_as(coach)
    for url in ["/api/missions/", "/api/mission-completions/", "/api/me/progress/"]:
        assert client.get(url).status_code == 404, url
    rows = client.get("/api/leaderboard/").json()
    assert set(rows[0]) == {"student", "fighter_class", "attended", "absences"}


def test_leaderboard_counts_attendance_and_absences(coach, api_as, gym, make_user):
    from training.absences import record_week, week_start

    ana, bia = make_user("ana"), make_user("bia")
    User.objects.filter(pk__in=[ana.pk, bia.pk]).update(date_joined=timezone.now() - timedelta(days=60))
    User.objects.filter(pk__in=[ana.pk, bia.pk]).update(weekly_classes=2)
    last_monday = week_start(timezone.localdate()) - timedelta(days=7)
    monday, wednesday = (TrainingSession.objects.create(gym=gym, date=last_monday + timedelta(days=d)) for d in (0, 2))
    CheckIn.objects.create(session=monday, student=ana)
    CheckIn.objects.create(session=wednesday, student=ana, attended=True)
    CheckIn.objects.create(session=monday, student=bia, attended=False)  # checked in, did not come
    record_week(last_monday)
    this_week = TrainingSession.objects.create(gym=gym, date=week_start(timezone.localdate()))
    CheckIn.objects.create(session=this_week, student=ana, attended=False)  # week not closed yet
    board = {row["student"]["display_name"]: row for row in api_as(coach).get("/api/leaderboard/").json()}
    assert (board["ana"]["attended"], board["ana"]["absences"]) == (2, 1)
    assert (board["bia"]["attended"], board["bia"]["absences"]) == (0, 2)


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
    assert client.patch(f"/api/fighter-classes/{fc_id}/", {"art_key": "champion"}, format="json").status_code == 200
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


def test_students_see_a_read_only_ranking(coach, api_as, gym, other_gym, make_user):
    ana = make_user("ana")
    make_user("zed", gym=other_gym)
    client = api_as(ana)
    rows = client.get("/api/ranking/").json()
    assert [row["student"]["display_name"] for row in rows] == ["ana"]
    assert set(rows[0]) == {"student", "fighter_class", "attended", "absences"}
    assert client.post("/api/ranking/").status_code == 405
    assert client.get("/api/leaderboard/").status_code == 403
