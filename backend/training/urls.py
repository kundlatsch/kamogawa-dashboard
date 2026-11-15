from django.urls import path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register("drill-categories", views.DrillCategoryViewSet, basename="drill-category")
router.register("drills", views.DrillViewSet, basename="drill")
router.register("sessions", views.TrainingSessionViewSet, basename="session")
router.register("assignments", views.AssignmentViewSet, basename="assignment")

urlpatterns = [
    path("schedule/", views.weekly_schedule, name="weekly-schedule"),
    *router.urls,
]
