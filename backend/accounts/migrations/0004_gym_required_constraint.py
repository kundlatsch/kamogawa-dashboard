from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("accounts", "0003_move_users_into_default_gym")]

    operations = [
        migrations.AddConstraint(
            model_name="user",
            constraint=models.CheckConstraint(
                condition=models.Q(("role", "ACCOUNT_ADMIN"), ("gym__isnull", False), _connector="OR"),
                name="gym_required_unless_account_admin",
            ),
        ),
    ]
