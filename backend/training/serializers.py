from django.db.models import Max
from rest_framework import serializers

from accounts.models import User

from .models import (
    Assignment,
    Drill,
    DrillCategory,
    Macrocycle,
    Mesocycle,
    Microcycle,
    MicrocyclePhase,
    TrainingSession,
    Valence,
    WeeklySchedule,
)
from .periodization import GymTimeline, layout


class GymScopedSerializer(serializers.ModelSerializer):
    """Restricts every related-object field to the requesting user's gym.

    `gym_scoped_fields` maps a field name to a function(gym) -> queryset, so ids from
    another gym fail validation exactly like ids that do not exist.
    """

    gym_scoped_fields: dict = {}

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        request = self.context.get("request")
        gym = getattr(getattr(request, "user", None), "gym", None)
        for name, queryset_for in self.gym_scoped_fields.items():
            field = self.fields.get(name)
            if field is None or field.read_only:
                continue
            target = field.child_relation if isinstance(field, serializers.ManyRelatedField) else field
            target.queryset = queryset_for(gym)

    @property
    def gym(self):
        return self.context["request"].user.gym


class WeeklyScheduleSerializer(serializers.ModelSerializer):
    class Meta:
        model = WeeklySchedule
        fields = ["training_weekdays", "default_start_time"]

    def validate_training_weekdays(self, value):
        if not isinstance(value, list) or any(not isinstance(d, int) or not 0 <= d <= 6 for d in value):
            raise serializers.ValidationError("Use a list of weekday numbers from 0 (Monday) to 6 (Sunday).")
        return sorted(set(value))


class TrainingSessionSerializer(serializers.ModelSerializer):
    objective = serializers.SerializerMethodField()

    class Meta:
        model = TrainingSession
        fields = [
            "id",
            "date",
            "start_time",
            "title",
            "notes",
            "kind",
            "status",
            "published_at",
            "objective_override",
            "objective",
        ]
        read_only_fields = ["status", "published_at"]

    def get_objective(self, session) -> str:
        """The override, or the objective of the microcycle containing the session's date."""
        timeline = self.context.get("timeline")
        if timeline is None:
            timeline = self.context["timeline"] = GymTimeline(session.gym)
        return timeline.objective_for(session)


class DrillCategorySerializer(GymScopedSerializer):
    class Meta:
        model = DrillCategory
        fields = ["id", "name", "color", "order"]

    def validate_name(self, value):
        duplicates = DrillCategory.objects.filter(gym=self.gym, name__iexact=value)
        if self.instance:
            duplicates = duplicates.exclude(pk=self.instance.pk)
        if duplicates.exists():
            raise serializers.ValidationError("A category with this name already exists.")
        return value


class DrillSerializer(GymScopedSerializer):
    gym_scoped_fields = {"category": lambda gym: DrillCategory.objects.filter(gym=gym)}

    class Meta:
        model = Drill
        fields = [
            "id",
            "name",
            "description",
            "emoji",
            "color",
            "youtube_url",
            "thumbnail_url",
            "category",
            "default_rounds",
            "default_duration_minutes",
            "archived",
        ]


class AssignmentSerializer(GymScopedSerializer):
    gym_scoped_fields = {
        "session": lambda gym: TrainingSession.objects.filter(gym=gym),
        "drill": lambda gym: Drill.objects.filter(gym=gym),
        "participants": lambda gym: User.objects.filter(gym=gym, role=User.Role.STUDENT, is_active=True),
    }

    participants = serializers.PrimaryKeyRelatedField(many=True, required=False, queryset=User.objects.none())
    drill_detail = DrillSerializer(source="drill", read_only=True)

    class Meta:
        model = Assignment
        fields = [
            "id",
            "session",
            "drill",
            "drill_detail",
            "participants",
            "is_broadcast",
            "order",
            "notes",
            "rounds",
            "duration_minutes",
        ]
        read_only_fields = ["order"]

    def validate(self, attrs):
        is_broadcast = attrs.get("is_broadcast", getattr(self.instance, "is_broadcast", False))
        if "participants" in attrs:
            participants = attrs["participants"]
        elif self.instance:
            participants = list(self.instance.participants.all())
        else:
            participants = []
        if is_broadcast and participants:
            raise serializers.ValidationError("Broadcast assignments cannot have participants.")
        if not is_broadcast and not participants:
            raise serializers.ValidationError("Pick at least one student or make it a broadcast.")
        if self.instance and "session" in attrs and attrs["session"] != self.instance.session:
            raise serializers.ValidationError({"session": "An assignment cannot move between sessions."})
        return attrs

    def create(self, validated_data):
        session = validated_data["session"]
        last = session.assignments.aggregate(last=Max("order"))["last"]
        validated_data["order"] = 0 if last is None else last + 1
        return super().create(validated_data)


class NamedListSerializer(GymScopedSerializer):
    """Coach-editable lists (valences, phases): names are unique per gym, ignoring case."""

    def validate_name(self, value):
        duplicates = self.Meta.model.objects.filter(gym=self.gym, name__iexact=value)
        if self.instance:
            duplicates = duplicates.exclude(pk=self.instance.pk)
        if duplicates.exists():
            raise serializers.ValidationError("An item with this name already exists.")
        return value


class ValenceSerializer(NamedListSerializer):
    class Meta:
        model = Valence
        fields = ["id", "name", "color", "order", "archived"]


class MicrocyclePhaseSerializer(NamedListSerializer):
    class Meta:
        model = MicrocyclePhase
        fields = ["id", "name", "color", "order", "archived"]


def next_order(queryset) -> int:
    last = queryset.aggregate(last=Max("order"))["last"]
    return 0 if last is None else last + 1


class MicrocycleSerializer(GymScopedSerializer):
    gym_scoped_fields = {
        "mesocycle": lambda gym: Mesocycle.objects.filter(macrocycle__gym=gym),
        "phase": lambda gym: MicrocyclePhase.objects.filter(gym=gym),
    }
    length_days = serializers.IntegerField(min_value=1, max_value=90, required=False)

    class Meta:
        model = Microcycle
        fields = ["id", "mesocycle", "phase", "objective", "length_days", "order"]
        read_only_fields = ["order"]

    def validate(self, attrs):
        if self.instance and "mesocycle" in attrs and attrs["mesocycle"] != self.instance.mesocycle:
            raise serializers.ValidationError({"mesocycle": "A microcycle cannot move between mesocycles."})
        return attrs

    def create(self, validated_data):
        validated_data["order"] = next_order(validated_data["mesocycle"].microcycles)
        return super().create(validated_data)


class MesocycleSerializer(GymScopedSerializer):
    gym_scoped_fields = {
        "macrocycle": lambda gym: Macrocycle.objects.filter(gym=gym),
        "valence": lambda gym: Valence.objects.filter(gym=gym),
    }

    class Meta:
        model = Mesocycle
        fields = ["id", "macrocycle", "valence", "name", "notes", "order"]
        read_only_fields = ["order"]

    def validate(self, attrs):
        if self.instance and "macrocycle" in attrs and attrs["macrocycle"] != self.instance.macrocycle:
            raise serializers.ValidationError({"macrocycle": "A mesocycle cannot move between macrocycles."})
        return attrs

    def create(self, validated_data):
        """A new mesocycle starts with one week per active phase (e.g. adaptation → recovery)."""
        validated_data["order"] = next_order(validated_data["macrocycle"].mesocycles)
        mesocycle = super().create(validated_data)
        phases = MicrocyclePhase.objects.filter(gym=self.gym, archived=False)
        Microcycle.objects.bulk_create(
            Microcycle(mesocycle=mesocycle, phase=phase, order=position) for position, phase in enumerate(phases)
        )
        return mesocycle


class MacrocycleSerializer(GymScopedSerializer):
    """A macrocycle with its whole plan laid out on the calendar (read-only nested cycles)."""

    end_date = serializers.SerializerMethodField()
    mesocycles = serializers.SerializerMethodField()

    class Meta:
        model = Macrocycle
        fields = ["id", "name", "start_date", "notes", "end_date", "mesocycles"]

    def _spans(self, macrocycle):
        cache = self.context.setdefault("_spans", {})
        if macrocycle.pk not in cache:
            cache[macrocycle.pk] = layout(macrocycle)
        return cache[macrocycle.pk]

    def get_end_date(self, macrocycle):
        spans = self._spans(macrocycle)
        return spans[-1].end if spans else None

    def get_mesocycles(self, macrocycle):
        spans = self._spans(macrocycle)
        result = []
        for mesocycle in macrocycle.mesocycles.all():
            own = [span for span in spans if span.mesocycle.pk == mesocycle.pk]
            result.append(
                {
                    "id": mesocycle.id,
                    "name": mesocycle.name,
                    "notes": mesocycle.notes,
                    "order": mesocycle.order,
                    "valence": ValenceSerializer(mesocycle.valence).data,
                    "start_date": own[0].start if own else None,
                    "end_date": own[-1].end if own else None,
                    "microcycles": [
                        {
                            "id": span.microcycle.id,
                            "order": span.microcycle.order,
                            "objective": span.microcycle.objective,
                            "length_days": span.microcycle.length_days,
                            "phase": (
                                MicrocyclePhaseSerializer(span.microcycle.phase).data
                                if span.microcycle.phase
                                else None
                            ),
                            "start_date": span.start,
                            "end_date": span.end,
                        }
                        for span in own
                    ],
                }
            )
        return result
