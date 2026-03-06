from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Notification
from .serializers import NotificationSerializer


class NotificationListView(generics.ListAPIView):
    """GET /api/v1/notifications/ — last 50 notifications, newest first."""
    serializer_class   = NotificationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = Notification.objects.filter(recipient=self.request.user)
        if self.request.query_params.get("unread") == "true":
            qs = qs.filter(is_read=False)
        return qs.order_by("-created_at")[:50]


class NotificationMarkReadView(APIView):
    """PATCH /api/v1/notifications/<id>/read/ — mark single notification read."""
    permission_classes = [IsAuthenticated]

    def patch(self, request, pk):
        try:
            notif = Notification.objects.get(pk=pk, recipient=request.user)
        except Notification.DoesNotExist:
            return Response({"error": "Not found."}, status=404)
        notif.mark_read()
        return Response(NotificationSerializer(notif).data)


class MarkAllReadView(APIView):
    """POST /api/v1/notifications/mark-all-read/"""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        updated = Notification.objects.filter(
            recipient=request.user, is_read=False
        ).update(is_read=True)
        return Response({"marked_read": updated})


class UnreadCountView(APIView):
    """GET /api/v1/notifications/unread-count/ — fast badge count for navbar."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        count = Notification.objects.filter(
            recipient=request.user, is_read=False
        ).count()
        return Response({"unread_count": count})