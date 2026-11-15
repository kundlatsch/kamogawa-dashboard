import pytest
from rest_framework.test import APIClient

from accounts.models import Gym, User


@pytest.fixture
def gym(db):
    return Gym.objects.create(name="Chacão Boxing Team")


@pytest.fixture
def other_gym(db):
    return Gym.objects.create(name="Other Boxing Club")


@pytest.fixture
def make_user(gym):
    def _make(username, role=User.Role.STUDENT, password="pass12345", gym=gym):
        if role == User.Role.ACCOUNT_ADMIN:
            gym = None
        return User.objects.create_user(username=username, password=password, role=role, gym=gym)

    return _make


@pytest.fixture
def coach(make_user):
    return make_user("coach", User.Role.COACH)


@pytest.fixture
def account_admin(make_user):
    return make_user("boss", User.Role.ACCOUNT_ADMIN)


@pytest.fixture
def api_as():
    def _client(user):
        client = APIClient()
        client.force_authenticate(user)
        return client

    return _client
