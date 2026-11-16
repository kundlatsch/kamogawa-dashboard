from rest_framework import serializers

from accounts.models import User
from training.serializers import GymScopedSerializer, NamedListSerializer

from .models import FighterClass, Mission, MissionCompletion, XpEvent


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


class XpEventSerializer(GymScopedSerializer):
    """XP history; coaches create MANUAL events (positive or negative)."""

    gym_scoped_fields = {"student": lambda gym: User.objects.filter(gym=gym, role=User.Role.STUDENT)}
    student = serializers.PrimaryKeyRelatedField(queryset=User.objects.none())
    amount = serializers.IntegerField(min_value=-10_000, max_value=10_000)
    mission_title = serializers.CharField(source="mission_completion.mission.title", read_only=True, default="")
    session_date = serializers.DateField(source="session.date", read_only=True, default=None)

    class Meta:
        model = XpEvent
        fields = ["id", "student", "amount", "reason", "note", "mission_title", "session_date", "created_at"]
        read_only_fields = ["reason", "created_at"]

    def validate_amount(self, value):
        if value == 0:
            raise serializers.ValidationError("Use a positive or negative amount.")
        return value
