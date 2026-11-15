from django.db import migrations

DEFAULT_GYM_NAME = "Chacão Boxing Team"
DEFAULT_GYM_SLUG = "chacao-boxing-team"


def move_existing_users_into_default_gym(apps, schema_editor):
    """Single-gym installs become the first tenant; the old ADMIN role becomes ACCOUNT_ADMIN."""
    User = apps.get_model("accounts", "User")
    Gym = apps.get_model("accounts", "Gym")
    User.objects.filter(role="ADMIN").update(role="ACCOUNT_ADMIN", gym=None)
    members = User.objects.exclude(role="ACCOUNT_ADMIN")
    if members.exists():
        gym, _ = Gym.objects.get_or_create(slug=DEFAULT_GYM_SLUG, defaults={"name": DEFAULT_GYM_NAME})
        members.update(gym=gym)


def back_to_single_gym(apps, schema_editor):
    User = apps.get_model("accounts", "User")
    User.objects.filter(role="ACCOUNT_ADMIN").update(role="ADMIN")


class Migration(migrations.Migration):
    dependencies = [("accounts", "0002_gyms_and_account_admin")]

    operations = [migrations.RunPython(move_existing_users_into_default_gym, back_to_single_gym)]
