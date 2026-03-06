"""
apps/orders/views.py

Merges the original view names (required by urls.py) with the v3
security hardening (select_for_update, atomic transactions, F() expressions).

WHY view names match the original exactly:
  urls.py imports BuyerOrderListView, SellerOrderListView, OrderDisputeView,
  OrderCancelView by name. Renaming them in views.py breaks the import
  without changing urls.py. Both files must agree on names.
"""
import logging
from django.db import transaction
from django.db.models import F
from django.utils import timezone
from django.conf import settings

from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Order, EscrowVault, OrderStatus, PlatformRevenue
from .serializers import (
    OrderSerializer,
    VaultUploadSerializer,
    VaultRetrieveSerializer,
    OrderCompleteSerializer,
)
from apps.notifications.models import Notification, NotificationType
from apps.listings.models import ListingStatus
from apps.accounts.signals import send_fund_release_email
from apps.activity.models import ActivityLog, ActionType

logger = logging.getLogger(__name__)


# ── Buyer: list all purchases ─────────────────────────────────────────────────

class BuyerOrderListView(generics.ListAPIView):
    """GET /api/v1/orders/"""
    serializer_class   = OrderSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return (
            Order.objects
            .filter(buyer=self.request.user)
            .select_related("listing", "listing__seller", "buyer")
            .order_by("-created_at")
        )


# ── Seller: list orders on their listings ────────────────────────────────────

class SellerOrderListView(generics.ListAPIView):
    """GET /api/v1/orders/selling/"""
    serializer_class   = OrderSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return (
            Order.objects
            .filter(listing__seller=self.request.user)
            .select_related("listing", "listing__seller", "buyer")
            .order_by("-created_at")
        )


# ── Order detail ─────────────────────────────────────────────────────────────

class OrderDetailView(generics.RetrieveAPIView):
    """GET /api/v1/orders/<id>/"""
    serializer_class   = OrderSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        user = self.request.user
        pk   = self.kwargs["pk"]
        try:
            order = Order.objects.select_related(
                "listing", "listing__seller", "buyer"
            ).get(pk=pk)
        except Order.DoesNotExist:
            from rest_framework.exceptions import NotFound
            raise NotFound("Order not found.")

        if order.buyer != user and order.listing.seller != user and not user.is_staff:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("You do not have access to this order.")
        return order


# ── Seller: Upload vault credentials ────────────────────────────────────────

class VaultUploadView(APIView):
    """POST /api/v1/orders/<id>/provision/"""
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request, pk):
        try:
            order = Order.objects.select_for_update().get(pk=pk)
        except Order.DoesNotExist:
            return Response({"error": "Order not found."}, status=404)

        if order.listing.seller != request.user:
            return Response({"error": "Only the seller can upload credentials."}, status=403)

        if order.status != OrderStatus.FUNDED:
            return Response(
                {"error": f"Credentials can only be uploaded when order is FUNDED. Current: {order.status}"},
                status=400,
            )

        serializer = VaultUploadSerializer(data=request.data, context={"order": order})
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        # Idempotency — reject duplicate uploads
        if hasattr(order, "vault"):
            return Response({"error": "Credentials already uploaded."}, status=409)

        vault = EscrowVault(order=order)
        vault.encrypt_and_save(
            username=data["username"],
            password=data["password"],
            oge=data["oge"],
            transfer_notes=data.get("transfer_notes", ""),
        )

        order.transition_to(OrderStatus.PROVISIONED)

        Notification.objects.create(
            recipient=order.buyer,
            notification_type=NotificationType.CREDENTIALS_UPLOADED,
            title="Credentials Ready — Verify Now",
            message=(
                f"The seller has uploaded credentials for '{order.listing.title}'. "
                "Please verify they work within 48 hours."
            ),
            action_url=f"/orders/{order.id}",
            metadata={"order_id": str(order.id)},
        )

        ActivityLog.log_from_request(
            request,
            action=ActionType.VAULT_UPLOADED,
            description=f"Seller {request.user.username} uploaded vault for order {str(order.id)[:8].upper()}",
            object_type="Order",
            object_id=str(order.id),
        )

        return Response({"detail": "Credentials uploaded. Order is now PROVISIONED.", "order_id": str(order.id)})


# ── Buyer: Retrieve decrypted credentials ───────────────────────────────────

class VaultRetrieveView(APIView):
    """GET /api/v1/orders/<id>/credentials/"""
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        try:
            order = Order.objects.select_related("listing").get(pk=pk)
        except Order.DoesNotExist:
            return Response({"error": "Order not found."}, status=404)

        if order.buyer != request.user:
            return Response({"error": "Only the buyer can retrieve credentials."}, status=403)

        readable = (OrderStatus.PROVISIONED, OrderStatus.INSPECTION,
                    OrderStatus.COMPLETED, OrderStatus.DISPUTED)
        if order.status not in readable:
            return Response({"error": f"Credentials not available in '{order.status}' status."}, status=403)

        try:
            credentials = order.vault.decrypt()
        except Exception:
            return Response({"error": "No credentials uploaded yet."}, status=404)

        # Move to INSPECTION on first view
        if order.status == OrderStatus.PROVISIONED:
            order.transition_to(OrderStatus.INSPECTION)

        ActivityLog.log_from_request(
            request,
            action=ActionType.VAULT_VIEWED,
            description=f"Buyer {request.user.username} viewed vault for order {str(order.id)[:8].upper()}",
            object_type="Order",
            object_id=str(order.id),
        )

        return Response(credentials)


# ── Buyer: Complete order (release funds) ───────────────────────────────────

class OrderCompleteView(APIView):
    """POST /api/v1/orders/<id>/complete/"""
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request, pk):
        try:
            # select_for_update prevents double-spending race condition
            order = Order.objects.select_for_update(nowait=False).select_related(
                "listing", "listing__seller", "buyer"
            ).get(pk=pk)
        except Order.DoesNotExist:
            return Response({"error": "Order not found."}, status=404)

        if order.buyer != request.user:
            return Response({"error": "Only the buyer can complete an order."}, status=403)

        serializer = OrderCompleteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        # Re-read status AFTER acquiring lock
        if order.status != OrderStatus.INSPECTION:
            return Response(
                {"error": f"Order cannot be completed from '{order.status}' status."},
                status=400,
            )

        order.transition_to(OrderStatus.COMPLETED)

        # Mark listing sold
        order.listing.status = ListingStatus.SOLD
        order.listing.save(update_fields=["status"])

        # Record platform revenue (idempotent)
        PlatformRevenue.objects.get_or_create(
            order=order,
            defaults={
                "commission_amount": order.commission,
                "platform": order.listing.platform,
            },
        )

        # Atomic credit — F() prevents race on seller row from other completions
        seller = order.listing.seller
        from django.contrib.auth import get_user_model
        User = get_user_model()
        User.objects.filter(pk=seller.pk).update(
            total_earned=F("total_earned") + order.seller_payout,
            completed_sales=F("completed_sales") + 1,
        )

        # Update buyer stats
        User.objects.filter(pk=order.buyer.pk).update(
            total_spent=F("total_spent") + order.amount,
            completed_purchases=F("completed_purchases") + 1,
        )

        Notification.objects.bulk_create([
            Notification(
                recipient=order.buyer,
                notification_type=NotificationType.ORDER_COMPLETED,
                title="Order Completed",
                message=f"You confirmed '{order.listing.title}'. Transaction closed.",
                action_url=f"/orders/{order.id}",
                metadata={"order_id": str(order.id)},
            ),
            Notification(
                recipient=seller,
                notification_type=NotificationType.ORDER_COMPLETED,
                title="Payment Released — Sale Complete",
                message=f"₦{order.seller_payout:,.2f} added to your balance for '{order.listing.title}'.",
                action_url=f"/orders/{order.id}",
                metadata={"order_id": str(order.id), "payout": str(order.seller_payout)},
            ),
        ])

        send_fund_release_email(order)

        ActivityLog.log_from_request(
            request,
            action=ActionType.ORDER_COMPLETED,
            description=f"Buyer {request.user.username} completed order {str(order.id)[:8].upper()} — ₦{order.seller_payout:,.2f} to {seller.username}",
            object_type="Order",
            object_id=str(order.id),
        )

        return Response({"detail": "Order completed. Funds released to seller."})


# ── Buyer: Raise a dispute ───────────────────────────────────────────────────

class OrderDisputeView(APIView):
    """POST /api/v1/orders/<id>/dispute/"""
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request, pk):
        try:
            order = Order.objects.select_for_update().select_related(
                "listing", "listing__seller", "buyer"
            ).get(pk=pk)
        except Order.DoesNotExist:
            return Response({"error": "Order not found."}, status=404)

        if order.buyer != request.user:
            return Response({"error": "Only the buyer can raise a dispute."}, status=403)

        if not order.is_disputable:
            return Response(
                {"error": f"Orders in '{order.status}' status cannot be disputed."},
                status=400,
            )

        # Check if dispute app is installed and use it
        try:
            from apps.disputes.models import Dispute, DisputeStatus
            from apps.disputes.views import _notify_moderators_dispute_opened

            reason      = request.data.get("reason", "OTHER")
            description = request.data.get("description", request.data.get("reason", ""))

            if hasattr(order, "dispute"):
                return Response({"error": "A dispute already exists for this order."}, status=400)

            dispute = Dispute.objects.create(
                order=order,
                opened_by=request.user,
                reason=reason,
                description=description,
                status=DisputeStatus.PENDING,
            )

            order.transition_to(OrderStatus.DISPUTED)
            _notify_moderators_dispute_opened(dispute, order)

            dispute_id = str(dispute.id)

        except ImportError:
            # Disputes app not installed yet — basic dispute handling
            order.admin_notes = f"DISPUTE: {request.data.get('reason', '')}"
            order.save(update_fields=["admin_notes"])
            order.transition_to(OrderStatus.DISPUTED)
            dispute_id = None

        Notification.objects.create(
            recipient=order.listing.seller,
            notification_type=NotificationType.ORDER_DISPUTED,
            title="Dispute Raised on Your Order",
            message=(
                f"The buyer raised a dispute for '{order.listing.title}'. "
                "Funds are frozen pending moderator review."
            ),
            action_url=f"/orders/{order.id}",
            metadata={"order_id": str(order.id)},
        )

        ActivityLog.log_from_request(
            request,
            action=ActionType.ORDER_DISPUTED,
            description=f"Buyer {request.user.username} disputed order {str(order.id)[:8].upper()}",
            object_type="Order",
            object_id=str(order.id),
        )

        response_data = {"detail": "Dispute raised. A moderator will review shortly."}
        if dispute_id:
            response_data["dispute_id"] = dispute_id
        return Response(response_data)


# ── Buyer: Cancel a PENDING order ───────────────────────────────────────────

class OrderCancelView(APIView):
    """POST /api/v1/orders/<id>/cancel/"""
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request, pk):
        try:
            order = Order.objects.select_for_update().select_related(
                "listing", "listing__seller"
            ).get(pk=pk)
        except Order.DoesNotExist:
            return Response({"error": "Order not found."}, status=404)

        if order.buyer != request.user:
            return Response({"error": "Only the buyer can cancel this order."}, status=403)

        try:
            order.transition_to(OrderStatus.CANCELLED)
        except ValueError as e:
            return Response({"error": str(e)}, status=400)

        # Re-activate listing
        order.listing.status = ListingStatus.ACTIVE
        order.listing.save(update_fields=["status"])

        Notification.objects.create(
            recipient=order.listing.seller,
            notification_type=NotificationType.ORDER_CANCELLED,
            title="Order Cancelled",
            message=f"The buyer cancelled their order for '{order.listing.title}'.",
            action_url=f"/orders/{order.id}",
            metadata={"order_id": str(order.id)},
        )

        return Response({"detail": "Order cancelled."})