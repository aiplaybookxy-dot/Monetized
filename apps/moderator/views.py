import logging
from django.contrib.auth import get_user_model
from django.core.mail import send_mail
from django.template.loader import render_to_string
from django.conf import settings
from django.db import transaction
from django.db.models import Q

from rest_framework import generics, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.orders.models import Order, OrderStatus, PlatformRevenue
from apps.listings.models import AccountListing, ListingStatus
from apps.notifications.models import Notification, NotificationType
from apps.activity.models import ActivityLog, ActionType
from apps.activity.views import IsModerator
from apps.accounts.signals import send_fund_release_email

from .serializers import (
    DisputeResolveSerializer,
    ListingApproveSerializer,
    UserAuditSerializer,
    DisputedOrderSerializer,
)

logger = logging.getLogger(__name__)
User = get_user_model()


# ── Dispute Management ────────────────────────────────────────────────────────

class DisputedOrderListView(generics.ListAPIView):
    """
    GET /api/v1/mod/disputes/
    All DISPUTED orders, oldest first (highest urgency at top).
    """
    serializer_class = DisputedOrderSerializer
    permission_classes = [IsModerator]

    def get_queryset(self):
        return (
            Order.objects
            .filter(status=OrderStatus.DISPUTED)
            .select_related("listing", "listing__seller", "buyer")
            .order_by("disputed_at")  # Oldest dispute first = highest urgency
        )


class DisputeResolveView(APIView):
    """
    POST /api/v1/mod/disputes/<order_id>/resolve/
    Moderator resolves a dispute by releasing to seller or refunding buyer.
    Full activity log + notifications on both sides.
    """
    permission_classes = [IsModerator]

    @transaction.atomic
    def post(self, request, order_id):
        try:
            order = Order.objects.select_for_update().get(
                pk=order_id, status=OrderStatus.DISPUTED
            )
        except Order.DoesNotExist:
            return Response({"error": "Disputed order not found."}, status=404)

        serializer = DisputeResolveSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        decision = serializer.validated_data["decision"]
        note = serializer.validated_data["resolution_note"]

        # Record moderator note
        order.admin_notes = (
            f"[RESOLVED by {request.user.username}] {note}"
        )

        if decision == "release":
            order.transition_to(OrderStatus.COMPLETED, actor=request.user)

            # Record platform revenue
            PlatformRevenue.objects.get_or_create(
                order=order,
                defaults={
                    "commission_amount": order.commission,
                    "platform": order.listing.platform,
                }
            )

            # Update seller stats
            seller = order.listing.seller
            seller.total_earned += order.seller_payout
            seller.completed_sales += 1
            seller.save(update_fields=["total_earned", "completed_sales"])

            # Notify both parties
            Notification.objects.bulk_create([
                Notification(
                    recipient=order.buyer,
                    notification_type=NotificationType.DISPUTE_RESOLVED,
                    title="Dispute Resolved",
                    message=f"After review, funds were released to the seller. Note: {note}",
                    action_url=f"/orders/{order.id}",
                    metadata={"order_id": str(order.id), "decision": "release"},
                ),
                Notification(
                    recipient=seller,
                    notification_type=NotificationType.DISPUTE_RESOLVED,
                    title="Dispute Resolved — Funds Released",
                    message=f"The moderator ruled in your favour. {note}",
                    action_url=f"/seller/orders/{order.id}",
                    metadata={"order_id": str(order.id), "decision": "release"},
                ),
            ])
            send_fund_release_email(order)

        else:  # refund
            order.transition_to(OrderStatus.REFUNDED, actor=request.user)

            # Re-activate listing
            order.listing.status = ListingStatus.ACTIVE
            order.listing.save(update_fields=["status"])

            Notification.objects.bulk_create([
                Notification(
                    recipient=order.buyer,
                    notification_type=NotificationType.DISPUTE_RESOLVED,
                    title="Dispute Resolved — Refund Approved",
                    message=f"The moderator ruled in your favour. Refund processing. Note: {note}",
                    action_url=f"/orders/{order.id}",
                    metadata={"order_id": str(order.id), "decision": "refund"},
                ),
                Notification(
                    recipient=order.listing.seller,
                    notification_type=NotificationType.DISPUTE_RESOLVED,
                    title="Dispute Resolved — Buyer Refunded",
                    message=f"After review, the buyer was refunded. Note: {note}",
                    action_url=f"/seller/orders/{order.id}",
                    metadata={"order_id": str(order.id), "decision": "refund"},
                ),
            ])

        # Immutable audit log entry
        ActivityLog.log_from_request(
            request,
            action=ActionType.DISPUTE_RESOLVED,
            description=f"Moderator {request.user.username} resolved dispute on order {order_id} → {decision}",
            object_type="Order",
            object_id=str(order_id),
            metadata={"decision": decision, "note": note},
        )

        logger.info(f"Dispute on order {order_id} resolved ({decision}) by {request.user.username}")
        return Response({"detail": f"Dispute resolved: {decision}.", "order_id": str(order.id)})


# ── Listing Approval ──────────────────────────────────────────────────────────

class PendingListingsView(generics.ListAPIView):
    """GET /api/v1/mod/listings/pending/ — All listings awaiting moderator approval."""
    from apps.listings.serializers import ListingSerializer
    serializer_class = ListingSerializer
    permission_classes = [IsModerator]

    def get_queryset(self):
        return (
            AccountListing.objects
            .filter(status=ListingStatus.PENDING_REVIEW)
            .select_related("seller")
            .order_by("created_at")
        )


class ListingApproveView(APIView):
    """
    POST /api/v1/mod/listings/<listing_id>/review/
    Moderator approves or rejects a PENDING_REVIEW listing.
    """
    permission_classes = [IsModerator]

    @transaction.atomic
    def post(self, request, listing_id):
        try:
            listing = AccountListing.objects.get(
                pk=listing_id, status=ListingStatus.PENDING_REVIEW
            )
        except AccountListing.DoesNotExist:
            return Response({"error": "Pending listing not found."}, status=404)

        serializer = ListingApproveSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        decision = serializer.validated_data["decision"]

        if decision == "approve":
            listing.status = ListingStatus.ACTIVE
            listing.save(update_fields=["status"])
            action = ActionType.LISTING_APPROVED
            notif_title = "Listing Approved!"
            notif_msg = f"Your listing '{listing.title}' is now live on the marketplace."
        else:
            listing.status = ListingStatus.DRAFT
            listing.save(update_fields=["status"])
            action = ActionType.LISTING_REJECTED
            reason = serializer.validated_data.get("rejection_reason", "")
            notif_title = "Listing Needs Changes"
            notif_msg = f"Your listing '{listing.title}' was not approved. Reason: {reason}"

        Notification.objects.create(
            recipient=listing.seller,
            notification_type=NotificationType.LISTING_APPROVED if decision == "approve" else NotificationType.SYSTEM,
            title=notif_title,
            message=notif_msg,
            action_url="/sell/listings",
            metadata={"listing_id": str(listing_id), "decision": decision},
        )

        ActivityLog.log_from_request(
            request,
            action=action,
            description=f"{request.user.username} {decision}d listing {listing.title}",
            object_type="Listing",
            object_id=str(listing_id),
        )

        return Response({"detail": f"Listing {decision}d.", "listing_id": str(listing_id)})


# ── User Audits ───────────────────────────────────────────────────────────────

class UserAuditListView(generics.ListAPIView):
    """GET /api/v1/mod/users/ — Searchable user list for moderator audits."""
    serializer_class = UserAuditSerializer
    permission_classes = [IsModerator]

    def get_queryset(self):
        qs = User.objects.prefetch_related("activity_logs", "purchases").order_by("-date_joined")
        search = self.request.query_params.get("search", "").strip()
        if search:
            qs = qs.filter(
                Q(username__icontains=search)
                | Q(email__icontains=search)
                | Q(full_name__icontains=search)
            )
        return qs


class UserAuditDetailView(generics.RetrieveAPIView):
    """GET /api/v1/mod/users/<user_id>/ — Full audit profile of a single user."""
    serializer_class = UserAuditSerializer
    permission_classes = [IsModerator]
    queryset = User.objects.all()
    lookup_field = "id"

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()

        # Log that this moderator audited this user
        ActivityLog.log_from_request(
            request,
            action=ActionType.USER_AUDITED,
            description=f"Moderator {request.user.username} audited user {instance.username}",
            object_type="User",
            object_id=str(instance.id),
        )

        serializer = self.get_serializer(instance)
        return Response(serializer.data)


# ── Moderator stats dashboard summary ────────────────────────────────────────

class ModeratorStatsView(APIView):
    """GET /api/v1/mod/stats/ — High-level counters for the moderator dashboard."""
    permission_classes = [IsModerator]

    def get(self, request):
        from apps.activity.models import ActivityLog
        from django.utils import timezone
        from datetime import timedelta

        now = timezone.now()
        last_24h = now - timedelta(hours=24)

        return Response({
            "open_disputes":       Order.objects.filter(status=OrderStatus.DISPUTED).count(),
            "pending_listings":    AccountListing.objects.filter(status=ListingStatus.PENDING_REVIEW).count(),
            "total_users":         User.objects.filter(is_active=True).count(),
            "vault_views_24h":     ActivityLog.objects.filter(action=ActionType.VAULT_VIEWED, timestamp__gte=last_24h).count(),
            "log_entries_24h":     ActivityLog.objects.filter(timestamp__gte=last_24h).count(),
            "disputes_resolved_7d": ActivityLog.objects.filter(
                action=ActionType.DISPUTE_RESOLVED,
                timestamp__gte=now - timedelta(days=7)
            ).count(),
        })


# ── Email helper — called from orders/views.py when dispute is raised ─────────

def notify_moderators_of_dispute(order):
    """
    Send email to all active Moderators + Admins when a dispute is opened.
    Called explicitly from OrderDisputeView after transition.
    """
    from apps.accounts.models import UserRole
    moderator_emails = list(
        User.objects.filter(
            role__in=[UserRole.MODERATOR, UserRole.ADMIN],
            is_active=True,
        ).values_list("email", flat=True)
    )
    if not moderator_emails:
        logger.warning("Dispute opened but no moderators found to notify.")
        return

    send_mail(
        subject=f"[ACTION REQUIRED] New Dispute — Order {str(order.id)[:8].upper()}",
        message=render_to_string("emails/dispute_opened.txt", {
            "order": order,
            "buyer": order.buyer,
            "seller": order.listing.seller,
            "listing": order.listing,
        }),
        html_message=render_to_string("emails/dispute_opened.html", {
            "order": order,
            "buyer": order.buyer,
            "seller": order.listing.seller,
            "listing": order.listing,
        }),
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=moderator_emails,
        fail_silently=True,
    )
    logger.info(f"Dispute notification sent to {len(moderator_emails)} moderator(s) for order {order.id}")