"""
apps/platform_admin/models.py
"""
import uuid
from django.db import models
from django.conf import settings
from django.core.exceptions import ValidationError


class PlatformSettings(models.Model):
    """Singleton — always access via PlatformSettings.get()."""
    commission_percent    = models.DecimalField(max_digits=5, decimal_places=2, default=10.00)
    min_withdrawal_amount = models.DecimalField(max_digits=12, decimal_places=2, default=5000.00)
    maintenance_mode      = models.BooleanField(default=False)
    disable_new_signups   = models.BooleanField(default=False)
    disable_new_listings  = models.BooleanField(default=False)
    disable_payments      = models.BooleanField(default=False)
    support_email         = models.EmailField(default="support@escrowmarket.com")
    platform_name         = models.CharField(max_length=100, default="EscrowMarket")
    updated_at            = models.DateTimeField(auto_now=True)
    updated_by            = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="settings_updates",
    )

    class Meta:
        db_table     = "platform_settings"
        verbose_name = "Platform Settings"

    def clean(self):
        if not self.pk and PlatformSettings.objects.exists():
            raise ValidationError("Only one PlatformSettings instance is allowed.")

    @classmethod
    def get(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj

    def __str__(self):
        return f"Platform Settings (commission={self.commission_percent}%)"


class WithdrawalStatus(models.TextChoices):
    PENDING    = "PENDING",    "Pending Review"
    PROCESSING = "PROCESSING", "Transfer Initiated"
    APPROVED   = "APPROVED",   "Approved & Paid"
    REJECTED   = "REJECTED",   "Rejected"
    FAILED     = "FAILED",     "Transfer Failed"


class WithdrawalRequest(models.Model):
    """
    Seller payout request with Paystack Transfer API auto-pay.

    Flow:
      PENDING → owner approves → Paystack Transfer API called → PROCESSING
      Paystack webhook: transfer.success → APPROVED (balance deducted)
                        transfer.failed  → FAILED   (balance restored)
      OR: owner rejects → REJECTED (no money moved)

    bank_code: CBN 3-digit code required by Paystack (e.g. "058" for GTBank).
               Frontend must provide a bank picker that maps name → code.
    """
    id     = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    seller = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT,
        related_name="withdrawal_requests",
    )
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    status = models.CharField(
        max_length=20, choices=WithdrawalStatus.choices,
        default=WithdrawalStatus.PENDING, db_index=True,
    )

    # Bank details
    bank_name      = models.CharField(max_length=100)
    bank_code      = models.CharField(max_length=10, blank=True)
    account_number = models.CharField(max_length=20)
    account_name   = models.CharField(max_length=200)

    # Paystack tracking (populated on approval)
    paystack_recipient_code = models.CharField(max_length=100, blank=True)
    paystack_transfer_code  = models.CharField(max_length=100, blank=True)
    paystack_transfer_ref   = models.CharField(max_length=100, blank=True)

    # Review
    rejection_reason = models.TextField(blank=True)
    reviewed_by      = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="reviewed_withdrawals",
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    created_at  = models.DateTimeField(auto_now_add=True)
    updated_at  = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "withdrawal_requests"
        ordering = ["-created_at"]
        indexes  = [models.Index(fields=["seller", "status"])]

    def __str__(self):
        return f"Withdrawal ₦{self.amount:,.2f} by {self.seller.username} [{self.status}]"