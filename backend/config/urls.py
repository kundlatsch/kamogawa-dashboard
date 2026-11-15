from django.contrib import admin
from django.http import JsonResponse
from django.urls import include, path


def health(_request):
    return JsonResponse({"status": "ok"})


urlpatterns = [
    path("django-admin/", admin.site.urls),
    path("api/health/", health, name="health"),
    path("api/", include("accounts.urls")),
    path("api/", include("training.urls")),
    path("api/", include("notifications.urls")),
]
