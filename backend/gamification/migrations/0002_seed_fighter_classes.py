from django.db import migrations

from training.defaults import seed_gym_defaults


def seed_existing_gyms(apps, schema_editor):
    models = {"fighter_classes": apps.get_model("gamification", "FighterClass")}
    for gym in apps.get_model("accounts", "Gym").objects.all():
        seed_gym_defaults(gym, models)


class Migration(migrations.Migration):
    dependencies = [("gamification", "0001_initial"), ("accounts", "0010_user_fighter_class")]

    operations = [migrations.RunPython(seed_existing_gyms, migrations.RunPython.noop)]
