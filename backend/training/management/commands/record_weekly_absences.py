from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from training.absences import record_week, week_start
from training.views import parse_date


class Command(BaseCommand):
    help = "Record weekly absences (committed classes minus check-ins). Defaults to the current week."

    def add_arguments(self, parser):
        parser.add_argument("--week", help="Any day of the week to close (YYYY-MM-DD).")
        parser.add_argument("--previous", action="store_true", help="Close last week instead of this one.")

    def handle(self, *args, week=None, previous=False, **options):
        day = parse_date(week, "week") if week else timezone.localdate()
        if previous:
            day -= timedelta(days=7)
        start = week_start(day)
        count = record_week(start)
        self.stdout.write(self.style.SUCCESS(f"Recorded the week of {start} for {count} students."))
