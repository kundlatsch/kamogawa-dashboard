from django.utils import timezone

from .models import MissionCompletion


def review_completion(completion: MissionCompletion, coach, approve: bool) -> MissionCompletion:
    """Approve or reject a student's mission completion (missions are goals; they award no XP)."""
    completion.status = MissionCompletion.Status.APPROVED if approve else MissionCompletion.Status.REJECTED
    completion.reviewed_by = coach
    completion.reviewed_at = timezone.now()
    completion.save(update_fields=["status", "reviewed_by", "reviewed_at"])
    return completion
