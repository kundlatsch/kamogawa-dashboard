from datetime import date

import pytest
from django.db import connection
from django.db.migrations.executor import MigrationExecutor


@pytest.mark.django_db(transaction=True)
def test_latest_weekly_focuses_become_the_focus_text():
    executor = MigrationExecutor(connection)
    before = [("accounts", "0017_user_focus_text"), ("progress", "0006_studentpoint")]
    executor.migrate(before)
    apps = executor.loader.project_state(before).apps
    Gym = apps.get_model("accounts", "Gym")
    User = apps.get_model("accounts", "User")
    FocusOption = apps.get_model("progress", "FocusOption")
    WeeklyFocus = apps.get_model("progress", "WeeklyFocus")
    gym = Gym.objects.create(name="G", slug="g-focus")
    ana = User.objects.create(username="ana-focus", gym=gym, role="STUDENT")
    guard, jab, old = (FocusOption.objects.create(gym=gym, name=n) for n in ["Guarda alta", "Jab", "Antigo"])
    WeeklyFocus.objects.create(student=ana, week_start=date(2026, 11, 9), position=1, focus=old)
    WeeklyFocus.objects.create(student=ana, week_start=date(2026, 11, 16), position=2, focus=jab, note="Mais rápido")
    WeeklyFocus.objects.create(student=ana, week_start=date(2026, 11, 16), position=1, focus=guard)

    executor = MigrationExecutor(connection)
    executor.migrate([("accounts", "0018_copy_weekly_focuses_to_focus_text")])
    apps = executor.loader.project_state([("accounts", "0018_copy_weekly_focuses_to_focus_text")]).apps
    assert apps.get_model("accounts", "User").objects.get(username="ana-focus").focus_text == "Guarda alta\nJab (Mais rápido)"
    executor = MigrationExecutor(connection)
    executor.migrate(executor.loader.graph.leaf_nodes())
