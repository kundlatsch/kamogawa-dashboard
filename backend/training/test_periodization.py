from datetime import date

import pytest

from training.models import Macrocycle, Mesocycle, Microcycle, MicrocyclePhase, TrainingSession, Valence


def test_new_gym_gets_default_valences_and_phases(gym):
    assert Valence.objects.filter(gym=gym).count() == 6
    assert MicrocyclePhase.objects.filter(gym=gym).count() == 4


def test_seeded_lists_are_editable_and_deleting_archives(coach, api_as, gym):
    client = api_as(coach)
    valence = Valence.objects.filter(gym=gym).first()
    assert client.patch(f"/api/valences/{valence.id}/", {"name": "Explosão"}).status_code == 200
    assert client.delete(f"/api/valences/{valence.id}/").status_code == 204
    valence.refresh_from_db()
    assert valence.archived and valence.name == "Explosão"
    assert len(client.get("/api/valences/").json()) == 5


def test_valence_names_are_unique_per_gym(coach, api_as, gym):
    name = Valence.objects.filter(gym=gym).first().name
    assert api_as(coach).post("/api/valences/", {"name": name.upper()}).status_code == 400


def build_plan(coach, api_as, gym):
    client = api_as(coach)
    speed, strength = Valence.objects.filter(gym=gym)[:2]
    macro = client.post("/api/macrocycles/", {"name": "Semestre 1", "start_date": "2026-12-07"}).json()
    first = client.post("/api/mesocycles/", {"macrocycle": macro["id"], "valence": speed.id}).json()
    second = client.post("/api/mesocycles/", {"macrocycle": macro["id"], "valence": strength.id}).json()
    return client, macro, first, second


def test_new_mesocycle_gets_one_week_per_phase_and_dates_are_derived(coach, api_as, gym):
    client, macro, _, _ = build_plan(coach, api_as, gym)
    plan = client.get(f"/api/macrocycles/{macro['id']}/").json()
    meso1, meso2 = plan["mesocycles"]
    assert [m["phase"]["order"] for m in meso1["microcycles"]] == [0, 1, 2, 3]
    assert (meso1["start_date"], meso1["end_date"]) == ("2026-12-07", "2027-01-03")
    assert (meso2["start_date"], meso2["end_date"]) == ("2027-01-04", "2027-01-31")
    assert plan["end_date"] == "2027-01-31"


def test_reordering_mesocycles_shifts_dates(coach, api_as, gym):
    client, macro, first, second = build_plan(coach, api_as, gym)
    response = client.post(
        "/api/mesocycles/reorder/", {"macrocycle": macro["id"], "ids": [second["id"], first["id"]]}, format="json"
    )
    assert response.status_code == 204
    plan = client.get(f"/api/macrocycles/{macro['id']}/").json()
    assert plan["mesocycles"][0]["id"] == second["id"]
    assert plan["mesocycles"][0]["start_date"] == "2026-12-07"


def test_reorder_requires_every_item(coach, api_as, gym):
    client, macro, first, _ = build_plan(coach, api_as, gym)
    response = client.post(
        "/api/mesocycles/reorder/", {"macrocycle": macro["id"], "ids": [first["id"]]}, format="json"
    )
    assert response.status_code == 400


def test_resizing_a_microcycle_shifts_later_dates(coach, api_as, gym):
    client, macro, first, _ = build_plan(coach, api_as, gym)
    week = Microcycle.objects.filter(mesocycle_id=first["id"]).first()
    assert client.patch(f"/api/microcycles/{week.id}/", {"length_days": 14}).status_code == 200
    assert client.patch(f"/api/microcycles/{week.id}/", {"length_days": 0}).status_code == 400
    plan = client.get(f"/api/macrocycles/{macro['id']}/").json()
    assert plan["mesocycles"][1]["start_date"] == "2027-01-11"


def test_session_inherits_microcycle_objective_unless_overridden(coach, api_as, gym):
    client, _, first, _ = build_plan(coach, api_as, gym)
    second_week = Microcycle.objects.filter(mesocycle_id=first["id"])[1]
    client.patch(f"/api/microcycles/{second_week.id}/", {"objective": "Velocidade de saída do jab"})
    inside = TrainingSession.objects.create(gym=gym, date=date(2026, 12, 16))
    outside = TrainingSession.objects.create(gym=gym, date=date(2026, 12, 1))
    sessions = {s["id"]: s for s in client.get("/api/sessions/").json()}
    assert sessions[inside.id]["objective"] == "Velocidade de saída do jab"
    assert sessions[outside.id]["objective"] == ""
    client.patch(f"/api/sessions/{inside.id}/", {"objective_override": "Sparring técnico"})
    assert client.get(f"/api/sessions/{inside.id}/").json()["objective"] == "Sparring técnico"


def test_current_cycle_for_students(coach, api_as, gym, make_user):
    build_plan(coach, api_as, gym)
    student = api_as(make_user("ana"))
    current = student.get("/api/cycles/current/?date=2027-01-05").json()
    assert current["macrocycle"]["name"] == "Semestre 1"
    second = current["macrocycle"]["mesocycles"][1]
    assert current["mesocycle"] == second["id"]
    assert current["microcycle"] == second["microcycles"][0]["id"]
    assert student.get("/api/cycles/current/?date=2026-01-01").json()["macrocycle"] is None


def test_students_read_the_plan_but_cannot_change_it(coach, api_as, gym, make_user):
    _, _, first, _ = build_plan(coach, api_as, gym)
    student = api_as(make_user("ana"))
    assert student.get("/api/macrocycles/").status_code == 200
    assert student.post("/api/macrocycles/", {"name": "x", "start_date": "2027-01-01"}).status_code == 403
    assert student.patch(f"/api/mesocycles/{first['id']}/", {"name": "x"}).status_code == 403
    assert student.post("/api/valences/", {"name": "x"}).status_code == 403


@pytest.fixture
def rival_plan(other_gym):
    valence = Valence.objects.filter(gym=other_gym).first()
    macro = Macrocycle.objects.create(gym=other_gym, name="Rival", start_date=date(2026, 12, 7))
    meso = Mesocycle.objects.create(macrocycle=macro, valence=valence)
    week = Microcycle.objects.create(mesocycle=meso, objective="Rival objective")
    return {"valence": valence, "macro": macro, "meso": meso, "week": week}


def test_cycles_are_isolated_between_gyms(coach, api_as, gym, rival_plan):
    client = api_as(coach)
    own_valence = Valence.objects.filter(gym=gym).first()
    assert client.get("/api/macrocycles/").json() == []
    assert rival_plan["valence"].id not in [v["id"] for v in client.get("/api/valences/").json()]
    assert client.get(f"/api/macrocycles/{rival_plan['macro'].id}/").status_code == 404
    assert client.patch(f"/api/mesocycles/{rival_plan['meso'].id}/", {"name": "x"}).status_code == 404
    assert client.patch(f"/api/microcycles/{rival_plan['week'].id}/", {"objective": "x"}).status_code == 404
    assert client.patch(f"/api/valences/{rival_plan['valence'].id}/", {"name": "x"}).status_code == 404

    own_macro = client.post("/api/macrocycles/", {"name": "Own", "start_date": "2026-12-07"}).json()
    attempts = [
        ("/api/mesocycles/", {"macrocycle": rival_plan["macro"].id, "valence": own_valence.id}),
        ("/api/mesocycles/", {"macrocycle": own_macro["id"], "valence": rival_plan["valence"].id}),
        ("/api/microcycles/", {"mesocycle": rival_plan["meso"].id}),
    ]
    for url, payload in attempts:
        assert client.post(url, payload).status_code == 400, payload

    # The rival's plan never leaks into this gym's session objectives or current cycle.
    TrainingSession.objects.create(gym=gym, date=date(2026, 12, 8))
    assert client.get("/api/sessions/").json()[0]["objective"] == ""
    assert client.get("/api/cycles/current/?date=2026-12-08").json()["macrocycle"] is None
    client.post("/api/mesocycles/", {"macrocycle": own_macro["id"], "valence": own_valence.id})
    assert client.get("/api/cycles/current/?date=2026-12-08").json()["macrocycle"]["name"] == "Own"
