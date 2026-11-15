from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from .models import Gym, User


@admin.register(Gym)
class GymAdmin(admin.ModelAdmin):
    list_display = ["name", "slug", "is_active"]


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ["username", "display_name", "role", "gym", "is_active"]
    list_filter = ["role", "gym", "is_active"]
    fieldsets = BaseUserAdmin.fieldsets + (
        ("Dashboard", {"fields": ("role", "gym", "display_name", "avatar_emoji", "color")}),
    )
