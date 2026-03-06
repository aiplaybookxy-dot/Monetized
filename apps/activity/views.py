from django.contrib.auth import get_user_model
from django.db.models import Q
from rest_framework import generics
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import PermissionDenied

from .models import ActivityLog
from .serializers import ActivityLogSerializer

User = get_user_model()


class IsModerator(IsAuthenticated):
    """Allow access only to users who can_moderate (Moderator or Admin role)."""
    def has_permission(self, request, view):
        if not super().has_permission(request, view):
            return False
        if not request.user.can_moderate:
            raise PermissionDenied("Moderator or Admin access required.")
        return True


class SystemLogView(generics.ListAPIView):
    """
    GET /api/v1/activity/logs/
    Full system log — Admin & Moderators only.
    Supports ?search=<username|action>&action=<ACTION_TYPE>&user_id=<uuid>
    Write-heavy model → this view is intentionally read-light (paginated, indexed).
    """
    serializer_class = ActivityLogSerializer
    permission_classes = [IsModerator]

    def get_queryset(self):
        qs = ActivityLog.objects.select_related("user").order_by("-timestamp")

        search = self.request.query_params.get("search", "").strip()
        action = self.request.query_params.get("action", "").strip()
        user_id = self.request.query_params.get("user_id", "").strip()
        from_date = self.request.query_params.get("from_date", "").strip()
        to_date = self.request.query_params.get("to_date", "").strip()

        if search:
            qs = qs.filter(
                Q(user__username__icontains=search)
                | Q(user__email__icontains=search)
                | Q(description__icontains=search)
                | Q(ip_address__icontains=search)
            )
        if action:
            qs = qs.filter(action=action)
        if user_id:
            qs = qs.filter(user__id=user_id)
        if from_date:
            qs = qs.filter(timestamp__date__gte=from_date)
        if to_date:
            qs = qs.filter(timestamp__date__lte=to_date)

        return qs


class UserActivityLogView(generics.ListAPIView):
    """
    GET /api/v1/activity/logs/user/<user_id>/
    Per-user audit trail — Moderators can view any user's logs.
    """
    serializer_class = ActivityLogSerializer
    permission_classes = [IsModerator]

    def get_queryset(self):
        target_user_id = self.kwargs["user_id"]
        return (
            ActivityLog.objects
            .filter(user__id=target_user_id)
            .select_related("user")
            .order_by("-timestamp")
        )


class MyActivityLogView(generics.ListAPIView):
    """
    GET /api/v1/activity/mine/
    Each user can view their own activity — last 100 entries.
    """
    serializer_class = ActivityLogSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return (
            ActivityLog.objects
            .filter(user=self.request.user)
            .order_by("-timestamp")[:100]
        )