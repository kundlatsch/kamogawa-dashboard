from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils.text import slugify
from django.utils.translation import gettext_lazy as _


class Gym(models.Model):
    """A tenant of the platform. Every coach, student and training record belongs to one gym."""

    name = models.CharField(max_length=120)
    slug = models.SlugField(max_length=140, unique=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name

    def save(self, *args, **kwargs):
        if not self.slug:
            base = slugify(self.name) or "gym"
            slug, n = base, 2
            while Gym.objects.filter(slug=slug).exclude(pk=self.pk).exists():
                slug, n = f"{base}-{n}", n + 1
            self.slug = slug
        super().save(*args, **kwargs)


class User(AbstractUser):
    class Role(models.TextChoices):
        ACCOUNT_ADMIN = "ACCOUNT_ADMIN", _("Account admin")
        COACH = "COACH", _("Coach")
        STUDENT = "STUDENT", _("Student")

    role = models.CharField(max_length=16, choices=Role.choices, default=Role.STUDENT)
    gym = models.ForeignKey(Gym, null=True, blank=True, on_delete=models.PROTECT, related_name="members")
    display_name = models.CharField(max_length=80, blank=True)
    avatar_emoji = models.CharField(max_length=16, default="🥊")
    color = models.CharField(max_length=7, default="#d62828")

    class Meta:
        ordering = ["display_name", "username"]
        constraints = [
            models.CheckConstraint(
                name="gym_required_unless_account_admin",
                condition=models.Q(role="ACCOUNT_ADMIN") | models.Q(gym__isnull=False),
            )
        ]

    def __str__(self) -> str:
        return self.display_name or self.username

    @property
    def is_account_admin(self) -> bool:
        return self.role == self.Role.ACCOUNT_ADMIN

    @property
    def is_coach(self) -> bool:
        return self.role == self.Role.COACH and self.gym_id is not None

    def save(self, *args, **kwargs):
        if not self.display_name:
            self.display_name = self.username
        super().save(*args, **kwargs)
