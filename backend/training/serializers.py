from rest_framework import serializers

from .models import Drill, DrillCategory, TrainingSession, WeeklySchedule


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
