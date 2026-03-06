from rest_framework import serializers
from .models import Notification


class NotificationSerializer(serializers.ModelSerializer):
    notification_type_display = serializers.CharField(
        source="get_notification_type_display", read_only=True
    )

    class Meta:
        model  = Notification
        fields = [
            "id", "notification_type", "notification_type_display",
            "title", "message", "is_read", "action_url",
            "metadata", "created_at",
        ]
        read_only_fields = [
            "id", "notification_type", "notification_type_display",
            "title", "message", "action_url", "metadata", "created_at",
        ]