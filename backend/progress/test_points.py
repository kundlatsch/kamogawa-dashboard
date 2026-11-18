"""Strengths and weaknesses: free-text lists the coach writes on the student profile."""
from accounts.models import User
from progress.models import StudentPoint


def test_coach_writes_edits_and_deletes_points(coach, make_user, api_as):
    ana = make_user("ana")
    client = api_as(coach)
    created = client.post("/api/student-points/", {"student": ana.id, "kind": "STRENGTH", "text": "  Jab rápido  "})
    assert created.status_code == 201 and created.json()["text"] == "Jab rápido"
    client.post("/api/student-points/", {"student": ana.id, "kind": "WEAKNESS", "text": "Guarda baixa"})
    point = created.json()["id"]
    assert client.patch(f"/api/student-points/{point}/", {"text": "Jab e direto"}).json()["text"] == "Jab e direto"
    assert [p["text"] for p in client.get(f"/api/student-points/?student={ana.id}").json()] == [
        "Jab e direto",
        "Guarda baixa",
    ]
    assert client.post("/api/student-points/", {"student": ana.id, "kind": "WEAKNESS", "text": " "}).status_code == 400
    assert client.delete(f"/api/student-points/{point}/").status_code == 204
    assert StudentPoint.objects.filter(student=ana).count() == 1


def test_student_reads_only_own_points_and_cannot_write(coach, make_user, api_as):
    ana, bia = make_user("ana"), make_user("bia")
    StudentPoint.objects.create(student=ana, kind="STRENGTH", text="Esquiva")
    StudentPoint.objects.create(student=bia, kind="WEAKNESS", text="Cardio")
    client = api_as(ana)
    assert [p["text"] for p in client.get("/api/me/points/").json()] == ["Esquiva"]
    assert client.get("/api/student-points/").status_code == 403
    assert client.post("/api/student-points/", {"student": ana.id, "kind": "STRENGTH", "text": "x"}).status_code == 403


def test_points_are_isolated_between_gyms(coach, make_user, api_as, other_gym):
    rival = make_user("rival", gym=other_gym)
    rival_coach = make_user("rival_coach", User.Role.COACH, gym=other_gym)
    point = StudentPoint.objects.create(student=rival, kind="STRENGTH", text="Rival")
    client = api_as(coach)
    assert client.get("/api/student-points/").json() == []
    assert client.patch(f"/api/student-points/{point.id}/", {"text": "x"}).status_code == 404
    assert client.post("/api/student-points/", {"student": rival.id, "kind": "STRENGTH", "text": "x"}).status_code == 400
    assert api_as(rival_coach).get("/api/student-points/").json()[0]["text"] == "Rival"


def test_coach_sets_level_and_student_cannot(coach, make_user, api_as):
    ana = make_user("ana")
    assert api_as(coach).patch(f"/api/students/{ana.id}/", {"level": "INTERMEDIATE_ADVANCED"}).json()["level"] == (
        "INTERMEDIATE_ADVANCED"
    )
    assert api_as(coach).patch(f"/api/students/{ana.id}/", {"level": "PRO"}).status_code == 400
    ana.refresh_from_db()
    api_as(ana).patch("/api/auth/me/", {"level": "ADVANCED"}, format="json")
    ana.refresh_from_db()
    assert ana.level == "INTERMEDIATE_ADVANCED"
    assert api_as(ana).get("/api/auth/me/").json()["level"] == "INTERMEDIATE_ADVANCED"
