"""
Dispute Resolution API — The Judiciary Layer.

Security architecture:
1. Only the buyer of an order can open a dispute (enforced in post())
2. Only the buyer, seller, or moderator can post messages or upload evidence
3. Vault access within the dispute context bypasses the normal INSPECTION
   gate — moderators need credentials to verify if they work
4. Every verdict is immutably logged to ActivityLog with actor, action, and metadata
5. All financial state changes are wrapped in transaction.atomic() +
   select_for_update() to prevent race conditions

State machine impact:
- Opening a dispute → Order transitions to DISPUTED → funds frozen
- Moderator resolves RELEASED → Order → COMPLETED → seller credited
- Moderator resolves REFUNDED → Order → CANCELLED → listing re-activated
"""
import logging
from django.db import transaction
from django.utils import timezone
from django.core.mail import send_mail
from django.template.loader import render_to_string
from django.conf import settings

from rest_framework import generics, status
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.orders.models import Order, OrderStatus, PlatformRevenue
from apps.listings.models import ListingStatus
from apps.notifications.models import Notification, NotificationType
from apps.activity.models import ActivityLog, ActionType
from apps.activity.views import IsModerator

from .models import Dispute, DisputeMessage, EvidenceFile, DisputeStatus, DisputeVerdict
from .serializers import (
    DisputeSerializer,
    DisputeCreateSerializer,
    DisputeResolveSerializer,
    DisputeMessageSerializer,
    EvidenceFileSerializer,
)

logger = logging.getLogger(__name__)


def _is_dispute_participant(user, dispute) -> bool:
    """
    Returns True if user is the buyer, seller, or a moderator/admin.
    Used to gate message posting and evidence upload.
    """
    if user.role in ("moderator", "admin"):
        return True
    return user == dispute.buyer or user == dispute.seller


class DisputeCreateView(APIView):
    """
    POST /api/v1/disputes/
    ─────────────────────
    Buyer opens a dispute against a funded/provisioned/inspection order.

    WHY atomic: The dispute creation AND the order status transition must
    succeed together or both fail. A dispute with no frozen order is
    dangerous — funds could still be released. A frozen order with no
    dispute is confusing for all parties.

    WHY select_for_update on Order:
    Between the check (is_disputable) and the transition, another request
    could change the order status. The row lock prevents this race.
    """
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request):
        order_id = request.data.get("order_id")
        if not order_id:
            return Response({"error": "order_id is required."}, status=400)

        # Lock the order row for the duration of this transaction
        try:
            order = Order.objects.select_for_update().get(
                pk=order_id,
                buyer=request.user,
            )
        except Order.DoesNotExist:
            return Response({"error": "Order not found or you are not the buyer."}, status=404)

        # Guard: can this order be disputed?
        if not order.is_disputable:
            return Response(
                {"error": f"Orders in '{order.status}' status cannot be disputed."},
                status=400,
            )

        # Guard: duplicate dispute
        if hasattr(order, "dispute"):
            return Response(
                {"error": "A dispute already exists for this order."},
                status=400,
            )

        serializer = DisputeCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        # ── Create Dispute ────────────────────────────────────────────────────
        dispute = Dispute.objects.create(
            order=order,
            opened_by=request.user,
            reason=serializer.validated_data["reason"],
            description=serializer.validated_data["description"],
            status=DisputeStatus.PENDING,
        )

        # ── Freeze order funds ────────────────────────────────────────────────
        order.transition_to(OrderStatus.DISPUTED)

        # ── Notify all parties ────────────────────────────────────────────────
        seller = order.listing.seller
        Notification.objects.bulk_create([
            Notification(
                recipient=seller,
                notification_type=NotificationType.DISPUTE_OPENED,
                title="Dispute Opened Against Your Order",
                message=f"Buyer '{request.user.username}' has opened a dispute for '{order.listing.title}'. Funds are frozen pending review.",
                action_url=f"/orders/{order.id}",
                metadata={"dispute_id": str(dispute.id), "order_id": str(order.id)},
            ),
        ])

        # ── Notify moderators ─────────────────────────────────────────────────
        _notify_moderators_dispute_opened(dispute, order)

        # ── Immutable audit log ───────────────────────────────────────────────
        ActivityLog.log_from_request(
            request,
            action=ActionType.ORDER_DISPUTED,
            description=f"Buyer {request.user.username} opened dispute on order {str(order.id)[:8].upper()} — reason: {dispute.reason}",
            object_type="Dispute",
            object_id=str(dispute.id),
            metadata={
                "order_id":   str(order.id),
                "reason":     dispute.reason,
                "order_status_before": order.status,
            },
        )

        logger.info("Dispute %s opened on order %s by %s", dispute.id, order.id, request.user.username)
        return Response(DisputeSerializer(dispute).data, status=201)


class DisputeDetailView(generics.RetrieveAPIView):
    """
    GET /api/v1/disputes/<dispute_id>/
    Dispute detail — visible to buyer, seller, and moderators only.
    """
    serializer_class   = DisputeSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        dispute = Dispute.objects.select_related(
            "order", "order__listing", "order__buyer",
            "order__listing__seller", "opened_by", "resolved_by",
        ).prefetch_related("evidence", "messages", "messages__sender").get(
            pk=self.kwargs["dispute_id"]
        )
        user = self.request.user
        if not _is_dispute_participant(user, dispute):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("You are not a participant in this dispute.")
        return dispute


class MyDisputesView(generics.ListAPIView):
    """
    GET /api/v1/disputes/mine/
    Disputes the current user is involved in (as buyer or seller).
    """
    serializer_class   = DisputeSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        from django.db.models import Q
        return Dispute.objects.filter(
            Q(order__buyer=user) | Q(order__listing__seller=user)
        ).select_related(
            "order", "order__listing", "order__buyer"
        ).order_by("-created_at")


class DisputeMessageCreateView(APIView):
    """
    POST /api/v1/disputes/<dispute_id>/messages/
    ──────────────────────────────────────────────
    Post a message to the dispute chat. All three parties can post.
    Messages are immutable — no edit or delete endpoint exists by design.

    Moderator messages are flagged with is_mod_note=True for
    special UI treatment (styled differently in the Courtroom).
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, dispute_id):
        try:
            dispute = Dispute.objects.get(pk=dispute_id)
        except Dispute.DoesNotExist:
            return Response({"error": "Dispute not found."}, status=404)

        if not _is_dispute_participant(request.user, dispute):
            return Response({"error": "You are not a participant in this dispute."}, status=403)

        if not dispute.is_active:
            return Response({"error": "Cannot post to a resolved dispute."}, status=400)

        body = request.data.get("body", "").strip()
        if not body:
            return Response({"error": "Message body cannot be empty."}, status=400)
        if len(body) > 3000:
            return Response({"error": "Message exceeds 3000 character limit."}, status=400)

        is_mod = request.user.role in ("moderator", "admin")
        message = DisputeMessage.objects.create(
            dispute=dispute,
            sender=request.user,
            body=body,
            is_mod_note=is_mod,
        )

        # Mark dispute as under review when moderator first posts
        if is_mod and dispute.status == DisputeStatus.PENDING:
            dispute.status = DisputeStatus.UNDER_REVIEW
            dispute.save(update_fields=["status"])

        # Notify the other parties
        recipients = []
        if request.user != dispute.buyer:
            recipients.append(dispute.buyer)
        if request.user != dispute.seller:
            recipients.append(dispute.seller)

        Notification.objects.bulk_create([
            Notification(
                recipient=r,
                notification_type=NotificationType.DISPUTE_MESSAGE,
                title=f"New message in Dispute — {dispute.order.listing.title}",
                message=f"{'[Moderator]' if is_mod else request.user.username}: {body[:80]}...",
                action_url=f"/disputes/{dispute.id}",
                metadata={"dispute_id": str(dispute.id), "message_id": str(message.id)},
            )
            for r in recipients
        ])

        return Response(DisputeMessageSerializer(message).data, status=201)


class EvidenceUploadView(APIView):
    """
    POST /api/v1/disputes/<dispute_id>/evidence/
    ─────────────────────────────────────────────
    Upload evidence files (images, documents) to a dispute.

    WHY MultiPartParser: evidence includes file uploads — JSON cannot carry binary.
    WHY no delete endpoint: Evidence is immutable once submitted. Moderators
    review all evidence; allowing deletion would enable bad actors to suppress
    incriminating proof after submitting it.
    """
    permission_classes = [IsAuthenticated]
    parser_classes     = [MultiPartParser, FormParser]

    def post(self, request, dispute_id):
        try:
            dispute = Dispute.objects.get(pk=dispute_id)
        except Dispute.DoesNotExist:
            return Response({"error": "Dispute not found."}, status=404)

        if not _is_dispute_participant(request.user, dispute):
            return Response({"error": "You are not a participant in this dispute."}, status=403)

        if not dispute.is_active:
            return Response({"error": "Cannot add evidence to a resolved dispute."}, status=400)

        file    = request.FILES.get("file")
        caption = request.data.get("caption", "")

        if not file:
            return Response({"error": "No file provided."}, status=400)

        # Validate file size — max 10MB
        if file.size > 10 * 1024 * 1024:
            return Response({"error": "File exceeds 10MB limit."}, status=400)

        # Validate file type — images and PDFs only
        allowed_types = ["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"]
        if file.content_type not in allowed_types:
            return Response(
                {"error": "Only JPG, PNG, WebP, GIF, and PDF files are accepted."},
                status=400,
            )

        # Cap evidence count per participant
        participant_evidence_count = EvidenceFile.objects.filter(
            dispute=dispute, uploaded_by=request.user
        ).count()
        if participant_evidence_count >= 10:
            return Response(
                {"error": "Maximum 10 evidence files per participant."},
                status=400,
            )

        evidence = EvidenceFile.objects.create(
            dispute=dispute,
            uploaded_by=request.user,
            file=file,
            caption=caption,
        )

        return Response(EvidenceFileSerializer(evidence).data, status=201)


class DisputeResolveView(APIView):
    """
    POST /api/v1/disputes/<dispute_id>/resolve/
    ─────────────────────────────────────────────
    Moderator delivers the final verdict.

    Two outcomes:
    RELEASED → Order COMPLETED → seller credited → listing marked SOLD
    REFUNDED → Order CANCELLED → buyer credited → listing re-activated

    WHY select_for_update:
    The moderator resolution and the Paystack webhook could theoretically
    race if a retry arrives at exactly the wrong moment. The row lock
    prevents any concurrent status mutation during the resolution.

    WHY immutable ActivityLog:
    Every verdict is a permanent legal record. The moderator's identity,
    the decision, and the timestamp must be unalterable for accountability.
    """
    permission_classes = [IsModerator]

    @transaction.atomic
    def post(self, request, dispute_id):
        try:
            dispute = Dispute.objects.select_for_update().select_related(
                "order", "order__listing", "order__listing__seller", "order__buyer"
            ).get(pk=dispute_id, status__in=[DisputeStatus.PENDING, DisputeStatus.UNDER_REVIEW])
        except Dispute.DoesNotExist:
            return Response({"error": "Active dispute not found."}, status=404)

        serializer = DisputeResolveSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        verdict         = serializer.validated_data["verdict"]
        resolution_note = serializer.validated_data["resolution_note"]

        order  = dispute.order
        seller = order.listing.seller
        buyer  = order.buyer

        # ── Update Dispute record ─────────────────────────────────────────────
        dispute.final_verdict   = verdict
        dispute.resolution_note = resolution_note
        dispute.resolved_by     = request.user
        dispute.resolved_at     = timezone.now()
        dispute.status          = DisputeStatus.RESOLVED
        dispute.save()

        # ── Execute financial outcome ─────────────────────────────────────────
        if verdict == DisputeVerdict.RELEASED:
            # Money goes to seller
            order.admin_notes = f"[RELEASED by {request.user.username}] {resolution_note}"
            order.transition_to(OrderStatus.COMPLETED)

            # Record platform revenue
            PlatformRevenue.objects.get_or_create(
                order=order,
                defaults={
                    "commission_amount": order.commission,
                    "platform": order.listing.platform,
                },
            )

            # Credit seller
            seller.total_earned   += order.seller_payout
            seller.completed_sales += 1
            seller.save(update_fields=["total_earned", "completed_sales"])

            buyer_msg  = f"After reviewing the evidence, funds were released to the seller. Note: {resolution_note}"
            seller_msg = f"The moderator ruled in your favour. Funds released. Note: {resolution_note}"

        else:
            # Money goes back to buyer
            order.admin_notes = f"[REFUNDED by {request.user.username}] {resolution_note}"
            order.transition_to(OrderStatus.CANCELLED)

            # Re-activate listing for re-sale
            order.listing.status = ListingStatus.ACTIVE
            order.listing.save(update_fields=["status"])

            buyer_msg  = f"The moderator ruled in your favour. A refund has been approved. Note: {resolution_note}"
            seller_msg = f"After reviewing the evidence, the buyer was refunded. Note: {resolution_note}"

        # ── Notifications ─────────────────────────────────────────────────────
        Notification.objects.bulk_create([
            Notification(
                recipient=buyer,
                notification_type=NotificationType.DISPUTE_RESOLVED,
                title=f"Dispute Resolved — {'Refund Approved' if verdict == DisputeVerdict.REFUNDED else 'Funds Released to Seller'}",
                message=buyer_msg,
                action_url=f"/orders/{order.id}",
                metadata={"dispute_id": str(dispute.id), "verdict": verdict},
            ),
            Notification(
                recipient=seller,
                notification_type=NotificationType.DISPUTE_RESOLVED,
                title=f"Dispute Resolved — {'Buyer Refunded' if verdict == DisputeVerdict.REFUNDED else 'Funds Released to You'}",
                message=seller_msg,
                action_url=f"/orders/{order.id}",
                metadata={"dispute_id": str(dispute.id), "verdict": verdict},
            ),
        ])

        # ── Immutable audit log — THE MOST CRITICAL LOG ENTRY ────────────────
        ActivityLog.log_from_request(
            request,
            action=ActionType.DISPUTE_RESOLVED,
            description=(
                f"Moderator {request.user.username} resolved Dispute {str(dispute.id)[:8].upper()} "
                f"on Order {str(order.id)[:8].upper()} → verdict: {verdict} "
                f"({buyer.username} vs {seller.username})"
            ),
            object_type="Dispute",
            object_id=str(dispute.id),
            metadata={
                "verdict":         verdict,
                "resolution_note": resolution_note,
                "order_id":        str(order.id),
                "buyer_id":        str(buyer.id),
                "seller_id":       str(seller.id),
                "moderator_id":    str(request.user.id),
            },
        )

        # ── Send resolution emails ────────────────────────────────────────────
        _send_resolution_emails(dispute, verdict, resolution_note, buyer, seller)

        logger.info(
            "Dispute %s resolved by %s → %s",
            dispute.id, request.user.username, verdict,
        )
        return Response(DisputeSerializer(dispute).data)


# ── Moderator view: all active disputes ──────────────────────────────────────

class ActiveDisputeListView(generics.ListAPIView):
    """
    GET /api/v1/mod/disputes/
    All disputes pending review — the Courtroom queue.
    Oldest first for priority ordering (FIFO justice).
    """
    serializer_class   = DisputeSerializer
    permission_classes = [IsModerator]

    def get_queryset(self):
        return Dispute.objects.filter(
            status__in=[DisputeStatus.PENDING, DisputeStatus.UNDER_REVIEW]
        ).select_related(
            "order", "order__listing", "order__listing__seller",
            "order__buyer", "opened_by",
        ).prefetch_related("evidence", "messages").order_by("created_at")


class DisputeVaultView(APIView):
    """
    GET /api/v1/disputes/<dispute_id>/vault/
    ──────────────────────────────────────────
    Moderator accesses the encrypted vault for a DISPUTED order.

    WHY this endpoint exists separately from orders/vault/:
    The standard vault endpoint only allows the buyer to access credentials.
    During a dispute, moderators need to verify whether the credentials work
    to determine if the seller acted in good faith.

    Security gates (all must pass):
    1. Caller must be moderator or admin
    2. Dispute must be active (not resolved)
    3. Order must be in DISPUTED status
    4. Every access is logged immutably

    WHY even disputed vault access is logged:
    A corrupt moderator could access vault credentials and sell them outside
    the platform. The audit trail makes this traceable and accountable.
    """
    permission_classes = [IsModerator]

    def get(self, request, dispute_id):
        try:
            dispute = Dispute.objects.select_related(
                "order", "order__vault"
            ).get(pk=dispute_id)
        except Dispute.DoesNotExist:
            return Response({"error": "Dispute not found."}, status=404)

        if dispute.order.status != OrderStatus.DISPUTED:
            return Response(
                {"error": "Vault access via dispute is only available on DISPUTED orders."},
                status=403,
            )

        try:
            credentials = dispute.order.vault.decrypt()
        except EscrowVault.DoesNotExist:
            return Response({"error": "No credentials uploaded yet."}, status=404)
        except Exception as e:
            logger.error("Vault decrypt failed for dispute %s: %s", dispute_id, e)
            return Response({"error": "Vault decryption failed."}, status=500)

        # Immutable audit log — every moderator vault view is recorded
        ActivityLog.log_from_request(
            request,
            action=ActionType.VAULT_VIEWED,
            description=f"Moderator {request.user.username} viewed vault for DISPUTED order {str(dispute.order_id)[:8].upper()} via Dispute {str(dispute_id)[:8].upper()}",
            object_type="Dispute",
            object_id=str(dispute_id),
            metadata={
                "order_id":    str(dispute.order_id),
                "dispute_id":  str(dispute_id),
                "moderator_id": str(request.user.id),
            },
        )

        return Response(credentials)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _notify_moderators_dispute_opened(dispute, order):
    from django.contrib.auth import get_user_model
    User = get_user_model()
    mod_emails = list(
        User.objects.filter(
            role__in=["moderator", "admin"],
            is_active=True,
        ).values_list("email", flat=True)
    )
    if not mod_emails:
        return

    # In-app notifications for all moderators
    from django.contrib.auth import get_user_model
    mods = User.objects.filter(role__in=["moderator", "admin"], is_active=True)
    Notification.objects.bulk_create([
        Notification(
            recipient=mod,
            notification_type=NotificationType.DISPUTE_OPENED,
            title=f"[ACTION REQUIRED] New Dispute — {order.listing.title}",
            message=f"Buyer '{dispute.opened_by.username}' has opened a dispute. Funds frozen.",
            action_url=f"/moderator/disputes/{dispute.id}",
            metadata={"dispute_id": str(dispute.id), "order_id": str(order.id)},
        )
        for mod in mods
    ])

    try:
        send_mail(
            subject=f"[ACTION REQUIRED] Dispute Opened — Order {str(order.id)[:8].upper()}",
            message=render_to_string("emails/dispute_opened.txt", {
                "order": order, "dispute": dispute,
                "buyer": order.buyer, "seller": order.listing.seller,
            }),
            html_message=render_to_string("emails/dispute_opened.html", {
                "order": order, "dispute": dispute,
                "buyer": order.buyer, "seller": order.listing.seller,
            }),
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=mod_emails,
            fail_silently=True,
        )
    except Exception as e:
        logger.warning("Failed to email moderators for dispute %s: %s", dispute.id, e)


def _send_resolution_emails(dispute, verdict, note, buyer, seller):
    try:
        send_mail(
            subject=f"Dispute Resolved — {'Refund Approved' if verdict == DisputeVerdict.REFUNDED else 'Transaction Completed'}",
            message=f"Hi {buyer.username},\n\nYour dispute has been resolved.\n\nVerdict: {verdict}\nNote: {note}\n\n— EscrowMarket",
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[buyer.email, seller.email],
            fail_silently=True,
        )
    except Exception as e:
        logger.warning("Failed to send resolution emails: %s", e)


# Fix circular import
from apps.orders.models import EscrowVault  # noqa