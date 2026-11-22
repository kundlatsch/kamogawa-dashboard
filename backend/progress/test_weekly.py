from datetime import date

from progress.models import CoachNote, Homework


def test_coach_writes_free_text_focuses_that_only_the_student_reads(coach, api_as, gym, make_user):
    ana, bia = make_user("ana"), make_user("bia")
    text = "Guarda alta depois do jab\nRespirar nos clinches"
    assert api_as(coach).patch(f"/api/students/{ana.id}/", {"focus_text": text}).json()["focus_text"] == text
    ana.refresh_from_db()  # a real request loads the signed-in user fresh from the database
    assert api_as(ana).get("/api/me/week/?week=2026-11-16").json()["focus_text"] == text
    assert api_as(bia).get("/api/me/week/?week=2026-11-16").json()["focus_text"] == ""
    api_as(ana).patch("/api/auth/me/", {"focus_text": "nada"}, format="json")
    ana.refresh_from_db()
    assert ana.focus_text == text

def test_coach_notes_and_visibility(coach, api_as, gym, make_user):
    student = make_user("ana")
    client = api_as(coach)
    # JSON like the frontend sends: visible_to_student defaults to true when omitted.
    client.post("/api/coach-notes/", {"student": student.id, "body": "Ótima evolução na defesa."}, format="json")
    hidden = {"student": student.id, "body": "Conversar sobre o joelho.", "visible_to_student": False}
    client.post("/api/coach-notes/", hidden, format="json")
    assert len(client.get(f"/api/coach-notes/?student={student.id}").json()) == 2
    notes = api_as(student).get("/api/me/week/").json()["notes"]
    assert [n["body"] for n in notes] == ["Ótima evolução na defesa."]
    assert notes[0]["author_name"] == "coach"
    assert api_as(student).get("/api/coach-notes/").status_code == 403


def test_homework_for_some_students_or_everyone(coach, api_as, gym, make_user):
    ana, bia = make_user("ana"), make_user("bia")
    client = api_as(coach)
    personal = client.post(
        "/api/homework/", {"week_start": "2026-11-18", "title": "Sombra 3x3", "participants": [ana.id]}, format="json"
    )
    assert personal.status_code == 201 and personal.json()["week_start"] == "2026-11-16"
    client.post("/api/homework/", {"week_start": "2026-11-16", "title": "Corrida 20 min", "is_broadcast": True})
    client.post("/api/homework/", {"week_start": "2026-11-23", "title": "Semana seguinte", "is_broadcast": True})
    assert client.post("/api/homework/", {"week_start": "2026-11-16", "title": "Sem alunos"}).status_code == 400

    ana_week = api_as(ana).get("/api/me/week/?week=2026-11-20").json()
    assert sorted(h["title"] for h in ana_week["homework"]) == ["Corrida 20 min", "Sombra 3x3"]
    assert "participants" not in ana_week["homework"][0]
    bia_week = api_as(bia).get("/api/me/week/?week=2026-11-20").json()
    assert [h["title"] for h in bia_week["homework"]] == ["Corrida 20 min"]


def test_weekly_records_are_isolated_between_gyms(coach, api_as, gym, other_gym, make_user):
    rival = make_user("zed", gym=other_gym)
    rival_note = CoachNote.objects.create(student=rival, body="secret")
    rival_homework = Homework.objects.create(gym=other_gym, week_start=date(2026, 11, 16), title="x", is_broadcast=True)
    own = make_user("ana")
    client = api_as(coach)
    assert client.get("/api/coach-notes/").json() == []
    assert client.get("/api/homework/").json() == []
    assert client.get(f"/api/coach-notes/{rival_note.id}/").status_code == 404
    assert client.patch(f"/api/homework/{rival_homework.id}/", {"title": "y"}).status_code == 404
    assert client.post("/api/coach-notes/", {"student": rival.id, "body": "x"}).status_code == 400
    assert client.patch(f"/api/students/{rival.id}/", {"focus_text": "x"}).status_code == 404
    payload = {"week_start": "2026-11-16", "title": "x", "participants": [rival.id]}
    assert client.post("/api/homework/", payload, format="json").status_code == 400
    assert api_as(own).get("/api/me/week/?week=2026-11-16").json()["homework"] == []
