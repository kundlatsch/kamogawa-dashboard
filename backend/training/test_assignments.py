from datetime import date

import pytest

from training.models import Assignment, Drill, TrainingSession


@pytest.fixture
def board(make_user, gym):
    return {
        "session": TrainingSession.objects.create(gym=gym, date=date(2026, 11, 16)),
        "bag": Drill.objects.create(gym=gym, name="Heavy bag"),
        "tap": Drill.objects.create(gym=gym, name="Shoulder tap"),
        "a": make_user("a"),
        "b": make_user("b"),
        "c": make_user("c"),
    }


def create(client, board, drill, participants=(), broadcast=False):
    return client.post(
        "/api/assignments/",
        {
            "session": board["session"].id,
            "drill": board[drill].id,
            "participants": [board[p].id for p in participants],
            "is_broadcast": broadcast,
        },
        format="json",
    )


def test_solo_pair_and_broadcast_coexist_in_one_session(coach, api_as, board):
    client = api_as(coach)
    assert create(client, board, "bag", ["a"]).status_code == 201
    assert create(client, board, "tap", ["b", "c"]).status_code == 201
    assert create(client, board, "bag", broadcast=True).status_code == 201
    pair = Assignment.objects.get(drill=board["tap"])
    assert set(pair.participants.all()) == {board["b"], board["c"]}
    assert list(board["session"].assignments.values_list("order", flat=True)) == [0, 1, 2]


def test_assignment_needs_students_or_broadcast(coach, api_as, board):
    assert create(api_as(coach), board, "bag").status_code == 400


def test_broadcast_cannot_have_participants(coach, api_as, board):
    assert create(api_as(coach), board, "bag", ["a"], broadcast=True).status_code == 400


def test_coaches_cannot_be_participants(coach, api_as, board):
    response = api_as(coach).post(
        "/api/assignments/",
        {"session": board["session"].id, "drill": board["bag"].id, "participants": [coach.id]},
        format="json",
    )
    assert response.status_code == 400


def test_add_participant_turns_solo_into_pair(coach, api_as, board):
    client = api_as(coach)
    assignment_id = create(client, board, "tap", ["b"]).json()["id"]
    response = client.post(f"/api/assignments/{assignment_id}/add-participant/", {"student": board["c"].id})
    assert sorted(response.json()["participants"]) == sorted([board["b"].id, board["c"].id])


def test_removing_last_participant_deletes_assignment(coach, api_as, board):
    client = api_as(coach)
    assignment_id = create(client, board, "bag", ["a"]).json()["id"]
    response = client.post(f"/api/assignments/{assignment_id}/remove-participant/", {"student": board["a"].id})
    assert response.status_code == 204
    assert not Assignment.objects.exists()


def test_reorder_sets_routine_order(coach, api_as, board):
    client = api_as(coach)
    first = create(client, board, "bag", ["a"]).json()["id"]
    second = create(client, board, "tap", ["a"]).json()["id"]
    response = client.post(
        "/api/assignments/reorder/", {"session": board["session"].id, "ids": [second, first]}, format="json"
    )
    assert [item["id"] for item in response.json()] == [second, first]


def test_reorder_requires_every_assignment(coach, api_as, board):
    client = api_as(coach)
    first = create(client, board, "bag", ["a"]).json()["id"]
    create(client, board, "tap", ["a"])
    response = client.post(
        "/api/assignments/reorder/", {"session": board["session"].id, "ids": [first]}, format="json"
    )
    assert response.status_code == 400


def test_students_cannot_edit_assignments(api_as, board):
    assert create(api_as(board["a"]), board, "bag", ["a"]).status_code == 403
