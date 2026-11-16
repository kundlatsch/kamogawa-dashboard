from django.utils import timezone

from training.models import Assignment, Drill, SessionBlock, TrainingSession


def test_new_gym_gets_the_six_default_blocks(gym):
    blocks = list(SessionBlock.objects.filter(gym=gym))
    assert [b.mode for b in blocks] == ["COLLECTIVE", "COLLECTIVE", "INDIVIDUAL", "PAIRS", "PAIRS", "COLLECTIVE"]


def test_coach_edits_blocks_and_students_can_read_them(coach, api_as, gym, make_user):
    block = SessionBlock.objects.filter(gym=gym).first()
    client = api_as(coach)
    response = client.patch(f"/api/session-blocks/{block.id}/", {"start_offset_minutes": 5, "mode": "PAIRS"})
    assert response.status_code == 200
    assert client.patch(f"/api/session-blocks/{block.id}/", {"mode": "SOLO"}).status_code == 400
    student = api_as(make_user("ana"))
    assert len(student.get("/api/session-blocks/").json()) == 6
    assert student.post("/api/session-blocks/", {"name": "x"}).status_code == 403


def test_assignment_takes_a_block_of_the_same_gym(coach, api_as, gym, other_gym):
    session = TrainingSession.objects.create(gym=gym, date=timezone.localdate())
    drill = Drill.objects.create(gym=gym, name="Polichinelo")
    own = SessionBlock.objects.filter(gym=gym).first()
    rival = SessionBlock.objects.filter(gym=other_gym).first()
    client = api_as(coach)
    payload = {"session": session.id, "drill": drill.id, "is_broadcast": True}
    assert client.post("/api/assignments/", {**payload, "block": own.id}).json()["block"] == own.id
    assert client.post("/api/assignments/", {**payload, "block": rival.id}).status_code == 400
    assert client.get(f"/api/session-blocks/{rival.id}/").status_code == 404


def test_student_routine_follows_block_order(coach, api_as, gym, make_user):
    student = make_user("ana")
    session = TrainingSession.objects.create(
        gym=gym, date=timezone.localdate(), status=TrainingSession.Status.PUBLISHED
    )
    mobility, _, specific, *_ = SessionBlock.objects.filter(gym=gym)
    drill = Drill.objects.create(gym=gym, name="Sombra")
    late = Assignment.objects.create(session=session, drill=drill, is_broadcast=True, block=specific, order=0)
    early = Assignment.objects.create(session=session, drill=drill, is_broadcast=True, block=mobility, order=1)
    legacy = Assignment.objects.create(session=session, drill=drill, is_broadcast=True, order=2)
    routine = api_as(student).get("/api/me/routine/").json()["sessions"][0]["routine"]
    assert [item["id"] for item in routine] == [early.id, late.id, legacy.id]
    assert routine[0]["block"]["name"] == mobility.name
    assert routine[2]["block"] is None
