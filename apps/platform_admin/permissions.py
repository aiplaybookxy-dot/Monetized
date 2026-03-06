"""
apps/platform_admin/permissions.py

IsPlatformOwner: grants access to role=admin, role=platform_owner, is_superuser.
"""
from rest_framework.permissions import BasePermission


class IsPlatformOwner(BasePermission):
    """
    Allow: is_superuser OR role in ('admin', 'platform_owner').
    Reject everything else with 403.
    """
    message = "Platform owner access required."

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        return (
            user.is_superuser
            or getattr(user, "role", "") in ("admin", "platform_owner")
        )