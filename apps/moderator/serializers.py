from django.contrib.auth import get_user_model
from rest_framework import serializers
from apps.orders.models import Order, OrderStatus
from apps.listings.models import AccountListing, ListingStatus
from apps.accounts.serializers import UserPublicSerializer
from apps.orders.serializers import OrderSerializer
from apps.listings.serializers import ListingSerializer

User = get_user_model()


class DisputeResolveSerializer(serializers.Serializer):
    """
    Admin/Moderator resolves a DISPUTED order.
    decision: 'release' → funds go to seller (COMPLETED)
    decision: 'refund'  → funds go back to buyer (REFUNDED)
    """
    decision = serializers.ChoiceField(choices=["release", "refund"])
    resolution_note = serializers.CharField(
        max_length=2000,
        help_text="Moderator's public-facing note explaining the resolution."
    )


class ListingApproveSerializer(serializers.Serializer):
    """Moderator approves or rejects a listing in PENDING_REVIEW state."""
    decision = serializers.ChoiceField(choices=["approve", "reject"])
    rejection_reason = serializers.CharField(
        max_length=1000,
        required=False,
        allow_blank=True,
        help_text="Required if decision is 'reject'."
    )

    def validate(self, attrs):
        if attrs["decision"] == "reject" and not attrs.get("rejection_reason", "").strip():
            raise serializers.ValidationError(
                {"rejection_reason": "A rejection reason is required when rejecting a listing."}
            )
        return attrs


class UserAuditSerializer(serializers.ModelSerializer):
    """Extended user profile for moderator audit — includes sensitive fields."""
    role_display = serializers.CharField(source="get_role_display", read_only=True)
    activity_count = serializers.SerializerMethodField()
    open_orders = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id", "email", "username", "full_name", "role", "role_display",
            "seller_rating", "completed_sales", "completed_purchases",
            "total_earned", "total_spent", "last_login_ip", "last_active_at",
            "is_email_verified", "is_active", "date_joined",
            "activity_count", "open_orders",
        ]
        read_only_fields = fields

    def get_activity_count(self, obj):
        return obj.activity_logs.count()

    def get_open_orders(self, obj):
        terminal = ["completed", "cancelled", "refunded"]
        buying = obj.purchases.exclude(status__in=terminal).count()
        selling = Order.objects.filter(
            listing__seller=obj
        ).exclude(status__in=terminal).count()
        return {"buying": buying, "selling": selling}


class DisputedOrderSerializer(OrderSerializer):
    """Extended order serializer that includes dispute metadata for moderators."""
    dispute_age_hours = serializers.SerializerMethodField()

    class Meta(OrderSerializer.Meta):
        fields = OrderSerializer.Meta.fields + ["admin_notes", "dispute_age_hours"]

    def get_dispute_age_hours(self, obj):
        if not obj.disputed_at:
            return None
        from django.utils import timezone
        delta = timezone.now() - obj.disputed_at
        return round(delta.total_seconds() / 3600, 1)