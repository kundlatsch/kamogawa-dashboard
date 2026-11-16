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
    """A student's score on one metric for one month (`period` is the first day of the month)."""

    student = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="assessments")
    metric = models.ForeignKey(Metric, on_delete=models.CASCADE, related_name="assessments")
    period = models.DateField()
    score = models.PositiveSmallIntegerField(validators=[MinValueValidator(1), MaxValueValidator(5)])
    notes = models.TextField(blank=True)
    assessed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["period", "metric__order", "metric__name"]
        constraints = [
            models.UniqueConstraint(fields=["student", "metric", "period"], name="one_score_per_metric_month"),
            models.CheckConstraint(name="score_between_1_and_5", condition=models.Q(score__gte=1, score__lte=5)),
        ]
