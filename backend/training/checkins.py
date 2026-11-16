"""Check-in timing: students confirm presence for any class that is not cancelled (also drafts
and future regular classes) until `checkin_deadline_minutes` before it starts."""
from datetime import datetime, time, timedelta

from django.utils import timezone

from .models import TrainingSession, WeeklySchedule


def session_start(session: TrainingSession) -> datetime:
    """When the class starts, in the server's time zone (the schedule's default time if unset)."""
    start_time = session.start_time or WeeklySchedule.for_gym(session.gym).default_start_time
    if isinstance(start_time, str):  # a freshly created schedule still holds the string default
        start_time = time.fromisoformat(start_time)
    return timezone.make_aware(datetime.combine(session.date, start_time))


def checkin_deadline(session: TrainingSession) -> datetime:
    return session_start(session) - timedelta(minutes=session.gym.checkin_deadline_minutes)


def checkin_open(session: TrainingSession, now: datetime | None = None) -> bool:
    """Any class that is not cancelled, published or not, until the deadline (Gustavo, 2026-11-16)."""
    if session.status == TrainingSession.Status.CANCELLED:
        return False
    return (now or timezone.now()) < checkin_deadline(session)
