from django.conf import settings
from django.db import models


class Notification(models.Model):
    """In-app notification. The UI renders the text from `kind` + session data so it stays translatable."""

    class Kind(models.TextChoices):
        SESSION_PUBLISHED = "SESSION_PUBLISHED", "Session published"
        SPARRING = "SPARRING", "Sparring announced"

    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="notifications"
    )
    kind = models.CharField(max_length=32, choices=Kind.choices)
    session = models.ForeignKey(
        "training.TrainingSession", null=True, blank=True, on_delete=models.CASCADE, related_name="+"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    read_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at", "-id"]
        constraints = [
            models.UniqueConstraint(fields=["recipient", "kind", "session"], name="unique_notification_per_session")
        ]
