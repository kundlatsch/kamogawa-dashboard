from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register("drill-categories", views.DrillCategoryViewSet, basename="drill-category")
router.register("drills", views.DrillViewSet, basename="drill")

urlpatterns = router.urls
