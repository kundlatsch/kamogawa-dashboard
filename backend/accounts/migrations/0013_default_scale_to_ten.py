from django.db import migrations


def default_to_ten(apps, schema_editor):
    """The scale default became 1-10 (Gustavo); gyms still on the old 1-5 default follow it."""
    apps.get_model("accounts", "Gym").objects.filter(assessment_scale_min=1, assessment_scale_max=5).update(
        assessment_scale_max=10
    )


class Migration(migrations.Migration):
    dependencies = [("accounts", "0012_assessment_scale_range")]

    operations = [migrations.RunPython(default_to_ten, migrations.RunPython.noop)]
