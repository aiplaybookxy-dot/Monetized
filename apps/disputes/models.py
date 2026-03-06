"""
Dispute Resolution System — The "Judiciary" Layer.

Architecture decisions:
1. Dispute is separate from Order — Order holds money, Dispute holds the case.
   Coupling them would mean deleting a dispute deletes financial records.
2. EvidenceFile is a separate model (not JSON) so files can be served,
   validated, and deleted independently without mutating the dispute record.
3. DisputeMessage creates an immutable chat log — messages cannot be edited
   or deleted once submitted (critical for moderation integrity).
4. When a Dispute is created, Order.status transitions to DISPUTED
   atomically in DisputeCreateView — funds are frozen at the DB level.
"""
import uuid
from django.db import models
from django.conf import settings


class DisputeReason(models.TextChoices):
    CREDENTIALS_INVALID  = "CREDENTIALS_INVALID",  "Credentials Don't Work"
    ACCOUNT_NOT_AS_DESC  = "ACCOUNT_NOT_AS_DESC",  "Account Not As Described"
    SELLER_UNRESPONSIVE  = "SELLER_UNRESPONSIVE",  "Seller Unresponsive"
    WRONG_ACCOUNT        = "WRONG_ACCOUNT",        "Wrong Account Delivered"
    ACCOUNT_RECOVERED    = "ACCOUNT_RECOVERED",    "Account Recovered by Original Owner"
    OTHER                = "OTHER",                "Other"


class DisputeStatus(models.TextChoices):
    PENDING      = "PENDING",      "Pending Review"
    UNDER_REVIEW = "UNDER_REVIEW", "Under Moderator Review"
    RESOLVED     = "RESOLVED",     "Resolved"


class DisputeVerdict(models.TextChoices):
    REFUNDED = "REFUNDED", "Buyer Refunded"
    RELEASED = "RELEASED", "Funds Released to Seller"


class Dispute(models.Model):
    """
    A formal dispute against an escrow order.

    WHY one dispute per order (OneToOneField):
    An order represents one transaction. Multiple simultaneous disputes
    on the same order would create conflicting resolution states.
    If a re-dispute is needed after resolution, a new order must be created.

    Security: opened_by is recorded and immutable after creation —
    a buyer cannot pretend a dispute was opened by the seller.
    """
    id        = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    order     = models.OneToOneField(
        "orders.Order",
        on_delete=models.PROTECT,
        related_name="dispute",
    )
    opened_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="disputes_opened",
    )
    reason       = models.CharField(max_length=30, choices=DisputeReason.choices)
    description  = models.TextField(help_text="Detailed explanation from the opener.")
    status       = models.CharField(
        max_length=20,
        choices=DisputeStatus.choices,
        default=DisputeStatus.PENDING,
        db_index=True,
    )
    # Set when moderator resolves
    final_verdict     = models.CharField(
        max_length=10,
        choices=DisputeVerdict.choices,
        blank=True,
    )
    resolution_note   = models.TextField(blank=True)
    resolved_by       = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="disputes_resolved",
    )
    resolved_at  = models.DateTimeField(null=True, blank=True)
    created_at   = models.DateTimeField(auto_now_add=True)
    updated_at   = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "disputes"
        ordering = ["-created_at"]
        indexes  = [
            models.Index(fields=["status", "created_at"]),
        ]

    def __str__(self):
        return f"Dispute on Order {str(self.order_id)[:8].upper()} [{self.status}]"

    @property
    def buyer(self):
        return self.order.buyer

    @property
    def seller(self):
        return self.order.listing.seller

    @property
    def is_active(self):
        return self.status != DisputeStatus.RESOLVED


class EvidenceFile(models.Model):
    """
    Evidence submitted by either party during a dispute.

    WHY separate model vs JSON array:
    - Files need to be served via URL — you can't do that with JSON
    - Files can be validated (type, size) at the model level
    - Individual files can be reviewed/rejected without touching the dispute
    - Queryable: "show all evidence from buyer X" is a simple filter

    WHY no delete permission for submitter:
    Once submitted, evidence must be immutable. The moderator is the
    arbiter — allowing parties to delete evidence they submitted would
    allow bad actors to cover their tracks mid-dispute.
    """
    id          = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    dispute     = models.ForeignKey(Dispute, on_delete=models.CASCADE, related_name="evidence")
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="dispute_evidence",
    )
    file        = models.FileField(upload_to="dispute_evidence/%Y/%m/")
    caption     = models.CharField(max_length=200, blank=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "dispute_evidence"
        ordering = ["uploaded_at"]

    def __str__(self):
        return f"Evidence by {self.uploaded_by.username} on {self.dispute}"


class DisputeMessage(models.Model):
    """
    Immutable chat message within a dispute case.

    WHY immutable (no edit/delete):
    This is the official communication record for the dispute.
    Moderators rely on the full, unedited message thread to make
    their verdict. Editable messages would destroy evidentiary integrity.

    Participants: buyer, seller, moderator (enforced in view).
    All three can post — the moderator posts their preliminary findings
    and final verdict explanation here before resolving formally.
    """
    id         = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    dispute    = models.ForeignKey(Dispute, on_delete=models.CASCADE, related_name="messages")
    sender     = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="dispute_messages",
    )
    body       = models.TextField()
    is_mod_note = models.BooleanField(
        default=False,
        help_text="True when posted by a Moderator — shown with special styling."
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table  = "dispute_messages"
        ordering  = ["created_at"]

    def __str__(self):
        return f"[{'MOD' if self.is_mod_note else self.sender.username}] {self.body[:60]}"

    def save(self, *args, **kwargs):
        """Enforce immutability — messages are write-once."""
        if self.pk and DisputeMessage.objects.filter(pk=self.pk).exists():
            raise PermissionError("Dispute messages are immutable and cannot be edited.")
        super().save(*args, **kwargs)