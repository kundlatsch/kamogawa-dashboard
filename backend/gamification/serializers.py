from rest_framework import serializers

from training.serializers import NamedListSerializer

from .models import FighterClass, Mission, MissionCompletion


class FighterClassSerializer(NamedListSerializer):
    class Meta:
        model = FighterClass
        fields = ["id", "name", "description", "emoji", "color", "art_key", "order", "archived"]


class MissionSerializer(serializers.ModelSerializer):
    xp_reward = serializers.IntegerField(min_value=0, max_value=10_000, required=False)

    class Meta:
        model = Mission
        fields = [
            "id",
            "title",
            "description",
            "emoji",
            "xp_reward",
            "active",
            "starts_on",
            "ends_on",
            "repeatable",
            "created_at",
        ]
        read_only_fields = ["created_at"]

    def validate(self, attrs):
        starts = attrs.get("starts_on", getattr(self.instance, "starts_on", None))
        ends = attrs.get("ends_on", getattr(self.instance, "ends_on", None))
        if starts and ends and ends < starts:
            raise serializers.ValidationError({"ends_on": "The end date must be after the start date."})
        return attrs


class MissionCompletionSerializer(serializers.ModelSerializer):
    mission_detail = MissionSerializer(source="mission", read_only=True)

    class Meta:
        model = MissionCompletion
        fields = ["id", "mission", "mission_detail", "student", "status", "note", "created_at", "reviewed_at"]
