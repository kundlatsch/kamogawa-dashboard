from django.conf import settings
from django.db import models

from training.models import hex_color


class FighterClass(models.Model):
    """A fighting style the coach assigns to a student (Out-Boxer, Swarmer, ...). Coach-editable list.

    `art_key` points at artwork bundled with the frontend, `image` is a coach upload (it wins);
    classes with neither show their emoji.
    """

    gym = models.ForeignKey("accounts.Gym", on_delete=models.CASCADE, related_name="fighter_classes")
    name = models.CharField(max_length=80)
    description = models.TextField(blank=True)
    emoji = models.CharField(max_length=16, default="🥊")
    color = models.CharField(max_length=7, default="#d62828", validators=[hex_color])
    art_key = models.CharField(max_length=40, blank=True)
    # Custom artwork uploaded by the coach; takes precedence over `art_key`.
    image = models.ImageField(upload_to="fighter-classes/", blank=True)
    order = models.PositiveIntegerField(default=0)
    archived = models.BooleanField(default=False)

    class Meta:
        ordering = ["order", "name"]
        verbose_name_plural = "fighter classes"
        constraints = [models.UniqueConstraint(fields=["gym", "name"], name="unique_fighter_class_name_per_gym")]

    def __str__(self) -> str:
        return self.name


class XpEvent(models.Model):
    """Legacy: XP gains from before XP was dropped (2026-11-16). Kept so no data is lost; nothing writes it."""

    class Reason(models.TextChoices):
        ATTENDANCE = "ATTENDANCE", "Attended a class"
        MISSION = "MISSION", "Completed a mission"
        MANUAL = "MANUAL", "Granted by the coach"

    student = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="xp_events")
    amount = models.IntegerField()
    reason = models.CharField(max_length=16, choices=Reason.choices)
    session = models.ForeignKey(
        "training.TrainingSession", null=True, blank=True, on_delete=models.CASCADE, related_name="+"
    )
    note = models.CharField(max_length=200, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-id"]
        constraints = [
            models.UniqueConstraint(
                fields=["student", "session"],
                condition=models.Q(reason="ATTENDANCE"),
                name="one_attendance_xp_per_session",
            )
        ]
