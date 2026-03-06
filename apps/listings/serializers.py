"""
apps/listings/serializers.py
"""
from rest_framework import serializers
from .models import AccountListing, ListingVault
from apps.accounts.serializers import UserPublicSerializer


class ListingSerializer(serializers.ModelSerializer):
    """Full listing — used for READ operations (list, detail, order context)."""
    seller            = UserPublicSerializer(read_only=True)
    commission_amount = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    seller_payout     = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    platform_display  = serializers.CharField(source="get_platform_display", read_only=True)
    status_display    = serializers.CharField(source="get_status_display", read_only=True)
    is_platform_verified = serializers.BooleanField(read_only=True)
    has_listing_vault    = serializers.BooleanField(read_only=True)
    credential_status_display = serializers.CharField(
        source="get_credential_status_display", read_only=True
    )

    class Meta:
        model  = AccountListing
        fields = [
            "id", "seller", "platform", "platform_display",
            "account_handle", "account_url", "title", "description",
            "category", "tags", "follower_count", "average_engagement_rate",
            "account_age_months", "monthly_revenue_usd", "price",
            "commission_amount", "seller_payout",
            "screenshots", "analytics_screenshot", "status", "status_display",
            "is_featured", "view_count",
            # Custody fields (safe to show publicly — no credentials)
            "custody_level", "custody_email", "credential_status",
            "credential_status_display", "is_platform_verified",
            "has_listing_vault", "last_verified_at",
            "created_at", "updated_at",
        ]
        read_only_fields = [
            "id", "seller", "status", "is_featured", "view_count",
            "commission_amount", "seller_payout", "is_platform_verified",
            "has_listing_vault", "credential_status_display",
            "created_at", "updated_at",
        ]


class ListingCreateSerializer(serializers.ModelSerializer):
    """
    Used ONLY for POST /api/v1/listings/create/.
    Separate from ListingSerializer to cleanly separate read vs write
    validation logic and avoid exposing write fields in read responses.
    """
    class Meta:
        model  = AccountListing
        fields = [
            "platform", "account_handle", "account_url", "title",
            "description", "category", "tags", "follower_count",
            "average_engagement_rate", "account_age_months",
            "monthly_revenue_usd", "price",
            "screenshots", "analytics_screenshot",
        ]

    def create(self, validated_data):
        # seller and status are set by the view, not the serializer
        validated_data["seller"] = self.context["request"].user
        return super().create(validated_data)


class ListingUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model  = AccountListing
        fields = [
            "title", "description", "category", "tags",
            "price", "screenshots", "analytics_screenshot", "account_url",
        ]


# ── Vault serializers ─────────────────────────────────────────────────────────

class ListingVaultUploadSerializer(serializers.Serializer):
    """Seller submits credentials at listing time."""
    username       = serializers.CharField(max_length=200)
    password       = serializers.CharField(max_length=200)
    oge            = serializers.CharField(
        max_length=200,
        label="Original Gmail / Recovery Email",
        help_text="The recovery email linked to the account.",
    )
    transfer_notes = serializers.CharField(
        max_length=1000, required=False, allow_blank=True
    )


class ListingVaultRetrieveSerializer(serializers.Serializer):
    """Read-only decrypted credentials — returned from GET /listings/<pk>/vault/"""
    username       = serializers.CharField(read_only=True)
    password       = serializers.CharField(read_only=True)
    oge            = serializers.CharField(read_only=True)
    transfer_notes = serializers.CharField(read_only=True)