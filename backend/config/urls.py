from django.conf import settings
from django.contrib import admin
from django.http import JsonResponse
from django.urls import include, path, re_path
from django.views.static import serve


def health(_request):
    return JsonResponse({"status": "ok"})


def public_config(_request):
    """Install-wide settings the frontend needs before anyone logs in."""
    return JsonResponse({"default_language": settings.DEFAULT_LANGUAGE, "languages": settings.UI_LANGUAGES})


urlpatterns = [
    path("django-admin/", admin.site.urls),
    path("api/health/", health, name="health"),
    path("api/config/", public_config, name="public-config"),
    path("api/", include("accounts.urls")),
    path("api/", include("training.urls")),
    path("api/", include("notifications.urls")),
    path("api/", include("progress.urls")),
    path("api/", include("gamification.urls")),
    re_path(r"^media/(?P<path>.*)$", serve, {"document_root": settings.MEDIA_ROOT}),
]
