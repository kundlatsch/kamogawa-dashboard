from django.db.models import Sum
from django.utils import timezone

from .models import MissionCompletion, XpEvent


def total_xp(student) -> int:
    return student.xp_events.aggregate(total=Sum("amount"))["total"] or 0


def level_for(xp: int, xp_per_level: int) -> dict:
    """Level starts at 1 and goes up every `xp_per_level` XP; XP never drops a level below 1."""
    per_level = max(xp_per_level, 1)
    xp = max(xp, 0)
    return {
        "xp": xp,
        "level": 1 + xp // per_level,
        "level_xp": xp % per_level,
        "xp_per_level": per_level,
    }


def sync_attendance_xp(check_in) -> None:
    """Grant the gym's attendance XP once when the coach confirms attendance; remove it otherwise."""
    events = XpEvent.objects.filter(student=check_in.student, session=check_in.session, reason=XpEvent.Reason.ATTENDANCE)
    if check_in.attended:
        if not events.exists():
            XpEvent.objects.create(
                student=check_in.student,
                session=check_in.session,
                reason=XpEvent.Reason.ATTENDANCE,
                amount=check_in.session.gym.attendance_xp,
            )
    else:
        events.delete()


def review_completion(completion: MissionCompletion, coach, approve: bool) -> MissionCompletion:
    """Approve (grants the mission's XP) or reject a completion; re-reviewing undoes the old XP."""
    completion.status = MissionCompletion.Status.APPROVED if approve else MissionCompletion.Status.REJECTED
    completion.reviewed_by = coach
    completion.reviewed_at = timezone.now()
    completion.save(update_fields=["status", "reviewed_by", "reviewed_at"])
    XpEvent.objects.filter(mission_completion=completion).delete()
    if approve:
        XpEvent.objects.create(
            student=completion.student,
            reason=XpEvent.Reason.MISSION,
            mission_completion=completion,
            amount=completion.mission.xp_reward,
            created_by=coach,
        )
    return completion
