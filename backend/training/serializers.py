from rest_framework import serializers

from .models import Drill, DrillCategory


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
