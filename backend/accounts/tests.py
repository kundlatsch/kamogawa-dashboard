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



def test_user_changes_own_password(make_user, api_as):
    student = make_user("ana")
    response = api_as(student).post(
        "/api/auth/change-password/", {"current_password": "pass12345", "new_password": "Luva-Vermelha-2026"}
    )
    assert response.status_code == 204
    student.refresh_from_db()
    assert student.check_password("Luva-Vermelha-2026")


def test_change_password_requires_current_password(make_user, api_as):
    student = make_user("ana")
    response = api_as(student).post(
        "/api/auth/change-password/", {"current_password": "wrong", "new_password": "Luva-Vermelha-2026"}
    )
    assert response.status_code == 400
    assert "current_password" in response.json()


def test_change_password_rejects_weak_password(account_admin, api_as):
    response = api_as(account_admin).post(
        "/api/auth/change-password/", {"current_password": "pass12345", "new_password": "123"}
    )
    assert response.status_code == 400


def test_coach_edits_own_gym_name_and_color(coach, api_as, gym):
    response = api_as(coach).patch("/api/my-gym/", {"name": "Chacão BT", "color": "#3a86ff"})
    assert response.status_code == 200
    gym.refresh_from_db()
    assert (gym.name, gym.color) == ("Chacão BT", "#3a86ff")


def test_gym_color_must_be_hex(coach, api_as):
    assert api_as(coach).patch("/api/my-gym/", {"color": "blue"}).status_code == 400


def test_students_cannot_edit_gym(make_user, api_as):
    assert api_as(make_user("ana")).patch("/api/my-gym/", {"name": "Mine"}).status_code == 403


def test_me_exposes_gym_color(make_user, api_as, gym):
    assert api_as(make_user("ana")).get("/api/auth/me/").json()["gym"]["color"] == "#d62828"


def test_user_updates_own_name_emoji_and_color(make_user, api_as):
    student = make_user("ana")
    response = api_as(student).patch(
        "/api/auth/me/", {"display_name": "Ana Pugilista", "avatar_emoji": "🐯", "color": "#3a86ff"}
    )
    assert response.status_code == 200
    student.refresh_from_db()
    assert (student.display_name, student.avatar_emoji, student.color) == ("Ana Pugilista", "🐯", "#3a86ff")


def test_profile_update_cannot_change_login_role_or_gym(make_user, api_as, other_gym):
    student = make_user("ana")
    api_as(student).patch(
        "/api/auth/me/", {"username": "hacker", "role": "ACCOUNT_ADMIN", "gym": other_gym.id}, format="json"
    )
    student.refresh_from_db()
    assert (student.username, student.role, student.gym_id) == ("ana", "STUDENT", student.gym_id)
    assert student.gym != other_gym


def test_profile_update_validates_name_and_color(make_user, api_as):
    client = api_as(make_user("ana"))
    assert client.patch("/api/auth/me/", {"display_name": "  "}).status_code == 400
    assert client.patch("/api/auth/me/", {"color": "red"}).status_code == 400



def test_user_sets_handedness_and_limitations(make_user, api_as):
    client = api_as(make_user("ana"))
    response = client.patch(
        "/api/auth/me/", {"handedness": "LEFT", "limitations": "Joelho direito operado, sem sparring."}
    )
    assert response.status_code == 200
    assert response.json()["handedness"] == "LEFT"
    assert response.json()["limitations"] == "Joelho direito operado, sem sparring."


def test_handedness_must_be_a_known_choice(make_user, api_as):
    assert api_as(make_user("ana")).patch("/api/auth/me/", {"handedness": "BOTH"}).status_code == 400


def test_coach_sees_student_handedness_and_limitations(coach, api_as, make_user):
    ana = make_user("ana")
    ana.handedness, ana.limitations = User.Handedness.LEFT, "Sem sparring."
    ana.save()
    students = api_as(coach).get("/api/students/").json()
    student = next(s for s in students if s["username"] == "ana")
    assert student["handedness"] == "LEFT"
    assert student["limitations"] == "Sem sparring."


def test_users_pick_their_ui_language_and_anyone_reads_the_install_default(api_as, coach, make_user, client, settings):
    ana = make_user("ana")
    assert api_as(ana).get("/api/auth/me/").json()["language"] == ""
    assert api_as(ana).patch("/api/auth/me/", {"language": "en"}, format="json").json()["language"] == "en"
    assert api_as(ana).patch("/api/auth/me/", {"language": "fr"}, format="json").status_code == 400
    assert api_as(coach).patch("/api/auth/me/", {"language": "pt-BR"}, format="json").json()["language"] == "pt-BR"
    # A coach cannot change a student's language for them.
    api_as(coach).patch(f"/api/students/{ana.id}/", {"language": "pt-BR"}, format="json")
    ana.refresh_from_db()
    assert ana.language == "en"
    settings.DEFAULT_LANGUAGE = "pt-BR"
    assert client.get("/api/config/").json() == {"default_language": "pt-BR", "languages": ["en", "pt-BR"]}
