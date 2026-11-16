from datetime import timedelta

from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models

from training.models import hex_color


class Metric(models.Model):
    """Something the coach scores from 1 to 5 every month (speed, guard, ...). Coach-editable list."""

    class Group(models.TextChoices):
        PHYSICAL = "PHYSICAL", "Physical capacity"
        TECHNICAL = "TECHNICAL", "Technical skill"

    gym = models.ForeignKey("accounts.Gym", on_delete=models.CASCADE, related_name="metrics")
    name = models.CharField(max_length=60)
    group = models.CharField(max_length=16, choices=Group.choices, default=Group.PHYSICAL)
    color = models.CharField(max_length=7, default="#d62828", validators=[hex_color])
    order = models.PositiveIntegerField(default=0)
    archived = models.BooleanField(default=False)

    class Meta:
        ordering = ["order", "name"]
        constraints = [models.UniqueConstraint(fields=["gym", "name"], name="unique_metric_name_per_gym")]

    def __str__(self) -> str:
        return self.name


class Assessment(models.Model):
    """A student's score on one metric for one month (`period` is the first day of the month).

    Scores go from the gym's `assessment_scale_min` to `assessment_scale_max`; changing the scale
    keeps older scores.
    """

    student = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="assessments")
    metric = models.ForeignKey(Metric, on_delete=models.CASCADE, related_name="assessments")
    period = models.DateField()
    score = models.PositiveSmallIntegerField()
    notes = models.TextField(blank=True)
    assessed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["period", "metric__order", "metric__name"]
        constraints = [
            models.UniqueConstraint(fields=["student", "metric", "period"], name="one_score_per_metric_month"),
        ]


def week_start(day):
    """Monday of the week containing `day`; weekly records are keyed by it."""
    return day - timedelta(days=day.weekday())


class FocusOption(models.Model):
    """A possible weekly focus (e.g. "keep the guard up"). Coach-editable list, like drill categories."""

    gym = models.ForeignKey("accounts.Gym", on_delete=models.CASCADE, related_name="focus_options")
    name = models.CharField(max_length=80)
    color = models.CharField(max_length=7, default="#d62828", validators=[hex_color])
    order = models.PositiveIntegerField(default=0)
    archived = models.BooleanField(default=False)

    class Meta:
        ordering = ["order", "name"]
        constraints = [models.UniqueConstraint(fields=["gym", "name"], name="unique_focus_name_per_gym")]

    def __str__(self) -> str:
        return self.name


class WeeklyFocus(models.Model):
    """One of the two things a student should focus on during a week."""

    student = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="weekly_focuses")
    week_start = models.DateField()
    position = models.PositiveSmallIntegerField(validators=[MinValueValidator(1), MaxValueValidator(2)])
    focus = models.ForeignKey(FocusOption, on_delete=models.CASCADE, related_name="weekly_focuses")
    note = models.CharField(max_length=200, blank=True)

    class Meta:
        ordering = ["week_start", "position"]
        constraints = [
            models.UniqueConstraint(fields=["student", "week_start", "position"], name="two_focuses_per_week"),
            models.CheckConstraint(name="focus_position_1_or_2", condition=models.Q(position__in=[1, 2])),
        ]


class CoachNote(models.Model):
    """An observation about a student; only notes marked visible are shown to the student."""

    student = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="coach_notes")
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    body = models.TextField()
    visible_to_student = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-id"]


class Homework(models.Model):
    """A task for a week, for some students or for everyone (`is_broadcast`)."""

    gym = models.ForeignKey("accounts.Gym", on_delete=models.CASCADE, related_name="homework")
    week_start = models.DateField(db_index=True)
    title = models.CharField(max_length=120)
    description = models.TextField(blank=True)
    drill = models.ForeignKey(
        "training.Drill", null=True, blank=True, on_delete=models.SET_NULL, related_name="homework"
    )
    is_broadcast = models.BooleanField(default=False)
    participants = models.ManyToManyField(settings.AUTH_USER_MODEL, blank=True, related_name="homework")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["week_start", "id"]
        verbose_name_plural = "homework"

    def __str__(self) -> str:
        return self.title
