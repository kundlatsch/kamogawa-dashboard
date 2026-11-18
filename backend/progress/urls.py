from django.urls import path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register("metrics", views.MetricViewSet, basename="metric")
router.register("focus-options", views.FocusOptionViewSet, basename="focus-option")
router.register("coach-notes", views.CoachNoteViewSet, basename="coach-note")
router.register("student-points", views.StudentPointViewSet, basename="student-point")
router.register("homework", views.HomeworkViewSet, basename="homework")

urlpatterns = [
    path("assessments/", views.assessments, name="assessments"),
    path("assessments/set/", views.set_assessment, name="set-assessment"),
    path("me/assessments/", views.my_assessments, name="my-assessments"),
    path("weekly-focuses/", views.weekly_focuses, name="weekly-focuses"),
    path("weekly-focuses/set/", views.set_weekly_focus, name="set-weekly-focus"),
    path("me/week/", views.my_week, name="my-week"),
    path("me/points/", views.my_points, name="my-points"),
    *router.urls,
]
