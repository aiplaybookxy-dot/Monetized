from rest_framework import serializers
from .models import ActivityLog


class ActivityLogSerializer(serializers.ModelSerializer):
    username = serializers.SerializerMethodField()
    action_display = serializers.CharField(source="get_action_display", read_only=True)

    class Meta:
        model = ActivityLog
        fields = [
            "id", "user", "username", "action", "action_display",
            "description", "ip_address", "user_agent",
            "object_type", "object_id", "metadata", "timestamp",
        ]
        # ALL fields are read-only — logs are never writable via API
        read_only_fields = fields

    def get_username(self, obj):
        return obj.user.username if obj.user else "system"