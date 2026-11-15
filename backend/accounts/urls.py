from django.urls import path
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from . import views

router = DefaultRouter()
router.register("students", views.StudentViewSet, basename="student")
router.register("gyms", views.GymViewSet, basename="gym")
router.register(r"gyms/(?P<gym_pk>\d+)/coaches", views.GymCoachViewSet, basename="gym-coach")

urlpatterns = [
    path("auth/token/", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("auth/token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("auth/me/", views.me, name="me"),
    path("auth/change-password/", views.change_password, name="change-password"),
    path("my-gym/", views.my_gym, name="my-gym"),
    *router.urls,
]
