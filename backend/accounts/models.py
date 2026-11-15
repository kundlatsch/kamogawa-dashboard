from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils.translation import gettext_lazy as _


class User(AbstractUser):
    class Role(models.TextChoices):
        ADMIN = "ADMIN", _("Admin")
        COACH = "COACH", _("Coach")
        STUDENT = "STUDENT", _("Student")

    role = models.CharField(max_length=16, choices=Role.choices, default=Role.STUDENT)
    display_name = models.CharField(max_length=80, blank=True)
    avatar_emoji = models.CharField(max_length=16, default="🥊")
    color = models.CharField(max_length=7, default="#d62828")

    class Meta:
        ordering = ["display_name", "username"]

    def __str__(self) -> str:
        return self.display_name or self.username

    @property
    def is_admin_role(self) -> bool:
        return self.role == self.Role.ADMIN

    @property
    def is_staff_role(self) -> bool:
        """Admins and coaches share the coach module."""
        return self.role in {self.Role.ADMIN, self.Role.COACH}

    def save(self, *args, **kwargs):
        if not self.display_name:
            self.display_name = self.username
        super().save(*args, **kwargs)
