from django.conf import settings
from django.core.validators import RegexValidator
from django.db import models

hex_color = RegexValidator(r"^#[0-9a-fA-F]{6}$", "Use a hex color like #d62828.")


class DrillCategory(models.Model):
    """Coach-defined grouping for drills (warm-up, technique, conditioning, ...)."""

    gym = models.ForeignKey("accounts.Gym", on_delete=models.CASCADE, related_name="drill_categories")
    name = models.CharField(max_length=60)
    color = models.CharField(max_length=7, default="#d62828", validators=[hex_color])
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["order", "name"]
        verbose_name_plural = "drill categories"
        constraints = [models.UniqueConstraint(fields=["gym", "name"], name="unique_category_name_per_gym")]

    def __str__(self) -> str:
        return self.name


class Drill(models.Model):
    """A reusable training exercise from the coach's library."""

    gym = models.ForeignKey("accounts.Gym", on_delete=models.CASCADE, related_name="drills")
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


def default_weekdays() -> list[int]:
    # Python weekday numbers: Monday=0 ... Sunday=6.
    return [0, 2, 5]


class WeeklySchedule(models.Model):
    """A gym's regular training days, editable by its coaches."""

    gym = models.OneToOneField("accounts.Gym", on_delete=models.CASCADE, related_name="weekly_schedule")
    training_weekdays = models.JSONField(default=default_weekdays)
    default_start_time = models.TimeField(default="19:00")
    # Per-weekday class times, e.g. {"5": "14:00"}; weekdays without an entry use default_start_time.
    weekday_times = models.JSONField(default=dict, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    def start_time_for(self, weekday: int):
        """Class time for a weekday (Monday=0), falling back to the default time."""
        from datetime import time

        value = self.weekday_times.get(str(weekday)) or self.default_start_time
        return time.fromisoformat(value) if isinstance(value, str) else value

    @classmethod
    def for_gym(cls, gym) -> "WeeklySchedule":
        schedule, _ = cls.objects.get_or_create(gym=gym)
        return schedule


class TrainingSession(models.Model):
    class Kind(models.TextChoices):
        REGULAR = "REGULAR", "Regular"
        EXTRA = "EXTRA", "Extra"
        SPARRING = "SPARRING", "Sparring"

    class Status(models.TextChoices):
        DRAFT = "DRAFT", "Draft"
        PUBLISHED = "PUBLISHED", "Published"

    gym = models.ForeignKey("accounts.Gym", on_delete=models.CASCADE, related_name="training_sessions")
    date = models.DateField(db_index=True)
    start_time = models.TimeField(null=True, blank=True)
    title = models.CharField(max_length=120, blank=True)
    notes = models.TextField(blank=True)
    kind = models.CharField(max_length=16, choices=Kind.choices, default=Kind.REGULAR)
    # Blank means the session inherits the objective of the microcycle containing its date.
    objective_override = models.TextField(blank=True)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.DRAFT)
    published_at = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["date", "start_time", "id"]

    def __str__(self) -> str:
        return f"{self.date} {self.kind} {self.title}".strip()


class Assignment(models.Model):
    """A drill placed in a session for a set of students.

    One record is shared by every participant: a pair or group drill is a single
    assignment that appears in each participant's routine. Broadcast assignments
    have no participants and apply to every active student.
    """

    session = models.ForeignKey(TrainingSession, on_delete=models.CASCADE, related_name="assignments")
    drill = models.ForeignKey(Drill, on_delete=models.PROTECT, related_name="assignments")
    participants = models.ManyToManyField(
        settings.AUTH_USER_MODEL, blank=True, related_name="training_assignments"
    )
    is_broadcast = models.BooleanField(default=False)
    # Which part of the class the drill belongs to; rows created before blocks existed have none.
    block = models.ForeignKey(
        "SessionBlock", null=True, blank=True, on_delete=models.SET_NULL, related_name="assignments"
    )
    order = models.PositiveIntegerField(default=0)
    notes = models.TextField(blank=True)
    rounds = models.PositiveSmallIntegerField(null=True, blank=True)
    duration_minutes = models.PositiveSmallIntegerField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["session", "order", "id"]

    def __str__(self) -> str:
        return f"{self.session} · {self.drill}"


# --- Periodization -----------------------------------------------------------------------------
#
# A macrocycle (the big cycle) holds ordered mesocycles, each training one valence; a mesocycle
# holds ordered microcycles with a phase and an objective. Only the macrocycle stores a date:
# every other date is derived from the ordered microcycle lengths (see training/periodization.py),
# so reordering mesocycles shifts the calendar automatically.


class Valence(models.Model):
    """A physical capacity a mesocycle focuses on (speed, strength, ...). Coach-editable list."""

    gym = models.ForeignKey("accounts.Gym", on_delete=models.CASCADE, related_name="valences")
    name = models.CharField(max_length=60)
    color = models.CharField(max_length=7, default="#d62828", validators=[hex_color])
    order = models.PositiveIntegerField(default=0)
    archived = models.BooleanField(default=False)

    class Meta:
        ordering = ["order", "name"]
        constraints = [models.UniqueConstraint(fields=["gym", "name"], name="unique_valence_name_per_gym")]

    def __str__(self) -> str:
        return self.name


class MicrocyclePhase(models.Model):
    """The kind of week (adaptation, development, shock, recovery/assessment). Coach-editable list."""

    gym = models.ForeignKey("accounts.Gym", on_delete=models.CASCADE, related_name="microcycle_phases")
    name = models.CharField(max_length=60)
    color = models.CharField(max_length=7, default="#d62828", validators=[hex_color])
    order = models.PositiveIntegerField(default=0)
    archived = models.BooleanField(default=False)

    class Meta:
        ordering = ["order", "name"]
        constraints = [models.UniqueConstraint(fields=["gym", "name"], name="unique_phase_name_per_gym")]

    def __str__(self) -> str:
        return self.name


class Macrocycle(models.Model):
    gym = models.ForeignKey("accounts.Gym", on_delete=models.CASCADE, related_name="macrocycles")
    name = models.CharField(max_length=120)
    start_date = models.DateField()
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-start_date", "id"]

    def __str__(self) -> str:
        return self.name


class Mesocycle(models.Model):
    macrocycle = models.ForeignKey(Macrocycle, on_delete=models.CASCADE, related_name="mesocycles")
    valence = models.ForeignKey(Valence, on_delete=models.PROTECT, related_name="mesocycles")
    name = models.CharField(max_length=120, blank=True)
    notes = models.TextField(blank=True)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["macrocycle", "order", "id"]

    def __str__(self) -> str:
        return self.name or str(self.valence)


class Microcycle(models.Model):
    mesocycle = models.ForeignKey(Mesocycle, on_delete=models.CASCADE, related_name="microcycles")
    phase = models.ForeignKey(
        MicrocyclePhase, null=True, blank=True, on_delete=models.SET_NULL, related_name="microcycles"
    )
    objective = models.TextField(blank=True)
    length_days = models.PositiveSmallIntegerField(default=7)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["mesocycle", "order", "id"]

    def __str__(self) -> str:
        return f"{self.mesocycle} · {self.order + 1}"


class SessionBlock(models.Model):
    """A part of every class (mobility, general warm-up, ...), in order. Coach-editable list.

    `mode` tells how the block is usually run: everyone together at a fixed time (COLLECTIVE),
    each student on their own (INDIVIDUAL), or in pairs (PAIRS).
    """

    class Mode(models.TextChoices):
        COLLECTIVE = "COLLECTIVE", "Collective"
        INDIVIDUAL = "INDIVIDUAL", "Individual"
        PAIRS = "PAIRS", "Pairs"

    gym = models.ForeignKey("accounts.Gym", on_delete=models.CASCADE, related_name="session_blocks")
    name = models.CharField(max_length=60)
    color = models.CharField(max_length=7, default="#d62828", validators=[hex_color])
    mode = models.CharField(max_length=16, choices=Mode.choices, default=Mode.COLLECTIVE)
    # Minutes after the class starts; only meaningful for collective blocks with a fixed time.
    start_offset_minutes = models.PositiveSmallIntegerField(null=True, blank=True)
    order = models.PositiveIntegerField(default=0)
    archived = models.BooleanField(default=False)

    class Meta:
        ordering = ["order", "name"]
        constraints = [models.UniqueConstraint(fields=["gym", "name"], name="unique_block_name_per_gym")]

    def __str__(self) -> str:
        return self.name


class CheckIn(models.Model):
    """A student confirming they will attend a class, optionally reporting pain or injury.

    `attended` stays null until the coach confirms who actually came (used for attendance XP).
    """

    session = models.ForeignKey(TrainingSession, on_delete=models.CASCADE, related_name="check_ins")
    student = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="check_ins")
    has_pain = models.BooleanField(default=False)
    pain_location = models.CharField(max_length=120, blank=True)
    pain_level = models.PositiveSmallIntegerField(null=True, blank=True)
    notes = models.TextField(blank=True)
    added_by_coach = models.BooleanField(default=False)
    attended = models.BooleanField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["session", "created_at", "id"]
        constraints = [
            models.UniqueConstraint(fields=["session", "student"], name="one_check_in_per_session"),
            models.CheckConstraint(
                name="pain_level_0_to_10",
                condition=models.Q(pain_level__isnull=True) | models.Q(pain_level__lte=10),
            ),
        ]
