"""Long-running scheduler (the `scheduler` Docker service): closes each week on Sunday at 23:00.

On start it also closes last week if that never happened (e.g. the server was off on Sunday).
"""
import time
from datetime import datetime, timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from training.absences import record_week, week_start
from training.models import WeeklyAbsence

RUN_WEEKDAY = 6  # Sunday
RUN_AT = (23, 0)


def next_run(now: datetime) -> datetime:
    """The next Sunday 23:00 (server time zone) strictly after `now`."""
    local = timezone.localtime(now)
    days_ahead = (RUN_WEEKDAY - local.weekday()) % 7
    candidate = local.replace(hour=RUN_AT[0], minute=RUN_AT[1], second=0, microsecond=0) + timedelta(days=days_ahead)
    if candidate <= local:
        candidate += timedelta(days=7)
    return candidate


class Command(BaseCommand):
    help = "Run scheduled jobs forever: weekly absences every Sunday at 23:00."

    def handle(self, *args, **options):
        last_week = week_start(timezone.localdate()) - timedelta(days=7)
        if not WeeklyAbsence.objects.filter(week_start=last_week).exists():
            self.log(f"catching up the week of {last_week}: {record_week(last_week)} students")
        while True:
            run_at = next_run(timezone.now())
            self.log(f"next weekly absences run at {run_at:%Y-%m-%d %H:%M}")
            while (remaining := (run_at - timezone.now()).total_seconds()) > 0:
                time.sleep(min(remaining, 300))  # wake up regularly so clock changes are honored
            week = week_start(timezone.localtime(run_at).date())
            self.log(f"closing the week of {week}: {record_week(week)} students")

    def log(self, message: str) -> None:
        self.stdout.write(f"[scheduler] {message}", ending="\n")
        self.stdout.flush()
