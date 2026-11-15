from rest_framework import serializers

from .models import User


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "username", "display_name", "avatar_emoji", "color", "role", "is_active"]
        read_only_fields = ["id", "role"]


class PublicUserSerializer(serializers.ModelSerializer):
    """Minimal representation used when showing training partners."""

    class Meta:
        model = User
        fields = ["id", "display_name", "avatar_emoji", "color"]
