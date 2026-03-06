"""
apps/notifications/models.py

In-app notification system. Every significant platform event
triggers a Notification for the affected user(s).

Design decisions:
- read/unread state tracked per notification
- action_url allows frontend to deep-link to the relevant page
- metadata JSON carries event-specific context without schema changes
- bulk_create used for multi-party notifications (buyer + seller)
  to avoid N+1 DB writes
"""
import uuid
from django.db import models
from django.conf import settings


class NotificationType(models.TextChoices):
    # Order lifecycle
    PAYMENT_CONFIRMED    = "PAYMENT_CONFIRMED",    "Payment Confirmed"
    SALE_MADE            = "SALE_MADE",            "Sale Made"
    CREDENTIALS_UPLOADED = "CREDENTIALS_UPLOADED", "Credentials Uploaded"
    ORDER_COMPLETED      = "ORDER_COMPLETED",      "Order Completed"
    ORDER_DISPUTED       = "ORDER_DISPUTED",       "Order Disputed"
    ORDER_CANCELLED      = "ORDER_CANCELLED",      "Order Cancelled"
    WITHDRAWAL_APPROVED  = "WITHDRAWAL_APPROVED",  "Withdrawal Approved"

    # Dispute lifecycle
    DISPUTE_OPENED       = "DISPUTE_OPENED",       "Dispute Opened"
    DISPUTE_MESSAGE      = "DISPUTE_MESSAGE",      "New Dispute Message"
    DISPUTE_RESOLVED     = "DISPUTE_RESOLVED",     "Dispute Resolved"

    # Listing lifecycle
    LISTING_APPROVED     = "LISTING_APPROVED",     "Listing Approved"
    LISTING_REJECTED     = "LISTING_REJECTED",     "Listing Rejected"

    # Account
    LOGIN_ALERT          = "LOGIN_ALERT",          "New Login Alert"
    SYSTEM               = "SYSTEM",               "System Notification"


class Notification(models.Model):
    id        = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="notifications",
        db_index=True,
    )
    notification_type = models.CharField(
        max_length=30,
        choices=NotificationType.choices,
        db_index=True,
    )
    title      = models.CharField(max_length=200)
    message    = models.TextField()
    action_url = models.CharField(max_length=200, blank=True)
    metadata   = models.JSONField(default=dict, blank=True)
    is_read    = models.BooleanField(default=False, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "notifications"
        ordering = ["-created_at"]
        indexes  = [
            models.Index(fields=["recipient", "is_read", "created_at"]),
        ]

    def __str__(self):
        return f"[{self.notification_type}] → {self.recipient.username}"

    def mark_read(self):
        if not self.is_read:
            self.is_read = True
            self.save(update_fields=["is_read"])