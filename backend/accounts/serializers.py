from django.contrib.auth import password_validation
from rest_framework import serializers

from .models import Gym, User


class GymSummarySerializer(serializers.ModelSerializer):
    class Meta:
        model = Gym
        fields = ["id", "name", "slug", "color", "assessment_scale_min", "assessment_scale_max"]


class OwnGymSerializer(serializers.ModelSerializer):
    """What a coach may change about their own gym."""

    checkin_deadline_minutes = serializers.IntegerField(min_value=0, max_value=24 * 60, required=False)
    assessment_scale_min = serializers.IntegerField(min_value=0, max_value=99, required=False)
    assessment_scale_max = serializers.IntegerField(min_value=1, max_value=100, required=False)

    class Meta:
        model = Gym
        fields = [
            "id",
            "name",
            "slug",
            "color",
            "checkin_deadline_minutes",
            "assessment_scale_min",
            "assessment_scale_max",
        ]
        read_only_fields = ["id", "slug"]

    def validate(self, attrs):
        low = attrs.get("assessment_scale_min", getattr(self.instance, "assessment_scale_min", 1))
        high = attrs.get("assessment_scale_max", getattr(self.instance, "assessment_scale_max", 10))
        if low >= high:
            raise serializers.ValidationError({"assessment_scale_max": "The maximum must be above the minimum."})
        return attrs


class ChangePasswordSerializer(serializers.Serializer):
    current_password = serializers.CharField(trim_whitespace=False)
    new_password = serializers.CharField(trim_whitespace=False)

    def validate_current_password(self, value):
        if not self.context["request"].user.check_password(value):
            raise serializers.ValidationError("The current password is incorrect.")
        return value

    def validate(self, attrs):
        password_validation.validate_password(attrs["new_password"], self.context["request"].user)
        return attrs


def avatar_url(user) -> str | None:
    return user.avatar.url if user.avatar else None


class UserSerializer(serializers.ModelSerializer):
    gym = GymSummarySerializer(read_only=True)
    avatar_url = serializers.SerializerMethodField()
    weekly_classes = serializers.IntegerField(min_value=0, max_value=14, required=False, allow_null=True)

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "display_name",
            "avatar_emoji",
            "avatar_url",
            "color",
            "handedness",
            "limitations",
            "weekly_classes",
            "fighter_class",
            "role",
            "gym",
            "is_active",
        ]
        read_only_fields = ["id", "role", "gym"]

    def get_avatar_url(self, user):
        return avatar_url(user)

    def validate_fighter_class(self, value):
        request = self.context.get("request")
        if value is not None and (request is None or value.gym_id != request.user.gym_id):
            raise serializers.ValidationError("Unknown fighter class.")
        return value


class ProfileSerializer(serializers.ModelSerializer):
    """Fields a user may change about themselves (never the login or role)."""

    display_name = serializers.CharField(max_length=80, allow_blank=False, trim_whitespace=True)
    color = serializers.RegexField(r"^#[0-9a-fA-F]{6}$", max_length=7)
    weekly_classes = serializers.IntegerField(min_value=0, max_value=14, required=False, allow_null=True)

    class Meta:
        model = User
        fields = ["display_name", "avatar_emoji", "color", "handedness", "limitations", "weekly_classes"]


class PublicUserSerializer(serializers.ModelSerializer):
    """Minimal representation used when showing training partners."""

    avatar_url = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "display_name", "avatar_emoji", "avatar_url", "color"]

    def get_avatar_url(self, user):
        return avatar_url(user)


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
        fields = ["id", "name", "slug", "color", "is_active", "created_at", "coach_count", "student_count", "coaches"]
        read_only_fields = ["slug", "created_at"]

    def validate_coaches(self, value):
        usernames = [c["username"] for c in value]
        if len(usernames) != len(set(usernames)):
            raise serializers.ValidationError("Usernames must be unique.")
        return value
