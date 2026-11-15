from django.contrib import admin

from .models import Drill, DrillCategory

admin.site.register(DrillCategory)


@admin.register(Drill)
class DrillAdmin(admin.ModelAdmin):
    list_display = ["name", "category", "archived"]
    list_filter = ["category", "archived"]
