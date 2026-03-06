from django.contrib import admin
from .models import Dispute, DisputeMessage, EvidenceFile


class DisputeMessageInline(admin.TabularInline):
    model  = DisputeMessage
    extra  = 0
    readonly_fields = ["sender", "body", "is_mod_note", "created_at"]
    can_delete = False


class EvidenceFileInline(admin.TabularInline):
    model  = EvidenceFile
    extra  = 0
    readonly_fields = ["uploaded_by", "file", "caption", "uploaded_at"]
    can_delete = False


@admin.register(Dispute)
class DisputeAdmin(admin.ModelAdmin):
    list_display   = ["id", "order", "opened_by", "reason", "status", "final_verdict", "created_at"]
    list_filter    = ["status", "reason", "final_verdict"]
    search_fields  = ["order__id", "opened_by__username"]
    readonly_fields = ["id", "order", "opened_by", "created_at", "updated_at", "resolved_at"]
    inlines        = [DisputeMessageInline, EvidenceFileInline]

    def has_add_permission(self, request):
        return False


@admin.register(DisputeMessage)
class DisputeMessageAdmin(admin.ModelAdmin):
    list_display  = ["dispute", "sender", "is_mod_note", "created_at"]
    readonly_fields = ["dispute", "sender", "body", "is_mod_note", "created_at"]

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False