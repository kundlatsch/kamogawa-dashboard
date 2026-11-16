from django.db import migrations

from training.defaults import seed_gym_defaults


def seed_existing_gyms(apps, schema_editor):
    models = {
        "valences": apps.get_model("training", "Valence"),
        "microcycle_phases": apps.get_model("training", "MicrocyclePhase"),
    }
    for gym in apps.get_model("accounts", "Gym").objects.all():
        seed_gym_defaults(gym, models)


class Migration(migrations.Migration):
    dependencies = [("training", "0007_periodization")]

    operations = [migrations.RunPython(seed_existing_gyms, migrations.RunPython.noop)]
