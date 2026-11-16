from django.db.models.signals import post_save
from django.dispatch import receiver

from accounts.models import Gym
from training.defaults import seed_gym_defaults

from .models import FighterClass


@receiver(post_save, sender=Gym)
def seed_new_gym(sender, instance, created, raw=False, **kwargs):
    if created and not raw:
        seed_gym_defaults(instance, {"fighter_classes": FighterClass})
