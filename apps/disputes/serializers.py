from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import Dispute, DisputeMessage, EvidenceFile, DisputeReason, DisputeStatus, DisputeVerdict

User = get_user_model()


class EvidenceFileSerializer(serializers.ModelSerializer):
    uploaded_by_username = serializers.CharField(source="uploaded_by.username", read_only=True)

    class Meta:
        model  = EvidenceFile
        fields = ["id", "file", "caption", "uploaded_by_username", "uploaded_at"]
        read_only_fields = ["id", "uploaded_by_username", "uploaded_at"]


class DisputeMessageSerializer(serializers.ModelSerializer):
    sender_username = serializers.CharField(source="sender.username", read_only=True)
    sender_role     = serializers.CharField(source="sender.role", read_only=True)

    class Meta:
        model  = DisputeMessage
        fields = ["id", "sender_username", "sender_role", "body", "is_mod_note", "created_at"]
        read_only_fields = ["id", "sender_username", "sender_role", "is_mod_note", "created_at"]


class DisputeCreateSerializer(serializers.Serializer):
    """Buyer submits to open a dispute."""
    reason      = serializers.ChoiceField(choices=DisputeReason.choices)
    description = serializers.CharField(min_length=20, max_length=3000)


class DisputeResolveSerializer(serializers.Serializer):
    """Moderator submits verdict."""
    verdict         = serializers.ChoiceField(choices=DisputeVerdict.choices)
    resolution_note = serializers.CharField(min_length=10, max_length=3000)


class DisputeSerializer(serializers.ModelSerializer):
    """Full dispute detail — used by courtroom and dispute room views."""
    opened_by_username   = serializers.CharField(source="opened_by.username",  read_only=True)
    buyer_username       = serializers.SerializerMethodField()
    seller_username      = serializers.SerializerMethodField()
    reason_display       = serializers.CharField(source="get_reason_display",   read_only=True)
    status_display       = serializers.CharField(source="get_status_display",   read_only=True)
    verdict_display      = serializers.CharField(source="get_final_verdict_display", read_only=True)
    resolved_by_username = serializers.SerializerMethodField()
    evidence             = EvidenceFileSerializer(many=True, read_only=True)
    messages             = DisputeMessageSerializer(many=True, read_only=True)
    order_id             = serializers.UUIDField(source="order.id", read_only=True)
    listing_title        = serializers.CharField(source="order.listing.title",  read_only=True)
    order_amount         = serializers.DecimalField(
        source="order.amount", max_digits=12, decimal_places=2, read_only=True
    )

    class Meta:
        model  = Dispute
        fields = [
            "id", "order_id", "listing_title", "order_amount",
            "opened_by_username", "buyer_username", "seller_username",
            "reason", "reason_display", "description",
            "status", "status_display",
            "final_verdict", "verdict_display",
            "resolution_note", "resolved_by_username", "resolved_at",
            "evidence", "messages", "created_at", "updated_at",
        ]
        read_only_fields = fields

    def get_buyer_username(self, obj):
        return obj.order.buyer.username

    def get_seller_username(self, obj):
        return obj.order.listing.seller.username

    def get_resolved_by_username(self, obj):
        return obj.resolved_by.username if obj.resolved_by else None