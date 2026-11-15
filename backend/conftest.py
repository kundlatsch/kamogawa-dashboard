import pytest
from rest_framework.test import APIClient

from accounts.models import User


@pytest.fixture
def make_user(db):
    def _make(username, role=User.Role.STUDENT, password="pass12345"):
        return User.objects.create_user(username=username, password=password, role=role)

    return _make


@pytest.fixture
def coach(make_user):
    return make_user("coach", User.Role.COACH)


@pytest.fixture
def api_as():
    def _client(user):
        client = APIClient()
        client.force_authenticate(user)
        return client

    return _client
