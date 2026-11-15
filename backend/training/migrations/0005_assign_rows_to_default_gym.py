from django.db import migrations

TENANT_MODELS = ["drillcategory", "drill", "weeklyschedule", "trainingsession"]


def assign_existing_rows_to_default_gym(apps, schema_editor):
    """Step 2/3: rows created before multi-gym support belong to the first gym."""
    Gym = apps.get_model("accounts", "Gym")
    if not any(apps.get_model("training", name).objects.exists() for name in TENANT_MODELS):
        return
    gym, _ = Gym.objects.get_or_create(slug="chacao-boxing-team", defaults={"name": "Chacão Boxing Team"})
    for name in TENANT_MODELS:
        apps.get_model("training", name).objects.filter(gym__isnull=True).update(gym=gym)


class Migration(migrations.Migration):
    dependencies = [("training", "0004_scope_by_gym")]

    operations = [migrations.RunPython(assign_existing_rows_to_default_gym, migrations.RunPython.noop)]
