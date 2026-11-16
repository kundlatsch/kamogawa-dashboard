from datetime import date, timedelta

from .models import TrainingSession, WeeklySchedule

MAX_GENERATION_DAYS = 120


def generate_regular_sessions(gym, start: date, end: date, created_by=None) -> list[TrainingSession]:
    """Create a REGULAR session on every configured weekday in [start, end] that has none yet.

    Idempotent: dates that already have any session of this gym (regular, extra or
    sparring) are skipped, so a coach who deleted or replaced a day's session is not overridden.
    """
    if end < start:
        return []
    end = min(end, start + timedelta(days=MAX_GENERATION_DAYS))
    schedule = WeeklySchedule.for_gym(gym)
    weekdays = set(schedule.training_weekdays)
    taken = set(
        TrainingSession.objects.filter(gym=gym, date__range=(start, end)).values_list("date", flat=True)
    )
    to_create = []
    day = start
    while day <= end:
        if day.weekday() in weekdays and day not in taken:
            to_create.append(
                TrainingSession(
                    gym=gym,
                    date=day,
                    start_time=schedule.start_time_for(day.weekday()),
                    kind=TrainingSession.Kind.REGULAR,
                    created_by=created_by,
                )
            )
        day += timedelta(days=1)
    return TrainingSession.objects.bulk_create(to_create)


def apply_schedule_times(gym, from_day: date) -> int:
    """After the coach changes class times, move untouched upcoming regular drafts to the new times.

    Only regular, unpublished sessions without exercises are changed, so nothing the coach already
    planned or announced moves. Returns how many sessions were updated.
    """
    schedule = WeeklySchedule.for_gym(gym)
    updated = []
    sessions = TrainingSession.objects.filter(
        gym=gym,
        date__gte=from_day,
        kind=TrainingSession.Kind.REGULAR,
        status=TrainingSession.Status.DRAFT,
        assignments__isnull=True,
    )
    for session in sessions:
        start = schedule.start_time_for(session.date.weekday())
        if session.start_time != start:
            session.start_time = start
            updated.append(session)
    TrainingSession.objects.bulk_update(updated, ["start_time"])
    return len(updated)
