"""
apps/platform_admin/serializers.py
"""
from decimal import Decimal
from django.contrib.auth import get_user_model
from rest_framework import serializers

from .models import PlatformSettings, WithdrawalRequest

User = get_user_model()


class PlatformSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model  = PlatformSettings
        fields = [
            "commission_percent",
            "min_withdrawal_amount",
            "maintenance_mode",
            "disable_new_signups",
            "disable_new_listings",
            "disable_payments",
            "support_email",
            "platform_name",
            "updated_at",
        ]
        read_only_fields = ["updated_at"]


class AdminUserSerializer(serializers.ModelSerializer):
    class Meta:
        model  = User
        fields = [
            "id", "email", "username", "full_name", "role",
            "is_active", "is_email_verified", "is_staff",
            "total_earned", "total_spent",
            "seller_rating", "completed_sales", "completed_purchases",
            "last_login_ip", "last_active_at", "date_joined",
        ]
        read_only_fields = fields


class WithdrawalRequestSerializer(serializers.ModelSerializer):
    seller_username = serializers.CharField(source="seller.username", read_only=True)
    seller_email    = serializers.EmailField(source="seller.email",    read_only=True)
    reviewed_by_username = serializers.CharField(
        source="reviewed_by.username", read_only=True, default=None
    )

    class Meta:
        model  = WithdrawalRequest
        fields = [
            "id", "seller_username", "seller_email",
            "amount", "status",
            "bank_name", "bank_code", "account_number", "account_name",
            "paystack_transfer_code", "paystack_transfer_ref",
            "rejection_reason",
            "reviewed_by_username", "reviewed_at",
            "created_at", "updated_at",
        ]
        read_only_fields = [
            "id", "status",
            "paystack_recipient_code", "paystack_transfer_code", "paystack_transfer_ref",
            "reviewed_by_username", "reviewed_at",
            "created_at", "updated_at",
        ]


class WithdrawalSubmitSerializer(serializers.Serializer):
    """Seller submitting a withdrawal request."""
    amount         = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=Decimal("1"))
    bank_name      = serializers.CharField(max_length=100)
    bank_code      = serializers.CharField(max_length=10, required=False, allow_blank=True)
    account_number = serializers.CharField(max_length=20)
    account_name   = serializers.CharField(max_length=200)


class WithdrawalReviewSerializer(serializers.Serializer):
    """Owner approving or rejecting a withdrawal."""
    decision         = serializers.ChoiceField(choices=["approve", "reject"])
    rejection_reason = serializers.CharField(max_length=1000, required=False, allow_blank=True)

    def validate(self, attrs):
        if attrs["decision"] == "reject" and not attrs.get("rejection_reason", "").strip():
            raise serializers.ValidationError(
                {"rejection_reason": "A reason is required when rejecting."}
            )
        return attrs


class RevenueStatSerializer(serializers.Serializer):
    total_revenue        = serializers.DecimalField(max_digits=14, decimal_places=2)
    total_commissions    = serializers.DecimalField(max_digits=14, decimal_places=2)
    escrow_held          = serializers.DecimalField(max_digits=14, decimal_places=2)
    pending_withdrawals  = serializers.DecimalField(max_digits=14, decimal_places=2)
    total_orders         = serializers.IntegerField()
    completed_orders     = serializers.IntegerField()
    disputed_orders      = serializers.IntegerField()
    total_users          = serializers.IntegerField()
    active_listings      = serializers.IntegerField()
    monthly_revenue      = serializers.ListField(child=serializers.DictField())