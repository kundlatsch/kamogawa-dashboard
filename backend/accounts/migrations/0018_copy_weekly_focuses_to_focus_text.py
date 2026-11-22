from django.db import migrations


def copy_latest_focuses(apps, schema_editor):
    """Start each student's free-text focuses from their most recent weekly focuses, so nothing is lost."""
    User = apps.get_model("accounts", "User")
    WeeklyFocus = apps.get_model("progress", "WeeklyFocus")
    for student in User.objects.filter(focus_text=""):
        focuses = WeeklyFocus.objects.filter(student=student).select_related("focus").order_by("-week_start", "position")
        latest = list(focuses)
        if not latest:
            continue
        week = latest[0].week_start
        lines = []
        for focus in (f for f in latest if f.week_start == week):
            lines.append(f"{focus.focus.name} ({focus.note})" if focus.note else focus.focus.name)
        student.focus_text = "\n".join(lines)
        student.save(update_fields=["focus_text"])


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0017_user_focus_text"),
        ("progress", "0006_studentpoint"),
    ]

    operations = [migrations.RunPython(copy_latest_focuses, migrations.RunPython.noop)]
