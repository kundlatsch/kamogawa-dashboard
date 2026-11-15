from rest_framework import serializers

from django.db.models import Max

from accounts.models import User

from .models import Assignment, Drill, DrillCategory, TrainingSession, WeeklySchedule


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


class DrillCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = DrillCategory
        fields = ["id", "name", "color", "order"]


class DrillSerializer(serializers.ModelSerializer):
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


class AssignmentSerializer(serializers.ModelSerializer):
    participants = serializers.PrimaryKeyRelatedField(
        many=True,
        required=False,
        queryset=User.objects.filter(role=User.Role.STUDENT, is_active=True),
    )
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
