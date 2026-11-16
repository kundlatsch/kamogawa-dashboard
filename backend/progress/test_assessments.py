from datetime import date

from progress.models import Assessment, Metric


def test_new_gym_gets_physical_and_technical_metrics(gym):
    groups = list(Metric.objects.filter(gym=gym).values_list("group", flat=True))
    assert groups.count("PHYSICAL") == 4 and groups.count("TECHNICAL") == 4


def test_coach_sets_updates_and_clears_a_monthly_score(coach, api_as, gym, make_user):
    student = make_user("ana")
    metric = Metric.objects.filter(gym=gym).first()
    client = api_as(coach)
    payload = {"student": student.id, "metric": metric.id, "period": "2026-11-17", "score": 3}
    response = client.post("/api/assessments/set/", payload)
    assert response.status_code == 200 and response.json()["period"] == "2026-11-01"
    client.post("/api/assessments/set/", {**payload, "score": 4})
    assert Assessment.objects.get().score == 4
    assert client.get("/api/assessments/?period=2026-11-30").json()[0]["score"] == 4
    assert client.post("/api/assessments/set/", {**payload, "score": None}, format="json").status_code == 204
    assert not Assessment.objects.exists()


def test_scores_must_be_between_1_and_10_by_default(coach, api_as, gym, make_user):
    student = make_user("ana")
    metric = Metric.objects.filter(gym=gym).first()
    for score in (0, 11):
        payload = {"student": student.id, "metric": metric.id, "period": "2026-11-01", "score": score}
        assert api_as(coach).post("/api/assessments/set/", payload).status_code == 400


def test_coach_changes_the_scale_maximum(coach, api_as, gym, make_user):
    student = make_user("ana")
    metric = Metric.objects.filter(gym=gym).first()
    client = api_as(coach)
    scale = client.patch("/api/my-gym/", {"assessment_scale_min": 0, "assessment_scale_max": 5}).json()
    assert (scale["assessment_scale_min"], scale["assessment_scale_max"]) == (0, 5)
    assert client.patch("/api/my-gym/", {"assessment_scale_min": 5}).status_code == 400  # min must stay below max
    payload = {"student": student.id, "metric": metric.id, "period": "2026-11-01", "score": 0}
    assert client.post("/api/assessments/set/", payload).status_code == 200
    assert client.post("/api/assessments/set/", {**payload, "score": 6}).status_code == 400
    gym_view = api_as(student).get("/api/auth/me/").json()["gym"]
    assert (gym_view["assessment_scale_min"], gym_view["assessment_scale_max"]) == (0, 5)


def test_student_sees_only_own_history_and_cannot_score(coach, api_as, gym, make_user):
    ana, bia = make_user("ana"), make_user("bia")
    metric = Metric.objects.filter(gym=gym).first()
    Assessment.objects.create(student=ana, metric=metric, period=date(2026, 10, 1), score=2)
    Assessment.objects.create(student=ana, metric=metric, period=date(2026, 11, 1), score=3)
    Assessment.objects.create(student=bia, metric=metric, period=date(2026, 11, 1), score=5)
    client = api_as(ana)
    assert [a["score"] for a in client.get("/api/me/assessments/").json()] == [2, 3]
    assert client.get("/api/assessments/").status_code == 403
    payload = {"student": ana.id, "metric": metric.id, "period": "2026-11-01", "score": 5}
    assert client.post("/api/assessments/set/", payload).status_code == 403
    assert len(client.get("/api/metrics/").json()) == 8


def test_assessments_are_isolated_between_gyms(coach, api_as, gym, other_gym, make_user):
    rival_student = make_user("zed", gym=other_gym)
    rival_metric = Metric.objects.filter(gym=other_gym).first()
    Assessment.objects.create(student=rival_student, metric=rival_metric, period=date(2026, 11, 1), score=5)
    own_student = make_user("ana")
    own_metric = Metric.objects.filter(gym=gym).first()
    client = api_as(coach)
    assert client.get("/api/assessments/").json() == []
    assert client.get(f"/api/metrics/{rival_metric.id}/").status_code == 404
    attempts = [
        {"student": rival_student.id, "metric": own_metric.id},
        {"student": own_student.id, "metric": rival_metric.id},
    ]
    for attempt in attempts:
        response = client.post("/api/assessments/set/", {**attempt, "period": "2026-11-01", "score": 1})
        assert response.status_code == 400, attempt
