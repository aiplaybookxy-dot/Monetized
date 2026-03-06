from rest_framework import serializers
from .models import Order, EscrowVault, OrderStatus
from apps.accounts.serializers import UserPublicSerializer
from apps.listings.serializers import ListingSerializer


class OrderSerializer(serializers.ModelSerializer):
    buyer = UserPublicSerializer(read_only=True)
    seller = UserPublicSerializer(read_only=True)
    listing = ListingSerializer(read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    has_vault = serializers.SerializerMethodField()

    class Meta:
        model = Order
        fields = [
            "id", "buyer", "seller", "listing",
            "amount", "commission", "seller_payout",
            "status", "status_display", "has_vault",
            "paystack_reference",
            "funded_at", "provisioned_at", "completed_at",
            "disputed_at", "cancelled_at",
            "created_at", "updated_at",
        ]
        read_only_fields = fields

    def get_has_vault(self, obj):
        return hasattr(obj, "vault")


class VaultUploadSerializer(serializers.Serializer):
    """Used by the Seller to upload credentials after an order is FUNDED."""
    username = serializers.CharField(max_length=200)
    password = serializers.CharField(max_length=200)
    oge = serializers.CharField(
        max_length=200,
        label="Original Gmail / Recovery Email",
        help_text="The original email linked to the account."
    )
    transfer_notes = serializers.CharField(max_length=1000, required=False, allow_blank=True)

    def validate(self, attrs):
        order = self.context.get("order")
        if not order:
            raise serializers.ValidationError("Order context is required.")
        if order.status != OrderStatus.FUNDED:
            raise serializers.ValidationError(
                "Credentials can only be uploaded when the order is in FUNDED status."
            )
        return attrs


class VaultRetrieveSerializer(serializers.Serializer):
    """
    Read-only output of decrypted vault credentials.
    Only the buyer may receive this — enforced in the view AND model.
    """
    username = serializers.CharField(read_only=True)
    password = serializers.CharField(read_only=True)
    oge = serializers.CharField(read_only=True)
    transfer_notes = serializers.CharField(read_only=True)


class DisputeSerializer(serializers.Serializer):
    reason = serializers.CharField(
        max_length=2000,
        help_text="Describe why you are raising a dispute."
    )


class OrderCompleteSerializer(serializers.Serializer):
    """Buyer confirms the account credentials are valid → triggers fund release."""
    confirmed = serializers.BooleanField()

    def validate_confirmed(self, value):
        if not value:
            raise serializers.ValidationError("You must confirm to complete the order.")
        return value