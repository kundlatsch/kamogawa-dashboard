from django.db import migrations

from training.defaults import seed_gym_defaults


def seed_existing_gyms(apps, schema_editor):
    models = {"session_blocks": apps.get_model("training", "SessionBlock")}
    for gym in apps.get_model("accounts", "Gym").objects.all():
        seed_gym_defaults(gym, models)


class Migration(migrations.Migration):
    dependencies = [("training", "0009_session_blocks")]

    operations = [migrations.RunPython(seed_existing_gyms, migrations.RunPython.noop)]
