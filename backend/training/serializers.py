from django.db.models import Max
from rest_framework import serializers

from accounts.models import User

from .models import Assignment, Drill, DrillCategory, TrainingSession, WeeklySchedule


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
    class Meta:
        model = TrainingSession
        fields = ["id", "date", "start_time", "title", "notes", "kind", "status", "published_at"]
        read_only_fields = ["status", "published_at"]


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
