from datetime import date, datetime, timedelta

from django.core.management import call_command
from django.utils import timezone

from accounts.models import User
from training.absences import missed_classes, record_week
from training.management.commands.run_scheduler import next_run
from training.models import CheckIn, TrainingSession, WeeklyAbsence

MONDAY = date(2026, 11, 9)


def old_student(make_user, username, weekly_classes):
    student = make_user(username)
    User.objects.filter(pk=student.pk).update(
        date_joined=timezone.now() - timedelta(days=60), weekly_classes=weekly_classes
    )
    student.refresh_from_db()
    return student


def test_missed_classes_rules():
    assert missed_classes(2, 1, 0) == 1  # committed to 2, came once
    assert missed_classes(2, 3, 0) == 0  # extra classes never go negative
    assert missed_classes(None, 0, 0) == 0  # no commitment, no automatic absence
    assert missed_classes(None, 0, 1) == 1  # the coach marked a miss
    assert missed_classes(3, 2, 1) == 1  # a marked miss is already part of the commitment gap


def test_record_week_counts_check_ins_against_the_commitment(gym, make_user):
    ana = old_student(make_user, "ana", 2)
    bia = old_student(make_user, "bia", 1)
    cris = old_student(make_user, "cris", None)
    monday = TrainingSession.objects.create(gym=gym, date=MONDAY)
    wednesday = TrainingSession.objects.create(gym=gym, date=MONDAY + timedelta(days=2))
    next_week = TrainingSession.objects.create(gym=gym, date=MONDAY + timedelta(days=7))
    CheckIn.objects.create(session=monday, student=ana)
    CheckIn.objects.create(session=next_week, student=ana)  # other week: ignored
    CheckIn.objects.create(session=monday, student=bia)
    CheckIn.objects.create(session=wednesday, student=bia, attended=False)
    assert record_week(MONDAY + timedelta(days=3)) == 3  # any day selects its week
    rows = {row.student.username: row for row in WeeklyAbsence.objects.filter(week_start=MONDAY)}
    assert (rows["ana"].present, rows["ana"].missed) == (1, 1)
    assert (rows["bia"].present, rows["bia"].missed) == (1, 1)
    assert (rows["cris"].expected, rows["cris"].missed) == (None, 0)
    record_week(MONDAY)  # idempotent
    assert WeeklyAbsence.objects.filter(week_start=MONDAY).count() == 3


def test_new_students_are_not_charged_for_earlier_weeks(gym, make_user):
    make_user("newbie")
    assert record_week(MONDAY) == 0


def test_command_closes_a_given_week(gym, make_user):
    old_student(make_user, "ana", 2)
    call_command("record_weekly_absences", "--week", str(MONDAY))
    assert WeeklyAbsence.objects.get().missed == 2


def test_scheduler_runs_on_sunday_at_23():
    tz = timezone.get_current_timezone()
    wednesday = timezone.make_aware(datetime(2026, 11, 18, 10, 0), tz)
    assert next_run(wednesday) == timezone.make_aware(datetime(2026, 11, 22, 23, 0), tz)
    sunday_late = timezone.make_aware(datetime(2026, 11, 22, 23, 30), tz)
    assert next_run(sunday_late) == timezone.make_aware(datetime(2026, 11, 29, 23, 0), tz)


def test_student_and_coach_set_weekly_classes(coach, api_as, make_user):
    ana = make_user("ana")
    assert api_as(ana).patch("/api/auth/me/", {"weekly_classes": 3}, format="json").json()["weekly_classes"] == 3
    response = api_as(coach).patch(f"/api/students/{ana.id}/", {"weekly_classes": 2}, format="json")
    assert response.json()["weekly_classes"] == 2
    assert api_as(ana).patch("/api/auth/me/", {"weekly_classes": -1}, format="json").status_code == 400
    assert api_as(ana).patch("/api/auth/me/", {"weekly_classes": None}, format="json").json()["weekly_classes"] is None
