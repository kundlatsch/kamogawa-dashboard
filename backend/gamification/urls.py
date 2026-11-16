from django.urls import path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register("fighter-classes", views.FighterClassViewSet, basename="fighter-class")
router.register("missions", views.MissionViewSet, basename="mission")
router.register("mission-completions", views.MissionCompletionViewSet, basename="mission-completion")

urlpatterns = [
    path("leaderboard/", views.leaderboard, name="leaderboard"),
    path("ranking/", views.ranking, name="ranking"),
    path("me/progress/", views.my_progress, name="my-progress"),
    path("me/missions/<int:mission_id>/complete/", views.complete_mission, name="complete-mission"),
    *router.urls,
]
