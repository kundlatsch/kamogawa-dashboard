from django.conf import settings
from django.core.validators import RegexValidator
from django.db import models

hex_color = RegexValidator(r"^#[0-9a-fA-F]{6}$", "Use a hex color like #d62828.")


class DrillCategory(models.Model):
    """Coach-defined grouping for drills (warm-up, technique, conditioning, ...)."""

    name = models.CharField(max_length=60, unique=True)
    color = models.CharField(max_length=7, default="#d62828", validators=[hex_color])
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["order", "name"]
        verbose_name_plural = "drill categories"

    def __str__(self) -> str:
        return self.name


class Drill(models.Model):
    """A reusable training exercise from the coach's library."""

    name = models.CharField(max_length=120)
    description = models.TextField(blank=True)
    emoji = models.CharField(max_length=16, default="🥊")
    color = models.CharField(max_length=7, default="#d62828", validators=[hex_color])
    youtube_url = models.URLField(blank=True)
    thumbnail_url = models.URLField(blank=True)
    category = models.ForeignKey(
        DrillCategory, null=True, blank=True, on_delete=models.SET_NULL, related_name="drills"
    )
    default_rounds = models.PositiveSmallIntegerField(null=True, blank=True)
    default_duration_minutes = models.PositiveSmallIntegerField(null=True, blank=True)
    archived = models.BooleanField(default=False)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]

    def __str__(self) -> str:
        return f"{self.emoji} {self.name}"
