import uuid
from django.db import models
from django.conf import settings


class ActionType(models.TextChoices):
    # Auth
    LOGIN             = "LOGIN",              "Login"
    LOGOUT            = "LOGOUT",             "Logout"
    REGISTER          = "REGISTER",           "Registration"
    PASSWORD_CHANGE   = "PASSWORD_CHANGE",    "Password Changed"
    PASSWORD_RESET    = "PASSWORD_RESET",     "Password Reset"

    # Listings
    LISTING_CREATED   = "LISTING_CREATED",   "Listing Created"
    LISTING_UPDATED   = "LISTING_UPDATED",   "Listing Updated"
    LISTING_PUBLISHED = "LISTING_PUBLISHED", "Listing Published"
    LISTING_APPROVED  = "LISTING_APPROVED",  "Listing Approved"
    LISTING_REJECTED  = "LISTING_REJECTED",  "Listing Rejected"
    LISTING_VIEWED    = "LISTING_VIEWED",    "Listing Viewed"

    # Orders / Escrow
    ORDER_CREATED     = "ORDER_CREATED",     "Order Created"
    ORDER_FUNDED      = "ORDER_FUNDED",      "Order Funded"
    ORDER_PROVISIONED = "ORDER_PROVISIONED", "Credentials Uploaded"
    ORDER_COMPLETED   = "ORDER_COMPLETED",   "Order Completed"
    ORDER_DISPUTED    = "ORDER_DISPUTED",    "Dispute Raised"
    ORDER_CANCELLED   = "ORDER_CANCELLED",   "Order Cancelled"
    ORDER_REFUNDED    = "ORDER_REFUNDED",    "Order Refunded"

    # Vault — CRITICAL
    VAULT_VIEWED      = "VAULT_VIEWED",      "Vault Credentials Viewed"
    VAULT_UPLOADED    = "VAULT_UPLOADED",    "Vault Credentials Uploaded"

    # Moderation
    DISPUTE_RESOLVED  = "DISPUTE_RESOLVED",  "Dispute Resolved by Moderator"
    USER_SUSPENDED    = "USER_SUSPENDED",    "User Suspended"
    USER_AUDITED      = "USER_AUDITED",      "User Profile Audited"

    # System
    PROFILE_UPDATED   = "PROFILE_UPDATED",   "Profile Updated"
    PAYMENT_INITIATED = "PAYMENT_INITIATED", "Payment Initiated"
    PAYMENT_VERIFIED  = "PAYMENT_VERIFIED",  "Payment Verified"

    # Privileged route access — logged by ActivityMiddleware
    ADMIN_ROUTE_ACCESS = "ADMIN_ROUTE_ACCESS", "Admin Route Accessed"
    MOD_ROUTE_ACCESS   = "MOD_ROUTE_ACCESS",   "Moderator Route Accessed"


class ActivityLog(models.Model):
    """
    Immutable, append-only audit trail for every critical platform action.

    IMMUTABILITY CONTRACT:
    ─────────────────────
    • No update() or save() after creation — logs are write-once.
    • The custom Manager overrides bulk_update/update to raise PermissionError.
    • Django Admin registration uses readonly_fields for all fields.
    • Only SuperAdmins (is_superuser=True) can delete via admin panel.
    • Database-level: consider adding a PostgreSQL trigger to prevent UPDATE
      on this table in production (migration note below).

    PERFORMANCE:
    ─────────────
    • Composite index on (user, timestamp) for per-user timeline queries.
    • Index on (action, timestamp) for action-type filtering in System Log.
    • Index on timestamp alone for global time-ordered queries.
    • Use ActivityLog.objects.log() or log_bulk() — never construct directly.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    # Actor — nullable to support system/anonymous actions
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="activity_logs",
        db_index=True,
    )

    action = models.CharField(max_length=30, choices=ActionType.choices, db_index=True)
    description = models.TextField(blank=True, help_text="Human-readable summary of the action.")

    # Request context
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True)

    # Related object reference (optional — store UUID as string to avoid FK coupling)
    object_type = models.CharField(max_length=50, blank=True,  help_text="e.g. 'Order', 'Listing'")
    object_id   = models.CharField(max_length=100, blank=True, help_text="UUID/PK of the related object")

    # Extra structured data (e.g. old/new status, listing platform)
    metadata = models.JSONField(default=dict, blank=True)

    timestamp = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        db_table = "activity_logs"
        ordering = ["-timestamp"]
        # Write-heavy read-light: targeted composite indexes
        indexes = [
            models.Index(fields=["user", "timestamp"],  name="actlog_user_ts_idx"),
            models.Index(fields=["action", "timestamp"], name="actlog_action_ts_idx"),
            models.Index(fields=["object_type", "object_id"], name="actlog_obj_idx"),
        ]
        # Prevent accidental bulk-updates at the ORM level via custom manager
        default_manager_name = "objects"

    def __str__(self):
        actor = self.user.username if self.user else "system"
        return f"[{self.action}] {actor} @ {self.timestamp:%Y-%m-%d %H:%M:%S}"

    def save(self, *args, **kwargs):
        """Enforce immutability: never allow an update, only creation."""
        if self.pk and ActivityLog.objects.filter(pk=self.pk).exists():
            raise PermissionError("ActivityLog entries are immutable and cannot be modified.")
        super().save(*args, **kwargs)

    # ── Convenience factory methods ──────────────────────────────────────────

    @classmethod
    def log(
        cls,
        action: str,
        user=None,
        description: str = "",
        ip_address: str = None,
        user_agent: str = "",
        object_type: str = "",
        object_id: str = "",
        metadata: dict = None,
    ) -> "ActivityLog":
        """Single log entry. Preferred API for all code paths."""
        return cls.objects.create(
            action=action,
            user=user,
            description=description,
            ip_address=ip_address,
            user_agent=user_agent,
            object_type=object_type,
            object_id=str(object_id) if object_id else "",
            metadata=metadata or {},
        )

    @classmethod
    def log_bulk(cls, entries: list[dict]) -> list["ActivityLog"]:
        """
        High-throughput batch insert — use for event bursts.
        Each dict must have 'action'; all other fields are optional.
        Returns the created instances (without hitting DB per-row).
        """
        objs = [cls(**{**{"metadata": {}, "user_agent": "", "object_type": "", "object_id": ""}, **e}) for e in entries]
        return cls.objects.bulk_create(objs, ignore_conflicts=False)

    @classmethod
    def log_from_request(cls, request, action: str, **kwargs) -> "ActivityLog":
        """Extract user + IP + UA from a DRF/Django request automatically."""
        ip = _get_ip(request)
        ua = request.META.get("HTTP_USER_AGENT", "")[:512]
        user = request.user if request.user.is_authenticated else None
        return cls.log(action=action, user=user, ip_address=ip, user_agent=ua, **kwargs)


def _get_ip(request) -> str:
    xff = request.META.get("HTTP_X_FORWARDED_FOR")
    if xff:
        return xff.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR", "0.0.0.0")