from rest_framework import serializers

from .models import Gym, User


class GymSummarySerializer(serializers.ModelSerializer):
    class Meta:
        model = Gym
        fields = ["id", "name", "slug"]


class UserSerializer(serializers.ModelSerializer):
    gym = GymSummarySerializer(read_only=True)

    class Meta:
        model = User
        fields = ["id", "username", "display_name", "avatar_emoji", "color", "role", "gym", "is_active"]
        read_only_fields = ["id", "role", "gym"]


class PublicUserSerializer(serializers.ModelSerializer):
    """Minimal representation used when showing training partners."""

    class Meta:
        model = User
        fields = ["id", "display_name", "avatar_emoji", "color"]


class NewAccountSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150)
    display_name = serializers.CharField(max_length=80, required=False, allow_blank=True)
    avatar_emoji = serializers.CharField(max_length=16, required=False)
    color = serializers.CharField(max_length=7, required=False)

    def validate_username(self, value):
        if User.objects.filter(username=value).exists():
            raise serializers.ValidationError("This username is already taken.")
        return value


class GymSerializer(serializers.ModelSerializer):
    coach_count = serializers.IntegerField(read_only=True)
    student_count = serializers.IntegerField(read_only=True)
    coaches = NewAccountSerializer(many=True, write_only=True, required=False)

    class Meta:
        model = Gym
        fields = ["id", "name", "slug", "is_active", "created_at", "coach_count", "student_count", "coaches"]
        read_only_fields = ["slug", "created_at"]

    def validate_coaches(self, value):
        usernames = [c["username"] for c in value]
        if len(usernames) != len(set(usernames)):
            raise serializers.ValidationError("Usernames must be unique.")
        return value
