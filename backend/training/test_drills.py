from training.models import Drill


def test_coach_creates_drill_with_card_look(coach, api_as):
    response = api_as(coach).post(
        "/api/drills/",
        {
            "name": "Shoulder tap",
            "emoji": "👊",
            "color": "#e9b949",
            "youtube_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        },
    )
    assert response.status_code == 201
    drill = Drill.objects.get()
    assert drill.created_by == coach
    assert drill.color == "#e9b949"


def test_invalid_color_is_rejected(coach, api_as):
    response = api_as(coach).post("/api/drills/", {"name": "Bag", "color": "red"})
    assert response.status_code == 400


def test_delete_archives_and_hides_drill(coach, api_as):
    drill = Drill.objects.create(name="Bag work")
    client = api_as(coach)
    client.delete(f"/api/drills/{drill.id}/")
    drill.refresh_from_db()
    assert drill.archived
    assert client.get("/api/drills/").json() == []
    assert len(client.get("/api/drills/?include_archived=true").json()) == 1


def test_students_cannot_access_library(make_user, api_as):
    student = make_user("ana")
    assert api_as(student).get("/api/drills/").status_code == 403
