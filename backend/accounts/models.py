from django.contrib.auth.models import AbstractUser
from django.core.validators import RegexValidator
from django.db import models
from django.utils.text import slugify
from django.utils.translation import gettext_lazy as _


class Gym(models.Model):
    """A tenant of the platform. Every coach, student and training record belongs to one gym."""

    name = models.CharField(max_length=120)
    slug = models.SlugField(max_length=140, unique=True)
    # Accent color of the student area (the coach module keeps the fixed red theme).
    color = models.CharField(
        max_length=7,
        default="#d62828",
        validators=[RegexValidator(r"^#[0-9a-fA-F]{6}$", "Use a hex color like #d62828.")],
    )
    is_active = models.BooleanField(default=True)
    # Students confirm presence until this many minutes before a class starts.
    checkin_deadline_minutes = models.PositiveSmallIntegerField(default=120)
    # Legacy XP settings (XP was dropped on 2026-11-16); kept so existing data is untouched.
    attendance_xp = models.PositiveSmallIntegerField(default=10)
    xp_per_level = models.PositiveSmallIntegerField(default=100)
    # Monthly assessments are scored from assessment_scale_min to assessment_scale_max.
    assessment_scale_min = models.PositiveSmallIntegerField(default=1)
    assessment_scale_max = models.PositiveSmallIntegerField(default=10)
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

    class Handedness(models.TextChoices):
        UNSPECIFIED = "UNSPECIFIED", _("Unspecified")
        RIGHT = "RIGHT", _("Right-handed")
        LEFT = "LEFT", _("Left-handed")

    class Level(models.TextChoices):
        UNSPECIFIED = "", _("Unspecified")
        BEGINNER = "BEGINNER", _("Beginner")
        BEGINNER_INTERMEDIATE = "BEGINNER_INTERMEDIATE", _("Beginner/Intermediate")
        INTERMEDIATE = "INTERMEDIATE", _("Intermediate")
        INTERMEDIATE_ADVANCED = "INTERMEDIATE_ADVANCED", _("Intermediate/Advanced")
        ADVANCED = "ADVANCED", _("Advanced")

    role = models.CharField(max_length=16, choices=Role.choices, default=Role.STUDENT)
    gym = models.ForeignKey(Gym, null=True, blank=True, on_delete=models.PROTECT, related_name="members")
    display_name = models.CharField(max_length=80, blank=True)
    avatar_emoji = models.CharField(max_length=16, default="🥊")
    color = models.CharField(max_length=7, default="#d62828")
    # Optional profile photo; the emoji is shown when there is none.
    avatar = models.ImageField(upload_to="avatars/", blank=True)
    handedness = models.CharField(max_length=16, choices=Handedness.choices, default=Handedness.UNSPECIFIED)
    # Free text the user keeps up to date: injuries, sparring or equipment restrictions.
    limitations = models.TextField(blank=True, max_length=1000)
    # How many classes a week the student committed to; blank = no weekly absence tracking.
    weekly_classes = models.PositiveSmallIntegerField(null=True, blank=True)
    # Skill level set by the coach (students cannot change it); blank = not set yet.
    level = models.CharField(max_length=24, choices=Level.choices, blank=True, default=Level.UNSPECIFIED)
    # Fighting style chosen by the coach (students cannot change it).
    fighter_class = models.ForeignKey(
        "gamification.FighterClass", null=True, blank=True, on_delete=models.SET_NULL, related_name="students"
    )
    # What the student should work on, written freely by the coach (students read it, cannot change it).
    focus_text = models.TextField(blank=True, max_length=1000)
    # Optional second style the fighter mixes in (e.g. Out-Boxer with a Counter-Puncher side); never the same as the main one.
    secondary_fighter_class = models.ForeignKey(
        "gamification.FighterClass",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="secondary_students",
    )

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
