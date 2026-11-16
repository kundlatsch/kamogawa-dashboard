"""Weekly absences: each student commits to `weekly_classes` classes a week.

At the end of every week (Sunday 23:00, see `run_scheduler`) the week is closed: the classes a
student checked in for (and was not marked absent from) count as present, and every committed
class they did not show up for is an absence. Classes the coach marked as missed always count.
"""
from datetime import date, timedelta

from django.db import transaction
from django.db.models import Count, Q

from accounts.models import User

from .models import CheckIn, WeeklyAbsence


def week_start(day: date) -> date:
    return day - timedelta(days=day.weekday())


def week_counts(students, start: date) -> dict[int, tuple[int, int]]:
    """(present, marked_absent) per student for the Monday-to-Sunday week starting at `start`."""
    end = start + timedelta(days=6)
    rows = (
        CheckIn.objects.filter(student__in=students, session__date__range=(start, end))
        .values("student")
        .annotate(
            present=Count("id", filter=~Q(attended=False)),
            marked=Count("id", filter=Q(attended=False)),
        )
    )
    return {row["student"]: (row["present"], row["marked"]) for row in rows}


def missed_classes(expected: int | None, present: int, marked_absent: int) -> int:
    from_commitment = max((expected or 0) - present, 0) if expected is not None else 0
    return max(from_commitment, marked_absent)


@transaction.atomic
def record_week(start: date, gym=None) -> int:
    """Close the week starting on Monday `start` for every active student (of `gym`, if given).

    Idempotent: re-running a week recomputes it. Students who joined after the week ended are
    skipped. Returns how many students were recorded.
    """
    start = week_start(start)
    end = start + timedelta(days=6)
    students = User.objects.filter(role=User.Role.STUDENT, is_active=True, date_joined__date__lte=end)
    if gym is not None:
        students = students.filter(gym=gym)
    students = list(students)
    counts = week_counts(students, start)
    for student in students:
        present, marked = counts.get(student.id, (0, 0))
        WeeklyAbsence.objects.update_or_create(
            student=student,
            week_start=start,
            defaults={
                "expected": student.weekly_classes,
                "present": present,
                "missed": missed_classes(student.weekly_classes, present, marked),
            },
        )
    return len(students)
