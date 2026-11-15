from rest_framework.test import APIClient

from accounts.models import Gym, User


def test_login_returns_tokens_and_me_returns_role_and_gym(make_user, gym):
    make_user("coach", User.Role.COACH)
    client = APIClient()
    tokens = client.post("/api/auth/token/", {"username": "coach", "password": "pass12345"}).json()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {tokens['access']}")
    me = client.get("/api/auth/me/").json()
    assert me["role"] == "COACH"
    assert me["gym"]["name"] == gym.name


def test_coach_creates_student_in_own_gym_with_generated_password(coach, api_as, gym):
    response = api_as(coach).post("/api/students/", {"username": "ana", "display_name": "Ana"})
    assert response.status_code == 201
    student = User.objects.get(username="ana")
    assert student.role == User.Role.STUDENT
    assert student.gym == gym
    assert student.check_password(response.json()["generated_password"])


def test_duplicate_username_is_rejected(coach, api_as, make_user):
    make_user("ana")
    assert api_as(coach).post("/api/students/", {"username": "ana"}).status_code == 400


def test_reset_password_replaces_old_password(coach, api_as, make_user):
    student = make_user("ana")
    response = api_as(coach).post(f"/api/students/{student.id}/reset-password/")
    student.refresh_from_db()
    assert not student.check_password("pass12345")
    assert student.check_password(response.json()["generated_password"])


def test_delete_deactivates_student(coach, api_as, make_user):
    student = make_user("ana")
    api_as(coach).delete(f"/api/students/{student.id}/")
    student.refresh_from_db()
    assert student.is_active is False


def test_coach_only_sees_students_of_own_gym(coach, api_as, make_user, other_gym):
    make_user("ana")
    outsider = make_user("zed", gym=other_gym)
    client = api_as(coach)
    assert [s["username"] for s in client.get("/api/students/").json()] == ["ana"]
    assert client.post(f"/api/students/{outsider.id}/reset-password/").status_code == 404


def test_student_cannot_manage_students(make_user, api_as):
    assert api_as(make_user("ana")).get("/api/students/").status_code == 403


def test_role_cannot_be_escalated_through_payload(coach, api_as):
    api_as(coach).post("/api/students/", {"username": "sneaky", "role": "ACCOUNT_ADMIN"})
    assert User.objects.get(username="sneaky").role == User.Role.STUDENT


def test_account_admin_creates_gym_with_multiple_coaches(account_admin, api_as):
    response = api_as(account_admin).post(
        "/api/gyms/",
        {"name": "Leões do Ringue", "coaches": [{"username": "c1"}, {"username": "c2", "display_name": "Coach 2"}]},
        format="json",
    )
    assert response.status_code == 201
    body = response.json()
    assert body["slug"] == "leoes-do-ringue"
    assert body["coach_count"] == 2
    assert {c["username"] for c in body["coach_credentials"]} == {"c1", "c2"}
    gym = Gym.objects.get(name="Leões do Ringue")
    c1 = User.objects.get(username="c1")
    assert c1.gym == gym and c1.role == User.Role.COACH
    assert c1.check_password(body["coach_credentials"][0]["generated_password"])


def test_gym_creation_is_atomic_when_a_coach_username_is_taken(account_admin, api_as, make_user):
    make_user("taken")
    response = api_as(account_admin).post(
        "/api/gyms/", {"name": "New Gym", "coaches": [{"username": "taken"}]}, format="json"
    )
    assert response.status_code == 400
    assert not Gym.objects.filter(name="New Gym").exists()


def test_account_admin_manages_coaches_of_a_gym(account_admin, api_as, gym):
    client = api_as(account_admin)
    created = client.post(f"/api/gyms/{gym.id}/coaches/", {"username": "c3"})
    assert created.status_code == 201
    assert User.objects.get(username="c3").gym == gym
    coach_id = created.json()["id"]
    assert client.post(f"/api/gyms/{gym.id}/coaches/{coach_id}/reset-password/").status_code == 200
    assert [c["username"] for c in client.get(f"/api/gyms/{gym.id}/coaches/").json()] == ["c3"]


def test_coaches_and_students_cannot_manage_gyms(coach, api_as, make_user, gym):
    for user in [coach, make_user("ana")]:
        client = api_as(user)
        assert client.get("/api/gyms/").status_code == 403
        assert client.post(f"/api/gyms/{gym.id}/coaches/", {"username": "x"}).status_code == 403


def test_account_admin_has_no_coach_module(account_admin, api_as):
    assert api_as(account_admin).get("/api/drills/").status_code == 403


def test_deactivated_gym_locks_out_its_members(coach, api_as, gym, account_admin):
    api_as(account_admin).delete(f"/api/gyms/{gym.id}/")
    gym.refresh_from_db()
    assert gym.is_active is False
    assert api_as(coach).get("/api/drills/").status_code == 403
