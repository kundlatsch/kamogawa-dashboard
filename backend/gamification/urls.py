from django.urls import path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register("fighter-classes", views.FighterClassViewSet, basename="fighter-class")

urlpatterns = [
    path("leaderboard/", views.leaderboard, name="leaderboard"),
    path("ranking/", views.ranking, name="ranking"),
    *router.urls,
]
