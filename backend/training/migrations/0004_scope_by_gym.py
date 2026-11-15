import django.db.models.deletion
from django.db import migrations, models


def gym_fk(related_name):
    return models.ForeignKey(
        null=True,
        on_delete=django.db.models.deletion.CASCADE,
        related_name=related_name,
        to="accounts.gym",
    )


class Migration(migrations.Migration):
    """Step 1/3 of multi-gym support: add nullable gym references."""

    dependencies = [
        ("accounts", "0004_gym_required_constraint"),
        ("training", "0003_assignments"),
    ]

    operations = [
        migrations.AlterField(model_name="drillcategory", name="name", field=models.CharField(max_length=60)),
        migrations.AddField(model_name="drillcategory", name="gym", field=gym_fk("drill_categories")),
        migrations.AddField(model_name="drill", name="gym", field=gym_fk("drills")),
        migrations.AddField(model_name="trainingsession", name="gym", field=gym_fk("training_sessions")),
        migrations.AddField(
            model_name="weeklyschedule",
            name="gym",
            field=models.OneToOneField(
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="weekly_schedule",
                to="accounts.gym",
            ),
        ),
    ]
