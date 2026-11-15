from rest_framework.permissions import SAFE_METHODS, BasePermission


def _active_gym(user) -> bool:
    return user.gym_id is not None and user.gym.is_active


class IsCoach(BasePermission):
    """Coaches of an active gym (the coach module)."""

    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and user.is_coach and _active_gym(user))


class IsGymMember(BasePermission):
    """Coaches and students of an active gym."""

    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and _active_gym(user))


class IsCoachOrReadOnly(BasePermission):
    """Gym members can read; only coaches can write."""

    def has_permission(self, request, view):
        user = request.user
        if not (user and user.is_authenticated and _active_gym(user)):
            return False
        return request.method in SAFE_METHODS or user.is_coach


class IsAccountAdmin(BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.is_account_admin)
