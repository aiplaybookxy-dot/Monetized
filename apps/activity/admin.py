from django.contrib import admin
from .models import ActivityLog


@admin.register(ActivityLog)
class ActivityLogAdmin(admin.ModelAdmin):
    list_display = ["short_id", "username", "action", "ip_address", "object_type", "timestamp"]
    list_filter = ["action", "timestamp"]
    search_fields = ["user__username", "user__email", "ip_address", "description"]
    ordering = ["-timestamp"]
    date_hierarchy = "timestamp"

    # ── ALL fields readonly — logs are immutable ─────────────────────────────
    readonly_fields = [
        "id", "user", "action", "description", "ip_address", "user_agent",
        "object_type", "object_id", "metadata", "timestamp",
    ]

    def has_add_permission(self, request):
        return False  # Never create logs manually through admin

    def has_change_permission(self, request, obj=None):
        return False  # Never edit

    def has_delete_permission(self, request, obj=None):
        # Only superusers can delete (for GDPR/legal compliance purposes only)
        return request.user.is_superuser

    def username(self, obj):
        return obj.user.username if obj.user else "—"
    username.short_description = "User"

    def short_id(self, obj):
        return str(obj.id)[:8].upper()
    short_id.short_description = "Log ID"