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
                    start_time=schedule.default_start_time,
                    kind=TrainingSession.Kind.REGULAR,
                    created_by=created_by,
                )
            )
        day += timedelta(days=1)
    return TrainingSession.objects.bulk_create(to_create)
