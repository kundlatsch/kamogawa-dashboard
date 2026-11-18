from django.apps import AppConfig


class GamificationConfig(AppConfig):
    """Coach-assigned fighter classes and the attendance ranking (plus legacy XP history)."""

    default_auto_field = "django.db.models.BigAutoField"
    name = "gamification"

    def ready(self):
        from . import signals  # noqa: F401
