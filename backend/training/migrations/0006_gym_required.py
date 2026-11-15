import django.db.models.deletion
from django.db import migrations, models


def gym_fk(related_name):
    return models.ForeignKey(
        on_delete=django.db.models.deletion.CASCADE,
        related_name=related_name,
        to="accounts.gym",
    )


class Migration(migrations.Migration):
    """Step 3/3 of multi-gym support: every training row must belong to a gym."""

    dependencies = [("training", "0005_assign_rows_to_default_gym")]

    operations = [
        migrations.AlterField(model_name="drillcategory", name="gym", field=gym_fk("drill_categories")),
        migrations.AlterField(model_name="drill", name="gym", field=gym_fk("drills")),
        migrations.AlterField(model_name="trainingsession", name="gym", field=gym_fk("training_sessions")),
        migrations.AlterField(
            model_name="weeklyschedule",
            name="gym",
            field=models.OneToOneField(
                on_delete=django.db.models.deletion.CASCADE,
                related_name="weekly_schedule",
                to="accounts.gym",
            ),
        ),
        migrations.AddConstraint(
            model_name="drillcategory",
            constraint=models.UniqueConstraint(fields=("gym", "name"), name="unique_category_name_per_gym"),
        ),
    ]
