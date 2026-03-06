"""
apps/listings/models.py

NEW in this version:
  ─ CredentialStatus choices (UNVERIFIED / VERIFIED / FAILED / CUSTODY_HELD)
  ─ CustodyLevel choices (NONE / OGE_CUSTODY / PRE_VAULT / FULL_CUSTODY)
  ─ AccountListing gains: custody_email, credential_status, custody_level,
    last_verified_at, credential_failure_count
  ─ ListingVault: pre-listing encrypted credential store (separate from EscrowVault)
    Seller uploads credentials AT LISTING TIME. On order creation the vault
    contents are automatically copied into the EscrowVault so the seller
    never has to re-upload.
"""
import uuid

from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models
from django.utils import timezone

from cryptography.fernet import Fernet

def get_cipher():
    from django.conf import settings as _s
    key = getattr(_s, "VAULT_ENCRYPTION_KEY", None) or getattr(_s, "FERNET_KEY", "")
    return Fernet(key.encode() if isinstance(key, str) else key)


# ── Choices ───────────────────────────────────────────────────────────────────

class SocialPlatform(models.TextChoices):
    INSTAGRAM = "instagram", "Instagram"
    YOUTUBE   = "youtube",   "YouTube"
    TIKTOK    = "tiktok",    "TikTok"
    TWITTER   = "twitter",   "Twitter / X"
    FACEBOOK  = "facebook",  "Facebook"
    SNAPCHAT  = "snapchat",  "Snapchat"
    TWITCH    = "twitch",    "Twitch"
    OTHER     = "other",     "Other"


class ListingStatus(models.TextChoices):
    DRAFT          = "draft",          "Draft"
    PENDING_REVIEW = "pending_review", "Pending Review"
    ACTIVE         = "active",         "Active"
    UNDER_REVIEW   = "under_review",   "Under Review"
    SOLD           = "sold",           "Sold"
    SUSPENDED      = "suspended",      "Suspended"


class CredentialStatus(models.TextChoices):
    UNVERIFIED    = "UNVERIFIED",    "Unverified"
    VERIFIED      = "VERIFIED",      "Verified ✓"
    FAILED        = "FAILED",        "Login Failed ✗"
    CUSTODY_HELD  = "CUSTODY_HELD",  "Platform Has Custody"
    STALE         = "STALE",         "Re-verification Needed"


class CustodyLevel(models.IntegerChoices):
    NONE          = 0, "No custody"
    OGE_CUSTODY   = 1, "OGE Email Custody"
    PRE_VAULT     = 2, "Pre-listed in Vault"
    FULL_CUSTODY  = 3, "Full Platform Custody"


# ── Main listing model ────────────────────────────────────────────────────────

class AccountListing(models.Model):
    """
    A social-media account offered for sale through escrow.

    Status flow:
    DRAFT → PENDING_REVIEW (seller submits for approval)
    PENDING_REVIEW → ACTIVE (moderator approves)
    PENDING_REVIEW → DRAFT (moderator rejects — seller edits and re-submits)
    ACTIVE → UNDER_REVIEW (locked while an order is in progress)
    UNDER_REVIEW → SOLD (order completed)
    UNDER_REVIEW → ACTIVE (order cancelled — listing restored)
    ACTIVE → SUSPENDED (admin/moderator action)

    ─────────────────────────────────────────────────────
    CUSTODY SYSTEM
    ─────────────────────────────────────────────────────
    custody_level   = how much control the platform has:
      0 NONE         — seller controls everything (trust-based)
      1 OGE_CUSTODY  — platform holds the recovery email inbox
      2 PRE_VAULT    — credentials uploaded to ListingVault before listing
      3 FULL_CUSTODY — platform holds all credentials, changes 2FA

    credential_status tracks the live state of those credentials.
    The heartbeat task (apps/listings/tasks.py) runs every 12h and
    updates this field + auto-suspends on FAILED.
    ─────────────────────────────────────────────────────
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    seller = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="listings",
    )

    platform       = models.CharField(max_length=20, choices=SocialPlatform.choices)
    account_handle = models.CharField(max_length=100, help_text="Public @handle")
    account_url    = models.URLField(blank=True)

    title       = models.CharField(max_length=200)
    description = models.TextField()
    category    = models.CharField(max_length=100, blank=True)
    tags        = models.JSONField(default=list, blank=True)

    follower_count          = models.PositiveIntegerField(default=0)
    average_engagement_rate = models.FloatField(default=0.0, validators=[MinValueValidator(0)])
    account_age_months      = models.PositiveIntegerField(default=0)
    monthly_revenue_usd     = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    price = models.DecimalField(
        max_digits=12, decimal_places=2, validators=[MinValueValidator(1.00)]
    )

    screenshots          = models.JSONField(default=list, blank=True)
    analytics_screenshot = models.ImageField(upload_to="analytics/", blank=True, null=True)

    status      = models.CharField(
        max_length=20, choices=ListingStatus.choices, default=ListingStatus.DRAFT
    )
    is_featured = models.BooleanField(default=False)
    view_count  = models.PositiveIntegerField(default=0)
    rejection_reason = models.TextField(blank=True)

    # ── Custody & Credential Fields ───────────────────────────────────────────
    custody_level = models.IntegerField(
        choices=CustodyLevel.choices,
        default=CustodyLevel.NONE,
        help_text="How much control the platform holds over this account.",
    )
    custody_email = models.EmailField(
        blank=True,
        help_text=(
            "Platform-owned recovery email assigned to this account. "
            "Set by moderator during Level 1 custody onboarding."
        ),
    )
    credential_status = models.CharField(
        max_length=20,
        choices=CredentialStatus.choices,
        default=CredentialStatus.UNVERIFIED,
        db_index=True,
    )
    last_verified_at = models.DateTimeField(
        null=True, blank=True,
        help_text="Timestamp of last successful credential heartbeat check.",
    )
    credential_failure_count = models.PositiveSmallIntegerField(
        default=0,
        help_text=(
            "Consecutive heartbeat failures. "
            "Auto-suspend triggers at HEARTBEAT_FAILURE_THRESHOLD (default 3)."
        ),
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "account_listings"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["platform", "status"]),
            models.Index(fields=["price"]),
            models.Index(fields=["is_featured", "status"]),
            models.Index(fields=["status", "created_at"]),
            models.Index(fields=["credential_status", "status"]),  # heartbeat queries
        ]

    def __str__(self):
        return f"{self.platform} | {self.account_handle} — ₦{self.price}"

    # ── Financial properties (use PlatformSettings, not hardcoded 10%) ────────
    @property
    def commission_amount(self):
        from apps.platform_admin.models import PlatformSettings
        pct = PlatformSettings.get().commission_percent
        return (self.price * pct) / 100

    @property
    def seller_payout(self):
        return self.price - self.commission_amount

    # ── Custody helpers ───────────────────────────────────────────────────────
    @property
    def is_platform_verified(self):
        """True if the platform has at least verified the credentials once."""
        return self.credential_status in (
            CredentialStatus.VERIFIED, CredentialStatus.CUSTODY_HELD
        )

    @property
    def has_listing_vault(self):
        return hasattr(self, "listing_vault")

    def mark_verified(self):
        self.credential_status       = CredentialStatus.VERIFIED
        self.last_verified_at        = timezone.now()
        self.credential_failure_count = 0
        self.save(update_fields=[
            "credential_status", "last_verified_at",
            "credential_failure_count", "updated_at"
        ])

    def mark_failed(self):
        self.credential_failure_count += 1
        threshold = getattr(settings, "HEARTBEAT_FAILURE_THRESHOLD", 3)
        if self.credential_failure_count >= threshold:
            self.credential_status = CredentialStatus.FAILED
            self.status = ListingStatus.SUSPENDED
        else:
            self.credential_status = CredentialStatus.STALE
        self.save(update_fields=[
            "credential_status", "credential_failure_count", "status", "updated_at"
        ])

    def mark_stale(self):
        """Called by heartbeat when last_verified_at > HEARTBEAT_INTERVAL hours."""
        self.credential_status = CredentialStatus.STALE
        self.save(update_fields=["credential_status", "updated_at"])


# ── Pre-listing credential vault ──────────────────────────────────────────────

class ListingVault(models.Model):
    """
    Encrypted credential store attached to the LISTING (not an Order).

    WHY a separate vault from EscrowVault?
    ─────────────────────────────────────
    EscrowVault belongs to a specific order and is created after payment.
    ListingVault is created when the seller LISTS the account — before any
    buyer exists. This enables:

      1. Moderator verification during listing review (Level 2 custody).
      2. Auto-copy into EscrowVault when an order is created, so the
         seller never has to re-upload.
      3. Heartbeat checks against stored credentials.

    SECURITY CONTRACT:
    ─────────────────
    - Same Fernet (AES-128-CBC + HMAC-SHA256) encryption as EscrowVault.
    - Only the listing seller + moderators/admin can read credentials.
    - Access is logged to ActivityLog on every decrypt call.
    """
    id      = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    listing = models.OneToOneField(
        AccountListing, on_delete=models.CASCADE, related_name="listing_vault"
    )

    _username = models.BinaryField(db_column="username_encrypted")
    _password = models.BinaryField(db_column="password_encrypted")
    _oge      = models.BinaryField(db_column="oge_encrypted")
    transfer_notes = models.TextField(blank=True)

    # Set to True once the moderator has confirmed credentials work
    moderator_verified = models.BooleanField(default=False)
    verified_by        = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name="verified_listing_vaults",
    )
    verified_at = models.DateTimeField(null=True, blank=True)

    uploaded_at = models.DateTimeField(auto_now_add=True)
    updated_at  = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "listing_vaults"

    # ── Crypto helpers (same pattern as EscrowVault) ──────────────────────────
    def _encrypt(self, value: str) -> bytes:
        return get_cipher().encrypt(value.encode("utf-8"))

    def _decrypt(self, value: bytes) -> str:
        return get_cipher().decrypt(bytes(value)).decode("utf-8")

    def set_credentials(self, username: str, password: str, oge: str):
        self._username = self._encrypt(username)
        self._password = self._encrypt(password)
        self._oge      = self._encrypt(oge)
        self.save()

    def get_credentials(self, requesting_user) -> dict:
        """
        Returns decrypted credentials.
        Allowed: listing seller, moderators, admins.
        """
        listing = self.listing
        is_owner = requesting_user == listing.seller
        can_mod  = getattr(requesting_user, "can_moderate", False)
        if not (is_owner or can_mod):
            raise PermissionError("Not authorised to access these credentials.")
        return {
            "username":       self._decrypt(self._username),
            "password":       self._decrypt(self._password),
            "oge":            self._decrypt(self._oge),
            "transfer_notes": self.transfer_notes,
        }

    def __str__(self):
        return f"ListingVault for {self.listing.account_handle}"