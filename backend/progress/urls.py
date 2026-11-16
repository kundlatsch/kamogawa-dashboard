from django.urls import path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register("metrics", views.MetricViewSet, basename="metric")

urlpatterns = [
    path("assessments/", views.assessments, name="assessments"),
    path("assessments/set/", views.set_assessment, name="set-assessment"),
    path("me/assessments/", views.my_assessments, name="my-assessments"),
    *router.urls,
]
