from rest_framework import serializers

from training.serializers import NamedListSerializer

from .models import FighterClass


ART_KEYS = ["out-boxer", "swarmer", "slugger", "boxer-puncher", "counterpuncher", "switch-hitter"]


class FighterClassSerializer(NamedListSerializer):
    art_key = serializers.ChoiceField(choices=[""] + ART_KEYS, required=False, allow_blank=True)
    image_url = serializers.SerializerMethodField()

    class Meta:
        model = FighterClass
        fields = ["id", "name", "description", "emoji", "color", "art_key", "image_url", "order", "archived"]

    def get_image_url(self, fighter_class):
        return fighter_class.image.url if fighter_class.image else None
