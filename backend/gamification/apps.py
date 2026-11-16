from django.apps import AppConfig


class GamificationConfig(AppConfig):
    """XP for attending classes and completing missions, levels, and coach-assigned fighter classes."""

    default_auto_field = "django.db.models.BigAutoField"
    name = "gamification"

    def ready(self):
        from . import signals  # noqa: F401
