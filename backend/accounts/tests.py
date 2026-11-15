import pytest
from rest_framework.test import APIClient

from accounts.models import User


@pytest.fixture
def make_user(db):
    def _make(username, role, password="pass12345"):
        return User.objects.create_user(username=username, password=password, role=role)

    return _make


def client_for(user):
    client = APIClient()
    client.force_authenticate(user)
    return client


def test_login_returns_tokens_and_me_returns_role(make_user):
    make_user("coach", User.Role.COACH)
    client = APIClient()
    tokens = client.post("/api/auth/token/", {"username": "coach", "password": "pass12345"}).json()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {tokens['access']}")
    me = client.get("/api/auth/me/").json()
    assert me["role"] == "COACH"


def test_coach_creates_student_with_generated_password(make_user):
    coach = make_user("coach", User.Role.COACH)
    response = client_for(coach).post("/api/students/", {"username": "ana", "display_name": "Ana"})
    assert response.status_code == 201
    password = response.json()["generated_password"]
    student = User.objects.get(username="ana")
    assert student.role == User.Role.STUDENT
    assert student.check_password(password)


def test_reset_password_replaces_old_password(make_user):
    coach = make_user("coach", User.Role.COACH)
    student = make_user("ana", User.Role.STUDENT)
    response = client_for(coach).post(f"/api/students/{student.id}/reset-password/")
    student.refresh_from_db()
    assert not student.check_password("pass12345")
    assert student.check_password(response.json()["generated_password"])


def test_delete_deactivates_student(make_user):
    coach = make_user("coach", User.Role.COACH)
    student = make_user("ana", User.Role.STUDENT)
    client_for(coach).delete(f"/api/students/{student.id}/")
    student.refresh_from_db()
    assert student.is_active is False


def test_student_cannot_manage_students(make_user):
    student = make_user("ana", User.Role.STUDENT)
    assert client_for(student).get("/api/students/").status_code == 403


def test_only_admin_manages_coaches(make_user):
    coach = make_user("coach", User.Role.COACH)
    admin = make_user("boss", User.Role.ADMIN)
    assert client_for(coach).post("/api/coaches/", {"username": "c2"}).status_code == 403
    assert client_for(admin).post("/api/coaches/", {"username": "c2"}).status_code == 201
    assert User.objects.get(username="c2").role == User.Role.COACH


def test_role_cannot_be_escalated_through_payload(make_user):
    coach = make_user("coach", User.Role.COACH)
    client_for(coach).post("/api/students/", {"username": "sneaky", "role": "ADMIN"})
    assert User.objects.get(username="sneaky").role == User.Role.STUDENT
