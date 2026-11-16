from django.db import migrations

from training.defaults import seed_gym_defaults


def seed_existing_gyms(apps, schema_editor):
    models = {"metrics": apps.get_model("progress", "Metric")}
    for gym in apps.get_model("accounts", "Gym").objects.all():
        seed_gym_defaults(gym, models)


class Migration(migrations.Migration):
    dependencies = [("progress", "0001_initial"), ("accounts", "0007_user_avatar")]

    operations = [migrations.RunPython(seed_existing_gyms, migrations.RunPython.noop)]
