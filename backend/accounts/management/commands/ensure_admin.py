import os

from django.core.management.base import BaseCommand

from accounts.models import User


class Command(BaseCommand):
    help = "Create the initial admin account from ADMIN_USERNAME / ADMIN_PASSWORD if it does not exist."

    def handle(self, *args, **options):
        username = os.environ.get("ADMIN_USERNAME")
        password = os.environ.get("ADMIN_PASSWORD")
        if not username or not password:
            self.stdout.write("ADMIN_USERNAME/ADMIN_PASSWORD not set; skipping admin bootstrap.")
            return
        if User.objects.filter(username=username).exists():
            self.stdout.write(f"Admin '{username}' already exists.")
            return
        User.objects.create_superuser(
            username=username, password=password, role=User.Role.ADMIN, display_name="Admin"
        )
        self.stdout.write(self.style.SUCCESS(f"Created admin '{username}'."))
