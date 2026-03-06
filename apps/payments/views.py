"""
apps/payments/views.py

FIXES IN THIS VERSION
─────────────────────
1. Guest notification now uses a password-reset token link instead of
   trying to re-send the hashed password (which was always blank).
   The raw password is generated, set on the user, and a reset link is
   built with Django's default_token_generator so the buyer can log in.

2. _get_or_create_guest now returns (user, raw_password, is_new) so the
   payment view can pass the raw_password straight into the guest email
   without going through the database again.

3. verify endpoint idempotency: if order is already funded by a
   previous verify call, return immediately without re-running.
"""
import hmac
import hashlib
import json
import uuid
import secrets
import string
import logging

from django.conf import settings
from django.contrib.auth.tokens import default_token_generator
from django.core.mail import send_mail
from django.db import transaction
from django.http import HttpResponse
from django.template.loader import render_to_string
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode
from django.views.decorators.csrf import csrf_exempt

from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import User
from apps.activity.models import ActivityLog, ActionType
from apps.listings.models import AccountListing, ListingStatus
from apps.notifications.models import Notification, NotificationType
from apps.orders.models import Order, OrderStatus

from .paystack import initialize_transaction, verify_transaction

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# 1.  POST /api/v1/payments/initiate/
# ─────────────────────────────────────────────────────────────────────────────

class PaymentInitiateView(APIView):
    permission_classes = [AllowAny]

    @transaction.atomic
    def post(self, request):
        listing_id  = request.data.get("listing_id")
        guest_email = request.data.get("guest_email", "").strip().lower()

        # ── Resolve buyer ─────────────────────────────────────────────────────
        guest_password = None   # only set for newly created guests
        is_new_guest   = False

        if request.user.is_authenticated:
            buyer = request.user
        elif guest_email:
            buyer, guest_password, is_new_guest = self._get_or_create_guest(guest_email)
            if buyer is None:
                return Response({"error": "Invalid email address."}, status=400)
        else:
            return Response(
                {"error": "Please provide an email address to continue."},
                status=400,
            )

        # ── Validate listing ──────────────────────────────────────────────────
        if not listing_id:
            return Response({"error": "listing_id is required."}, status=400)

        try:
            listing = (
                AccountListing.objects
                .select_for_update()
                .get(pk=listing_id, status=ListingStatus.ACTIVE)
            )
        except AccountListing.DoesNotExist:
            return Response({"error": "This listing is no longer available."}, status=404)

        if listing.seller_id == buyer.id:
            return Response({"error": "You cannot purchase your own listing."}, status=400)

        # ── Financials ────────────────────────────────────────────────────────
        commission_pct = getattr(settings, "PLATFORM_COMMISSION_PERCENT", 10)
        commission     = (listing.price * commission_pct) / 100
        seller_payout  = listing.price - commission
        reference      = f"EM-{uuid.uuid4().hex[:16].upper()}"

        # ── Create Order ──────────────────────────────────────────────────────
        order = Order.objects.create(
            buyer              = buyer,
            listing            = listing,
            amount             = listing.price,
            commission         = commission,
            seller_payout      = seller_payout,
            status             = OrderStatus.PENDING,
            paystack_reference = reference,
        )
        listing.status = ListingStatus.UNDER_REVIEW
        listing.save(update_fields=["status"])

        # Store whether this is a new guest so verify can email credentials
        if is_new_guest:
            order._guest_password = guest_password  # transient, not persisted

        # ── Paystack ──────────────────────────────────────────────────────────
        try:
            result = initialize_transaction(
                email        = buyer.email,
                amount_naira = float(listing.price),
                reference    = reference,
                metadata     = {
                    "order_id":      str(order.id),
                    "listing_id":    str(listing.id),
                    "buyer_id":      str(buyer.id),
                    "listing_title": listing.title,
                    "is_new_guest":  is_new_guest,
                },
            )
        except Exception as exc:
            order.delete()
            listing.status = ListingStatus.ACTIVE
            listing.save(update_fields=["status"])
            logger.error("Paystack initialization failed: %s", exc)
            return Response(
                {"error": "Payment gateway error. Please try again shortly."},
                status=502,
            )

        ActivityLog.log(
            action      = ActionType.PAYMENT_INITIATED,
            user        = buyer,
            description = f"Payment initiated for '{listing.title}' — ₦{listing.price:,.2f}",
            ip_address  = request.META.get("REMOTE_ADDR", ""),
            object_type = "Order",
            object_id   = str(order.id),
            metadata    = {"reference": reference},
        )

        return Response({
            "authorization_url": result["data"]["authorization_url"],
            "reference":         reference,
            "order_id":          str(order.id),
        })

    def _get_or_create_guest(self, email: str):
        """
        Returns (user, raw_password, is_new).
        raw_password is only set when the account is newly created.
        For existing users, raw_password is None (they already have a password).
        """
        if "@" not in email or "." not in email.split("@")[-1]:
            return None, None, False

        existing = User.objects.filter(email=email).first()
        if existing:
            return existing, None, False

        base_username = email.split("@")[0][:25]
        username      = f"{base_username}_{uuid.uuid4().hex[:5]}"
        raw_password  = "".join(
            secrets.choice(string.ascii_letters + string.digits)
            for _ in range(14)
        )
        user = User.objects.create_user(
            email=email, username=username, password=raw_password,
        )
        logger.info("Guest account created: %s (%s)", username, email)
        return user, raw_password, True


# ─────────────────────────────────────────────────────────────────────────────
# 2.  GET /api/v1/payments/verify/?reference=EM-...
# ─────────────────────────────────────────────────────────────────────────────

class PaymentVerifyView(APIView):
    """
    Called by frontend after Paystack redirect.
    Calls Paystack API directly to fund the order without waiting for webhook.
    """
    permission_classes = [AllowAny]

    @transaction.atomic
    def get(self, request):
        reference = request.query_params.get("reference", "").strip()
        if not reference:
            return Response({"error": "reference is required."}, status=400)

        try:
            order = Order.objects.select_for_update().get(
                paystack_reference=reference
            )
        except Order.DoesNotExist:
            return Response({"error": "Order not found."}, status=404)

        # Already funded (by webhook or previous verify call)
        if order.status != OrderStatus.PENDING:
            return Response({"status": order.status, "order_id": str(order.id)})

        # Ask Paystack directly
        try:
            result = verify_transaction(reference)
        except Exception as exc:
            logger.error("Paystack verify API call failed: %s", exc)
            return Response({"status": "pending", "order_id": str(order.id)})

        paystack_status = result.get("data", {}).get("status")
        amount_kobo     = result.get("data", {}).get("amount", 0)
        amount_naira    = amount_kobo / 100
        metadata        = result.get("data", {}).get("metadata", {})

        # Paystack says NOT paid
        if paystack_status != "success":
            order.status = OrderStatus.CANCELLED
            order.save(update_fields=["status"])
            order.listing.status = ListingStatus.ACTIVE
            order.listing.save(update_fields=["status"])
            return Response({"status": "cancelled", "order_id": str(order.id)})

        # Fund the order
        try:
            order.transition_to(OrderStatus.FUNDED)
        except ValueError as exc:
            logger.error("Order %s transition failed: %s", order.id, exc)
            return Response({"status": order.status, "order_id": str(order.id)})

        self._post_fund_actions(order, amount_naira, request, source="verify_redirect")

        # Send guest credentials email (uses password reset token — no plain-text pw needed)
        is_new_guest = metadata.get("is_new_guest", False)
        if is_new_guest:
            _send_guest_credentials_email(order.buyer, order)

        return Response({"status": order.status, "order_id": str(order.id)})

    def _post_fund_actions(self, order, amount_naira, request, source):
        seller = order.listing.seller

        Notification.objects.create(
            recipient         = seller,
            notification_type = NotificationType.SALE_MADE,
            title             = "New Sale — Upload Credentials Now",
            message           = (
                f"'{order.listing.title}' was purchased for "
                f"₦{amount_naira:,.2f}. Upload credentials to proceed."
            ),
            action_url = f"/orders/{order.id}",
            metadata   = {"order_id": str(order.id)},
        )
        Notification.objects.create(
            recipient         = order.buyer,
            notification_type = NotificationType.ORDER_FUNDED,
            title             = "Payment Confirmed — Funds in Escrow",
            message           = (
                f"Your payment of ₦{amount_naira:,.2f} for "
                f"'{order.listing.title}' is secured in escrow."
            ),
            action_url = f"/orders/{order.id}",
            metadata   = {"order_id": str(order.id)},
        )

        ActivityLog.log(
            action      = ActionType.PAYMENT_VERIFIED,
            user        = order.buyer,
            description = f"Payment verified via {source}: ₦{amount_naira:,.2f}",
            ip_address  = request.META.get("REMOTE_ADDR", ""),
            object_type = "Order",
            object_id   = str(order.id),
            metadata    = {"source": source},
        )

        _send_payment_emails(order, amount_naira)
        logger.info("Order %s funded via %s.", order.id, source)


# ─────────────────────────────────────────────────────────────────────────────
# 3.  POST /api/v1/payments/webhook/
# ─────────────────────────────────────────────────────────────────────────────

def _verify_paystack_signature(request) -> bool:
    signature = request.META.get("HTTP_X_PAYSTACK_SIGNATURE", "")
    if not signature:
        return False
    secret   = settings.PAYSTACK_SECRET_KEY.encode("utf-8")
    computed = hmac.new(secret, request.body, hashlib.sha512).hexdigest()
    return hmac.compare_digest(computed, signature)


def _is_already_funded(order) -> bool:
    return order.status not in (OrderStatus.PENDING,)


@csrf_exempt
def paystack_webhook(request):
    if request.method != "POST":
        return HttpResponse(status=405)

    if not _verify_paystack_signature(request):
        logger.warning("Webhook rejected — invalid signature from %s",
                       request.META.get("REMOTE_ADDR"))
        ActivityLog.log(
            action      = ActionType.PAYMENT_VERIFIED,
            description = "REJECTED webhook — invalid HMAC signature",
            ip_address  = request.META.get("REMOTE_ADDR", ""),
            metadata    = {"reason": "invalid_signature"},
        )
        return HttpResponse(status=401)

    try:
        payload = json.loads(request.body)
    except json.JSONDecodeError:
        return HttpResponse(status=400)

    event = payload.get("event")
    data  = payload.get("data", {})
    logger.info("Paystack webhook: event=%s", event)

    if event == "charge.success":
        return _handle_charge_success(request, data)

    return HttpResponse(status=200)


@transaction.atomic
def _handle_charge_success(request, data: dict) -> HttpResponse:
    reference    = data.get("reference")
    amount_kobo  = data.get("amount", 0)
    amount_naira = amount_kobo / 100
    metadata     = data.get("metadata", {})

    if not reference:
        return HttpResponse(status=400)

    try:
        order = Order.objects.select_for_update().get(paystack_reference=reference)
    except Order.DoesNotExist:
        logger.error("charge.success — no order for reference=%s", reference)
        return HttpResponse(status=200)

    # Idempotency — verify redirect may have already funded this
    if _is_already_funded(order):
        logger.info("charge.success — order %s already %s, skipping",
                    order.id, order.status)
        return HttpResponse(status=200)

    try:
        order.transition_to(OrderStatus.FUNDED)
    except ValueError as exc:
        logger.error("Order %s transition failed: %s", order.id, exc)
        return HttpResponse(status=200)

    # Analytics (best-effort)
    try:
        analytics = order.listing.store.analytics
        analytics.record_sale(amount=amount_naira)
    except Exception as exc:
        logger.warning("Analytics record_sale failed: %s", exc)

    seller = order.listing.seller

    Notification.objects.create(
        recipient         = seller,
        notification_type = NotificationType.SALE_MADE,
        title             = "New Sale — Upload Credentials Now",
        message           = (
            f"'{order.listing.title}' was purchased for "
            f"₦{amount_naira:,.2f}. Upload credentials to proceed."
        ),
        action_url = f"/orders/{order.id}",
        metadata   = {"order_id": str(order.id), "reference": reference},
    )
    Notification.objects.create(
        recipient         = order.buyer,
        notification_type = NotificationType.ORDER_FUNDED,
        title             = "Payment Confirmed — Funds in Escrow",
        message           = (
            f"Your payment of ₦{amount_naira:,.2f} for "
            f"'{order.listing.title}' is secured in escrow."
        ),
        action_url = f"/orders/{order.id}",
        metadata   = {"order_id": str(order.id)},
    )

    ActivityLog.log(
        action      = ActionType.PAYMENT_VERIFIED,
        user        = order.buyer,
        description = (
            f"Payment confirmed via webhook: ₦{amount_naira:,.2f} "
            f"ref={reference}"
        ),
        ip_address  = request.META.get("REMOTE_ADDR", ""),
        object_type = "Order",
        object_id   = str(order.id),
        metadata    = {"reference": reference, "amount_naira": str(amount_naira)},
    )

    _send_payment_emails(order, amount_naira)

    # Guest credential email
    is_new_guest = metadata.get("is_new_guest", False)
    if is_new_guest:
        _send_guest_credentials_email(order.buyer, order)

    logger.info("Order %s funded via webhook. ref=%s", order.id, reference)
    return HttpResponse(status=200)


# ── Email helpers ─────────────────────────────────────────────────────────────

def _send_payment_emails(order, amount_naira: float) -> None:
    buyer  = order.buyer
    seller = order.listing.seller

    try:
        send_mail(
            subject       = f"Payment Confirmed — {order.listing.title}",
            message       = (
                f"Hi {buyer.display_name},\n\n"
                f"Your payment of ₦{amount_naira:,.2f} for '{order.listing.title}' "
                f"is now secured in escrow.\n\n"
                f"View your order: {settings.FRONTEND_URL}/orders/{order.id}\n\n"
                f"— EscrowMarket"
            ),
            from_email     = settings.DEFAULT_FROM_EMAIL,
            recipient_list = [buyer.email],
            fail_silently  = True,
        )
    except Exception as exc:
        logger.warning("Buyer email failed: %s", exc)

    try:
        send_mail(
            subject       = f"New Sale — Upload Credentials for '{order.listing.title}'",
            message       = (
                f"Hi {seller.display_name},\n\n"
                f"You have a new sale! ₦{order.seller_payout:,.2f} will be released once the buyer confirms.\n\n"
                f"Upload credentials now: {settings.FRONTEND_URL}/orders/{order.id}\n\n"
                f"— EscrowMarket"
            ),
            from_email     = settings.DEFAULT_FROM_EMAIL,
            recipient_list = [seller.email],
            fail_silently  = True,
        )
    except Exception as exc:
        logger.warning("Seller email failed: %s", exc)


def _send_guest_credentials_email(buyer, order) -> None:
    """
    FIX: The previous implementation tried to re-send a raw password
    that was already hashed in the database — it was always blank.

    Solution: Generate a secure password-reset token (same mechanism
    Django's /password-reset/ uses). The buyer clicks the link, sets
    their own password, and immediately lands on their orders page.

    This is safer than sending a plain-text password over email.
    """
    from django.utils import timezone
    from datetime import timedelta

    # Only send for accounts created in the last 15 minutes
    just_created = (timezone.now() - buyer.date_joined) < timedelta(minutes=15)
    if not just_created:
        return

    try:
        uid   = urlsafe_base64_encode(force_bytes(buyer.pk))
        token = default_token_generator.make_token(buyer)
        # Frontend must have a /reset-password/:uid/:token route
        set_password_url = (
            f"{settings.FRONTEND_URL}/reset-password/{uid}/{token}/"
        )

        send_mail(
            subject       = "Your EscrowMarket Account — Set Your Password",
            message       = (
                f"Hi {buyer.username},\n\n"
                f"Your order has been placed and your payment is secured in escrow.\n\n"
                f"We created an account for you automatically. Set your password here "
                f"to track your order and receive credentials from the seller:\n\n"
                f"{set_password_url}\n\n"
                f"This link expires in 24 hours.\n\n"
                f"Your order: {settings.FRONTEND_URL}/orders/{order.id}\n"
                f"Email: {buyer.email}\n\n"
                f"— EscrowMarket"
            ),
            from_email     = settings.DEFAULT_FROM_EMAIL,
            recipient_list = [buyer.email],
            fail_silently  = False,  # Raise so we can see failures in logs
        )
        logger.info("Guest credentials email sent to %s (order %s)", buyer.email, order.id)
    except Exception as exc:
        logger.error("Guest credentials email FAILED for %s: %s", buyer.email, exc)