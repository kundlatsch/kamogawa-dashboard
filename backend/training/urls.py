from django.urls import path
from rest_framework.routers import DefaultRouter

from . import cycle_views, student_views, views

router = DefaultRouter()
router.register("drill-categories", views.DrillCategoryViewSet, basename="drill-category")
router.register("drills", views.DrillViewSet, basename="drill")
router.register("sessions", views.TrainingSessionViewSet, basename="session")
router.register("assignments", views.AssignmentViewSet, basename="assignment")
router.register("checkins", views.CheckInViewSet, basename="checkin")
router.register("valences", cycle_views.ValenceViewSet, basename="valence")
router.register("microcycle-phases", cycle_views.MicrocyclePhaseViewSet, basename="microcycle-phase")
router.register("session-blocks", cycle_views.SessionBlockViewSet, basename="session-block")
router.register("macrocycles", cycle_views.MacrocycleViewSet, basename="macrocycle")
router.register("mesocycles", cycle_views.MesocycleViewSet, basename="mesocycle")
router.register("microcycles", cycle_views.MicrocycleViewSet, basename="microcycle")

urlpatterns = [
    path("schedule/", views.weekly_schedule, name="weekly-schedule"),
    path("cycles/current/", cycle_views.current_cycle, name="current-cycle"),
    path("me/routine/", student_views.my_routine, name="my-routine"),
    path("me/upcoming/", student_views.my_upcoming, name="my-upcoming"),
    path("me/calendar/", student_views.my_calendar, name="my-calendar"),
    path("me/sessions/<int:session_id>/", student_views.my_session, name="my-session"),
    path("me/checkins/<int:session_id>/", student_views.my_checkin, name="my-checkin"),
    *router.urls,
]
