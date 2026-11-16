from datetime import date

from progress.models import CoachNote, FocusOption, Homework, WeeklyFocus


def test_coach_sets_two_focuses_per_student_and_week(coach, api_as, gym, make_user):
    student = make_user("ana")
    guard = FocusOption.objects.create(gym=gym, name="Guarda alta")
    jab = FocusOption.objects.create(gym=gym, name="Jab")
    client = api_as(coach)
    base = {"student": student.id, "week": "2026-11-19"}  # a Thursday
    assert client.post("/api/weekly-focuses/set/", {**base, "position": 1, "focus": guard.id}).status_code == 200
    client.post("/api/weekly-focuses/set/", {**base, "position": 2, "focus": jab.id, "note": "Mais rápido"})
    client.post("/api/weekly-focuses/set/", {**base, "position": 1, "focus": jab.id})
    assert client.post("/api/weekly-focuses/set/", {**base, "position": 3, "focus": jab.id}).status_code == 400
    focuses = client.get("/api/weekly-focuses/?week=2026-11-16").json()
    assert [(f["position"], f["focus"]) for f in focuses] == [(1, jab.id), (2, jab.id)]
    assert focuses[0]["week_start"] == "2026-11-16"
    response = client.post("/api/weekly-focuses/set/", {**base, "position": 2, "focus": None}, format="json")
    assert response.status_code == 204 and WeeklyFocus.objects.count() == 1


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


def test_student_week_shows_own_focuses(coach, api_as, gym, make_user):
    ana, bia = make_user("ana"), make_user("bia")
    guard = FocusOption.objects.create(gym=gym, name="Guarda alta")
    WeeklyFocus.objects.create(student=ana, week_start=date(2026, 11, 16), position=1, focus=guard)
    WeeklyFocus.objects.create(student=bia, week_start=date(2026, 11, 16), position=1, focus=guard)
    week = api_as(ana).get("/api/me/week/?week=2026-11-16").json()
    assert [f["focus_detail"]["name"] for f in week["focuses"]] == ["Guarda alta"]


def test_weekly_records_are_isolated_between_gyms(coach, api_as, gym, other_gym, make_user):
    rival = make_user("zed", gym=other_gym)
    rival_focus = FocusOption.objects.create(gym=other_gym, name="Rival")
    rival_note = CoachNote.objects.create(student=rival, body="secret")
    rival_homework = Homework.objects.create(gym=other_gym, week_start=date(2026, 11, 16), title="x", is_broadcast=True)
    WeeklyFocus.objects.create(student=rival, week_start=date(2026, 11, 16), position=1, focus=rival_focus)
    own = make_user("ana")
    client = api_as(coach)
    assert client.get("/api/coach-notes/").json() == []
    assert client.get("/api/homework/").json() == []
    assert client.get("/api/weekly-focuses/?week=2026-11-16").json() == []
    assert client.get("/api/focus-options/").json() == []
    assert client.get(f"/api/coach-notes/{rival_note.id}/").status_code == 404
    assert client.patch(f"/api/homework/{rival_homework.id}/", {"title": "y"}).status_code == 404
    assert client.post("/api/coach-notes/", {"student": rival.id, "body": "x"}).status_code == 400
    attempts = [{"student": rival.id, "focus": None}, {"student": own.id, "focus": rival_focus.id}]
    for attempt in attempts:
        payload = {**attempt, "week": "2026-11-16", "position": 1}
        assert client.post("/api/weekly-focuses/set/", payload, format="json").status_code == 400, attempt
    payload = {"week_start": "2026-11-16", "title": "x", "participants": [rival.id]}
    assert client.post("/api/homework/", payload, format="json").status_code == 400
    assert api_as(own).get("/api/me/week/?week=2026-11-16").json()["homework"] == []
