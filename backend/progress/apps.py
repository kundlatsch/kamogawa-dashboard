from django.apps import AppConfig


class ProgressConfig(AppConfig):
    """Student progress: monthly assessments, weekly focuses, coach notes and homework."""

    default_auto_field = "django.db.models.BigAutoField"
    name = "progress"

    def ready(self):
        from . import signals  # noqa: F401
