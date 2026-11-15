from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from .models import User


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ["username", "display_name", "role", "is_active"]
    list_filter = ["role", "is_active"]
    fieldsets = BaseUserAdmin.fieldsets + (
        ("Dashboard", {"fields": ("role", "display_name", "avatar_emoji", "color")}),
    )
