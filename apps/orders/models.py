"""
apps/orders/models.py

ADDITIONS vs original:
  - funds_release_at  — datetime when seller_payout is credited (post-completion hold)
  - seller_credited   — False until Celery task credits the seller balance
  - timedelta import added at top
"""
import uuid
from datetime import timedelta

from django.db import models
from django.conf import settings
from django.utils import timezone
from cryptography.fernet import Fernet


def get_cipher():
    key = getattr(settings, "VAULT_ENCRYPTION_KEY", None) or getattr(settings, "FERNET_KEY", "")
    return Fernet(key.encode() if isinstance(key, str) else key)


class OrderStatus(models.TextChoices):
    PENDING      = "pending",      "Pending Payment"
    FUNDED       = "funded",       "Funded (Payment Received)"
    IN_PROVISION = "in_provision", "In Provision (Credentials Uploaded)"
    DISPUTED     = "disputed",     "Disputed"
    COMPLETED    = "completed",    "Completed"
    CANCELLED    = "cancelled",    "Cancelled"
    REFUNDED     = "refunded",     "Refunded"


class Order(models.Model):
    """
    The core escrow state machine.
    Funds are held in platform escrow until order reaches COMPLETED or REFUNDED.

    State transitions:
    PENDING → FUNDED (Paystack payment confirmed)
    FUNDED → IN_PROVISION (Seller uploads credentials to EscrowVault)
    IN_PROVISION → COMPLETED (Buyer confirms, funds released to seller)
    IN_PROVISION → DISPUTED (Buyer raises dispute)
    DISPUTED → COMPLETED (Admin resolves: release to seller)
    DISPUTED → REFUNDED (Admin resolves: refund to buyer)
    FUNDED/IN_PROVISION → CANCELLED (Buyer cancels before completion)
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    buyer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="purchases",
    )
    listing = models.ForeignKey(
        "listings.AccountListing",
        on_delete=models.PROTECT,
        related_name="orders",
    )

    # Snapshot prices at order time (listing price can change later)
    amount        = models.DecimalField(max_digits=12, decimal_places=2)
    commission    = models.DecimalField(max_digits=12, decimal_places=2)
    seller_payout = models.DecimalField(max_digits=12, decimal_places=2)

    # Escrow state machine
    status = models.CharField(
        max_length=20,
        choices=OrderStatus.choices,
        default=OrderStatus.PENDING,
        db_index=True,
    )

    # Paystack references
    paystack_reference       = models.CharField(max_length=200, unique=True, blank=True, null=True)
    paystack_transaction_id  = models.CharField(max_length=200, blank=True, null=True)
    paystack_transfer_reference = models.CharField(max_length=200, blank=True, null=True)

    # Admin override notes (for dispute resolution)
    admin_notes = models.TextField(blank=True)
    resolved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="resolved_orders",
    )

    # ── Post-completion escrow hold ───────────────────────────────────────────
    # When buyer confirms (COMPLETED), funds_release_at = now + ESCROW_HOLD_DAYS.
    # Celery task (apps/orders/tasks.py) credits seller after this timestamp.
    # During the hold, admin can still seize funds via dispute.
    funds_release_at = models.DateTimeField(
        null=True, blank=True,
        help_text=(
            "When seller funds are released to their balance. "
            "Set to now + ESCROW_HOLD_DAYS when buyer confirms. "
            "Celery task credits seller after this time."
        ),
    )
    seller_credited = models.BooleanField(
        default=False,
        db_index=True,
        help_text=(
            "False until the post-completion holding period expires and "
            "the Celery task credits seller_payout to total_earned."
        ),
    )

    # Timestamps for each state (audit trail)
    funded_at      = models.DateTimeField(null=True, blank=True)
    provisioned_at = models.DateTimeField(null=True, blank=True)
    completed_at   = models.DateTimeField(null=True, blank=True)
    disputed_at    = models.DateTimeField(null=True, blank=True)
    cancelled_at   = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "orders"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["status", "created_at"]),
            models.Index(fields=["buyer", "status"]),
            models.Index(fields=["paystack_reference"]),
        ]

    def __str__(self):
        return f"Order {self.id} | {self.status} | ₦{self.amount}"

    @property
    def seller(self):
        return self.listing.seller

    def transition_to(self, new_status: str, actor=None):
        """
        Validated state machine transition.
        Raises ValueError on illegal moves.
        """
        valid_transitions = {
            OrderStatus.PENDING:      [OrderStatus.FUNDED,       OrderStatus.CANCELLED],
            OrderStatus.FUNDED:       [OrderStatus.IN_PROVISION, OrderStatus.CANCELLED],
            OrderStatus.IN_PROVISION: [OrderStatus.COMPLETED,    OrderStatus.DISPUTED],
            OrderStatus.DISPUTED:     [OrderStatus.COMPLETED,    OrderStatus.REFUNDED],
            OrderStatus.COMPLETED:    [],
            OrderStatus.CANCELLED:    [],
            OrderStatus.REFUNDED:     [],
        }

        allowed = valid_transitions.get(self.status, [])
        if new_status not in allowed:
            raise ValueError(
                f"Invalid transition: {self.status} → {new_status}. "
                f"Allowed: {[s.value for s in allowed]}"
            )

        self.status = new_status

        timestamp_map = {
            OrderStatus.FUNDED:       "funded_at",
            OrderStatus.IN_PROVISION: "provisioned_at",
            OrderStatus.COMPLETED:    "completed_at",
            OrderStatus.DISPUTED:     "disputed_at",
            OrderStatus.CANCELLED:    "cancelled_at",
        }
        if field := timestamp_map.get(new_status):
            setattr(self, field, timezone.now())

        # Set the escrow hold release time on COMPLETED
        if new_status == OrderStatus.COMPLETED:
            hold_days = getattr(settings, "ESCROW_HOLD_DAYS", 3)
            self.funds_release_at = timezone.now() + timedelta(days=hold_days)
            self.seller_credited  = False

        if actor and new_status in [OrderStatus.COMPLETED, OrderStatus.REFUNDED]:
            self.resolved_by = actor

        self.save(update_fields=[
            "status", "admin_notes", "resolved_by",
            "funded_at", "provisioned_at", "completed_at",
            "disputed_at", "cancelled_at",
            "funds_release_at", "seller_credited",
            "updated_at",
        ])
        return self


class EscrowVault(models.Model):
    """
    Encrypted credential storage for a social media account.

    SECURITY CONTRACT:
    - Credentials are encrypted at rest using Fernet (AES-128-CBC + HMAC-SHA256).
    - Decryption is ONLY permitted when order.status == FUNDED or higher.
    - Raw credentials are NEVER logged or stored unencrypted.
    - The vault is created by the Seller after order is FUNDED.
    """
    id    = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    order = models.OneToOneField(Order, on_delete=models.CASCADE, related_name="vault")

    # Encrypted fields — stored as bytes, base64-encoded in DB
    _username = models.BinaryField(db_column="username_encrypted")
    _password = models.BinaryField(db_column="password_encrypted")
    _oge      = models.BinaryField(db_column="oge_encrypted")

    # Additional notes from seller (not encrypted — non-sensitive)
    transfer_notes = models.TextField(blank=True, help_text="Any transfer instructions")

    uploaded_at = models.DateTimeField(auto_now_add=True)
    updated_at  = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "escrow_vaults"

    def _encrypt(self, value: str) -> bytes:
        return get_cipher().encrypt(value.encode("utf-8"))

    def _decrypt(self, value: bytes) -> str:
        return get_cipher().decrypt(bytes(value)).decode("utf-8")

    def set_credentials(self, username: str, password: str, oge: str):
        """Encrypt and store credentials."""
        self._username = self._encrypt(username)
        self._password = self._encrypt(password)
        self._oge      = self._encrypt(oge)
        self.save()

    def get_credentials(self, requesting_user) -> dict:
        """
        Decrypt and return credentials — enforces access control.
        Only the buyer can access, and only when order is FUNDED+.
        """
        order = self.order
        allowed_statuses = [
            OrderStatus.FUNDED,
            OrderStatus.IN_PROVISION,
            OrderStatus.COMPLETED,
        ]
        if requesting_user != order.buyer and not requesting_user.is_staff:
            raise PermissionError("Only the buyer can access vault credentials.")
        if order.status not in allowed_statuses:
            raise PermissionError("Credentials are locked until the order is funded.")
        return {
            "username": self._decrypt(self._username),
            "password": self._decrypt(self._password),
            "oge":      self._decrypt(self._oge),
        }

    def __str__(self):
        return f"Vault for Order {self.order_id}"


class PlatformRevenue(models.Model):
    """
    Ledger entry created on every completed order.
    Gives admin a clear revenue audit trail.
    """
    id    = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    order = models.OneToOneField(Order, on_delete=models.PROTECT, related_name="revenue_entry")
    commission_amount = models.DecimalField(max_digits=12, decimal_places=2)
    platform    = models.CharField(max_length=20)
    recorded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "platform_revenue"

    def __str__(self):
        return f"Revenue ₦{self.commission_amount} from Order {self.order_id}"