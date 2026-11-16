from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver

from accounts.models import Gym
from training.defaults import seed_gym_defaults
from training.models import CheckIn

from .models import FighterClass, XpEvent
from .services import sync_attendance_xp


@receiver(post_save, sender=Gym)
def seed_new_gym(sender, instance, created, raw=False, **kwargs):
    if created and not raw:
        seed_gym_defaults(instance, {"fighter_classes": FighterClass})


@receiver(post_save, sender=CheckIn)
def attendance_changed(sender, instance, raw=False, **kwargs):
    if not raw:
        sync_attendance_xp(instance)


@receiver(post_delete, sender=CheckIn)
def check_in_removed(sender, instance, **kwargs):
    XpEvent.objects.filter(
        student_id=instance.student_id, session_id=instance.session_id, reason=XpEvent.Reason.ATTENDANCE
    ).delete()
