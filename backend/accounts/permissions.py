from rest_framework.permissions import SAFE_METHODS, BasePermission


class IsStaffRole(BasePermission):
    """Admins and coaches."""

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.is_staff_role)


class IsAdminRole(BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.is_admin_role)


class IsStaffRoleOrReadOnly(BasePermission):
    """Any authenticated user can read; only admins and coaches can write."""

    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        return request.method in SAFE_METHODS or request.user.is_staff_role
