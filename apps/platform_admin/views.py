"""
apps/platform_admin/views.py

Adds RevenueView — the endpoint Revenue.jsx calls at GET /api/v1/admin/revenue/.
Also adds approve/reject shorthand handlers used by Withdrawals.jsx.
"""
import logging
import requests
from decimal import Decimal
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.conf import settings as django_settings
from django.db import transaction
from django.db.models import Sum, Q, Avg, Count
from django.utils import timezone

from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.orders.models import Order, OrderStatus, PlatformRevenue
from apps.listings.models import AccountListing, ListingStatus
from apps.notifications.models import Notification, NotificationType
from apps.activity.models import ActivityLog, ActionType
from .models import PlatformSettings, WithdrawalRequest, WithdrawalStatus
from .permissions import IsPlatformOwner
from .serializers import (
    PlatformSettingsSerializer,
    AdminUserSerializer,
    WithdrawalRequestSerializer,
    WithdrawalSubmitSerializer,
    WithdrawalReviewSerializer,
    RevenueStatSerializer,
)

logger = logging.getLogger(__name__)
User   = get_user_model()

PAYSTACK_BASE = "https://api.paystack.co"


# ── Helpers ───────────────────────────────────────────────────────────────────

def _log(request, action, description, object_type="", object_id=""):
    try:
        ip = (
            request.META.get("HTTP_X_FORWARDED_FOR", "").split(",")[0].strip()
            or request.META.get("REMOTE_ADDR", "")
        )
        ActivityLog.objects.create(
            user=request.user, action=action, description=description,
            ip_address=ip or "0.0.0.0",
            object_type=object_type, object_id=object_id,
        )
    except Exception as e:
        logger.error(f"ActivityLog write failed: {e}")


def _paystack_headers():
    secret = getattr(django_settings, "PAYSTACK_SECRET_KEY", "")
    if not secret:
        raise ValueError("PAYSTACK_SECRET_KEY is not set.")
    return {
        "Authorization": f"Bearer {secret}",
        "Content-Type":  "application/json",
    }


def _create_transfer_recipient(account_name, account_number, bank_code) -> str:
    resp = requests.post(
        f"{PAYSTACK_BASE}/transferrecipient",
        json={
            "type": "nuban", "name": account_name,
            "account_number": account_number,
            "bank_code": bank_code, "currency": "NGN",
        },
        headers=_paystack_headers(), timeout=30,
    )
    data = resp.json()
    if not data.get("status"):
        raise ValueError(f"Paystack recipient error: {data.get('message', 'Unknown')}")
    return data["data"]["recipient_code"]


def _initiate_transfer(amount_naira: Decimal, recipient_code: str, reason: str) -> dict:
    resp = requests.post(
        f"{PAYSTACK_BASE}/transfer",
        json={
            "source": "balance",
            "amount": int(amount_naira * 100),
            "recipient": recipient_code,
            "reason": reason,
        },
        headers=_paystack_headers(), timeout=30,
    )
    data = resp.json()
    if not data.get("status"):
        raise ValueError(f"Paystack transfer error: {data.get('message', 'Unknown')}")
    return {
        "transfer_code": data["data"]["transfer_code"],
        "reference":     data["data"]["reference"],
    }


# ── Revenue ───────────────────────────────────────────────────────────────────

class RevenueView(APIView):
    """
    GET /api/v1/admin/revenue/

    Returns the data shape that Revenue.jsx expects:
    {
        summary: { total_revenue, total_orders, avg_commission, this_month },
        by_platform: [ { platform, total, count }, ... ],
        recent: [ { id, order_id, listing_title, commission_amount, recorded_at }, ... ]
    }
    """
    permission_classes = [IsPlatformOwner]

    def get(self, request):
        now        = timezone.now()
        month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

        # ── Summary ───────────────────────────────────────────────────────────
        agg = PlatformRevenue.objects.aggregate(
            total_revenue=Sum("commission_amount"),
            total_orders=Count("id"),
            avg_commission=Avg("commission_amount"),
        )
        this_month = (
            PlatformRevenue.objects
            .filter(recorded_at__gte=month_start)
            .aggregate(t=Sum("commission_amount"))["t"] or Decimal("0")
        )

        # ── By platform ───────────────────────────────────────────────────────
        by_platform = list(
            PlatformRevenue.objects
            .values("platform")
            .annotate(total=Sum("commission_amount"), count=Count("id"))
            .order_by("-total")
        )

        # ── Recent 20 ledger entries ──────────────────────────────────────────
        recent_qs = (
            PlatformRevenue.objects
            .select_related("order__listing")
            .order_by("-recorded_at")[:20]
        )
        recent = [
            {
                "id":               str(r.id),
                "order_id":         str(r.order_id),
                "listing_title":    r.order.listing.title if r.order and r.order.listing else "—",
                "commission_amount": str(r.commission_amount),
                "recorded_at":      r.recorded_at.isoformat(),
            }
            for r in recent_qs
        ]

        return Response({
            "summary": {
                "total_revenue":  str(agg["total_revenue"]  or "0"),
                "total_orders":   agg["total_orders"]        or 0,
                "avg_commission": str(agg["avg_commission"]  or "0"),
                "this_month":     str(this_month),
            },
            "by_platform": [
                {
                    "platform": p["platform"],
                    "total":    str(p["total"] or "0"),
                    "count":    p["count"],
                }
                for p in by_platform
            ],
            "recent": recent,
        })


# ── Stats ─────────────────────────────────────────────────────────────────────

class AdminStatsView(APIView):
    """GET /api/v1/admin/stats/"""
    permission_classes = [IsPlatformOwner]

    def get(self, request):
        total_commissions = (
            PlatformRevenue.objects.aggregate(t=Sum("commission_amount"))["t"] or Decimal("0")
        )
        total_revenue = (
            Order.objects.filter(status=OrderStatus.COMPLETED)
            .aggregate(t=Sum("amount"))["t"] or Decimal("0")
        )
        escrow_held = (
            Order.objects.filter(status__in=[
                OrderStatus.FUNDED, OrderStatus.IN_PROVISION,
                OrderStatus.DISPUTED,
            ]).aggregate(t=Sum("amount"))["t"] or Decimal("0")
        )
        pending_withdrawals = (
            WithdrawalRequest.objects.filter(status=WithdrawalStatus.PENDING)
            .aggregate(t=Sum("amount"))["t"] or Decimal("0")
        )

        return Response({
            "total_revenue":       str(total_revenue),
            "total_commissions":   str(total_commissions),
            "escrow_held":         str(escrow_held),
            "pending_withdrawals": str(pending_withdrawals),
            "total_orders":        Order.objects.count(),
            "completed_orders":    Order.objects.filter(status=OrderStatus.COMPLETED).count(),
            "disputed_orders":     Order.objects.filter(status=OrderStatus.DISPUTED).count(),
            "total_users":         User.objects.count(),
            "active_listings":     AccountListing.objects.filter(status=ListingStatus.ACTIVE).count(),
        })


# ── Settings ──────────────────────────────────────────────────────────────────

class PlatformSettingsView(APIView):
    """GET + PATCH /api/v1/admin/settings/"""
    permission_classes = [IsPlatformOwner]

    def get(self, request):
        return Response(PlatformSettingsSerializer(PlatformSettings.get()).data)

    def patch(self, request):
        obj = PlatformSettings.get()
        s   = PlatformSettingsSerializer(obj, data=request.data, partial=True)
        s.is_valid(raise_exception=True)
        obj = s.save(updated_by=request.user)
        _log(request, ActionType.ADMIN_ROUTE_ACCESS,
             f"Settings updated: {list(request.data.keys())} by {request.user.username}",
             "PlatformSettings", "1")
        return Response(PlatformSettingsSerializer(obj).data)


# ── Users ─────────────────────────────────────────────────────────────────────

class AdminUserListView(generics.ListAPIView):
    """GET /api/v1/admin/users/"""
    serializer_class   = AdminUserSerializer
    permission_classes = [IsPlatformOwner]

    def get_queryset(self):
        qs     = User.objects.all().order_by("-date_joined")
        search = self.request.query_params.get("search")
        role   = self.request.query_params.get("role")
        if search:
            qs = qs.filter(
                Q(username__icontains=search) |
                Q(email__icontains=search)    |
                Q(full_name__icontains=search)
            )
        if role:
            qs = qs.filter(role=role)
        return qs


class AdminUserUpdateView(APIView):
    """PATCH /api/v1/admin/users/<id>/ — ban/unban/verify/promote/demote"""
    permission_classes = [IsPlatformOwner]

    def patch(self, request, pk):
        try:
            target = User.objects.get(pk=pk)
        except User.DoesNotExist:
            return Response({"error": "User not found."}, status=404)
        if target == request.user:
            return Response({"error": "Cannot modify your own account."}, status=400)

        action = request.data.get("action")
        valid_actions = {"ban", "unban", "verify", "promote_moderator", "demote_user"}
        if action not in valid_actions:
            # Also accept role field for compatibility with AdminUsers.jsx
            role = request.data.get("role")
            if role == "moderator":
                action = "promote_moderator"
            elif role == "user":
                action = "demote_user"
            else:
                return Response({"error": f"Invalid action. One of: {valid_actions}"}, status=400)

        if action == "ban":
            target.is_active = False
            target.save(update_fields=["is_active"])
            desc = f"User {target.username} banned"

        elif action == "unban":
            target.is_active = True
            target.save(update_fields=["is_active"])
            desc = f"User {target.username} unbanned"

        elif action == "verify":
            target.is_email_verified = True
            target.save(update_fields=["is_email_verified"])
            desc = f"User {target.username} manually verified"

        elif action == "promote_moderator":
            if target.role in ("platform_owner", "admin"):
                return Response({"error": "Cannot change role of a platform owner."}, status=400)
            target.role     = "moderator"
            target.is_staff = True
            target.save(update_fields=["role", "is_staff"])
            Notification.objects.create(
                recipient=target, notification_type=NotificationType.SYSTEM,
                title="You've Been Made a Moderator",
                message="You now have moderator access. Visit /moderator to get started.",
                action_url="/moderator",
            )
            desc = f"User {target.username} promoted to Moderator"

        elif action == "demote_user":
            if target.role in ("platform_owner", "admin"):
                return Response({"error": "Cannot demote a platform owner."}, status=400)
            target.role     = "user"
            target.is_staff = False
            target.save(update_fields=["role", "is_staff"])
            desc = f"User {target.username} demoted to User"

        _log(request, ActionType.ADMIN_ROUTE_ACCESS,
             f"{desc} by {request.user.username}", "User", str(target.pk))
        return Response(AdminUserSerializer(target).data)


# ── Withdrawals ───────────────────────────────────────────────────────────────

class WithdrawalListView(APIView):
    """
    GET  /api/v1/admin/withdrawals/  → owner sees all
    POST /api/v1/admin/withdrawals/  → seller submits request
    """
    def get_permissions(self):
        return [IsPlatformOwner()] if self.request.method == "GET" else [IsAuthenticated()]

    def get(self, request):
        qs = WithdrawalRequest.objects.select_related("seller", "reviewed_by").all()
        s  = request.query_params.get("status")
        if s:
            qs = qs.filter(status=s.upper())
        return Response(WithdrawalRequestSerializer(qs, many=True).data)

    def post(self, request):
        s = WithdrawalSubmitSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        data = s.validated_data
        cfg  = PlatformSettings.get()

        if data["amount"] < cfg.min_withdrawal_amount:
            return Response(
                {"error": f"Minimum withdrawal is ₦{cfg.min_withdrawal_amount:,.2f}"},
                status=400,
            )
        if request.user.total_earned < data["amount"]:
            return Response({"error": "Insufficient balance."}, status=400)
        if WithdrawalRequest.objects.filter(
            seller=request.user,
            status__in=[WithdrawalStatus.PENDING, WithdrawalStatus.PROCESSING]
        ).exists():
            return Response({"error": "You already have a pending withdrawal."}, status=409)

        w = WithdrawalRequest.objects.create(seller=request.user, **data)
        _log(request, ActionType.PAYMENT_INITIATED,
             f"Withdrawal request ₦{data['amount']:,.2f} submitted",
             "WithdrawalRequest", str(w.id))
        return Response(WithdrawalRequestSerializer(w).data, status=201)


class WithdrawalReviewView(APIView):
    """
    POST /api/v1/admin/withdrawals/<id>/review/
    POST /api/v1/admin/withdrawals/<id>/approve/  ← alias
    POST /api/v1/admin/withdrawals/<id>/reject/   ← alias

    The approve/reject aliases auto-inject the decision so the
    Withdrawals.jsx frontend doesn't need a separate request body key.
    """
    permission_classes = [IsPlatformOwner]

    def _infer_decision(self, request):
        """
        If URL ends in /approve/ or /reject/, inject the decision automatically
        so the frontend can POST {} without a body.
        """
        path = request.path
        if path.endswith("/approve/"):
            return {**request.data, "decision": "approve"}
        if path.endswith("/reject/"):
            note = request.data.get("note", "Rejected by platform owner.")
            return {"decision": "reject", "rejection_reason": note}
        return request.data

    @transaction.atomic
    def post(self, request, pk):
        try:
            w = WithdrawalRequest.objects.select_for_update().select_related("seller").get(pk=pk)
        except WithdrawalRequest.DoesNotExist:
            return Response({"error": "Withdrawal request not found."}, status=404)

        if w.status not in (WithdrawalStatus.PENDING,):
            return Response({"error": f"Request is already {w.status}."}, status=400)

        merged_data = self._infer_decision(request)
        s = WithdrawalReviewSerializer(data=merged_data)
        s.is_valid(raise_exception=True)
        data = s.validated_data
        now  = timezone.now()

        # ── REJECT ────────────────────────────────────────────────────────────
        if data["decision"] == "reject":
            w.status           = WithdrawalStatus.REJECTED
            w.rejection_reason = data.get("rejection_reason", "")
            w.reviewed_by      = request.user
            w.reviewed_at      = now
            w.save()
            Notification.objects.create(
                recipient=w.seller, notification_type=NotificationType.SYSTEM,
                title="Withdrawal Rejected",
                message=(
                    f"Your withdrawal of ₦{w.amount:,.2f} was rejected. "
                    f"Reason: {data.get('rejection_reason', 'No reason given.')}"
                ),
                action_url="/profile",
            )
            _log(request, ActionType.ADMIN_ROUTE_ACCESS,
                 f"Withdrawal ₦{w.amount:,.2f} for {w.seller.username} REJECTED",
                 "WithdrawalRequest", str(w.id))
            return Response(WithdrawalRequestSerializer(w).data)

        # ── APPROVE ───────────────────────────────────────────────────────────
        if w.seller.total_earned < w.amount:
            return Response({"error": "Seller balance is insufficient."}, status=400)

        paystack_key = getattr(django_settings, "PAYSTACK_SECRET_KEY", "")

        if paystack_key and w.bank_code:
            try:
                recipient_code = _create_transfer_recipient(
                    account_name=w.account_name,
                    account_number=w.account_number,
                    bank_code=w.bank_code,
                )
                transfer = _initiate_transfer(
                    amount_naira=w.amount,
                    recipient_code=recipient_code,
                    reason=f"EscrowMarket payout for {w.seller.username}",
                )
                w.paystack_recipient_code = recipient_code
                w.paystack_transfer_code  = transfer["transfer_code"]
                w.paystack_transfer_ref   = transfer["reference"]
                w.status      = WithdrawalStatus.PROCESSING
                w.reviewed_by = request.user
                w.reviewed_at = now
                w.save()
                Notification.objects.create(
                    recipient=w.seller, notification_type=NotificationType.WITHDRAWAL_APPROVED,
                    title="Withdrawal Processing",
                    message=(
                        f"Your withdrawal of ₦{w.amount:,.2f} is being transferred to "
                        f"{w.bank_name} {w.account_number}."
                    ),
                    action_url="/profile",
                )
                _log(request, ActionType.ADMIN_ROUTE_ACCESS,
                     f"Withdrawal ₦{w.amount:,.2f} for {w.seller.username} → Paystack transfer {transfer['transfer_code']}",
                     "WithdrawalRequest", str(w.id))
            except (ValueError, requests.RequestException) as e:
                logger.error(f"Paystack transfer failed for withdrawal {pk}: {e}")
                return Response(
                    {"error": f"Paystack transfer failed: {str(e)}"},
                    status=502,
                )
        else:
            # Manual approval (no Paystack key or no bank_code)
            from django.db.models import F
            type(w.seller).objects.filter(pk=w.seller.pk).update(
                total_earned=F("total_earned") - w.amount
            )
            w.status      = WithdrawalStatus.APPROVED
            w.reviewed_by = request.user
            w.reviewed_at = now
            w.save()
            Notification.objects.create(
                recipient=w.seller, notification_type=NotificationType.WITHDRAWAL_APPROVED,
                title="Withdrawal Approved",
                message=(
                    f"Your withdrawal of ₦{w.amount:,.2f} has been approved "
                    f"and will be paid to {w.bank_name} {w.account_number} within 24 hours."
                ),
                action_url="/profile",
            )
            _log(request, ActionType.ADMIN_ROUTE_ACCESS,
                 f"Withdrawal ₦{w.amount:,.2f} for {w.seller.username} manually APPROVED",
                 "WithdrawalRequest", str(w.id))

        return Response(WithdrawalRequestSerializer(w).data)


# ── Public config (no auth) ───────────────────────────────────────────────────

class PublicPlatformConfigView(APIView):
    """
    GET /api/v1/platform/config/

    No authentication required.
    Returns only the data that seller-facing and public UIs need.

    WHY: CreateListing.jsx needs the live commission rate to show sellers
    an accurate fee breakdown while they type their price. This endpoint
    reads from PlatformSettings (the admin-controlled singleton) so the
    displayed rate is always in sync with whatever the admin has set.

    Buyers never call this — the AccountDetail purchase card shows no fees.
    """
    permission_classes     = []
    authentication_classes = []

    def get(self, request):
        cfg = PlatformSettings.get()
        return Response({
            "commission_percent":    float(cfg.commission_percent),
            "min_withdrawal_amount": float(cfg.min_withdrawal_amount),
            "platform_name":         cfg.platform_name,
            "maintenance_mode":      cfg.maintenance_mode,
        })
        

class SeizeBondView(APIView):
    """
    POST /api/v1/admin/users/<pk>/seize-bond/

    Admin nuclear option for confirmed scam sellers.
    Calls User.seize_bond() which:
      - Deducts seller_bond from total_earned
      - Zeroes seller_bond
      - Sets bond_seized_at = now
      - Sets is_active = False (bans the account)

    Logs to ActivityLog and sends in-app notification.
    Only platform owners / admins can call this.
    """
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request, pk):
        # ── Permission check ──────────────────────────────────────────────────
        if not getattr(request.user, "is_admin_role", False) and not request.user.is_superuser:
            return Response({"error": "Admin access required."}, status=403)

        # ── Load target ───────────────────────────────────────────────────────
        try:
            target = User.objects.select_for_update().get(pk=pk)
        except User.DoesNotExist:
            return Response({"error": "User not found."}, status=404)

        if target == request.user:
            return Response({"error": "Cannot seize your own bond."}, status=400)

        if float(target.seller_bond or 0) <= 0:
            return Response({"error": "This user has no bond to seize."}, status=400)

        if target.bond_seized_at:
            return Response({"error": "Bond has already been seized."}, status=400)

        # ── Seize the bond ────────────────────────────────────────────────────
        amount_seized = target.seize_bond()

        # ── Activity log ──────────────────────────────────────────────────────
        ActivityLog.objects.create(
            user=request.user,
            action=ActionType.DISPUTE_RESOLVED,
            description=(
                f"Admin {request.user.username} seized ₦{amount_seized:,.2f} bond "
                f"from @{target.username} (confirmed scam). Account banned."
            ),
            ip_address=getattr(request, "client_ip", request.META.get("REMOTE_ADDR", "")),
            object_type="User",
            object_id=str(target.pk),
            metadata={
                "action":       "seize_bond",
                "amount":       str(amount_seized),
                "target":       target.username,
                "admin":        request.user.username,
            },
        )

        # ── In-app notification to target (even though banned) ────────────────
        Notification.objects.create(
            recipient=target,
            notification_type=NotificationType.SYSTEM,
            title="Your account has been suspended",
            message=(
                f"Your seller bond of ₦{amount_seized:,.2f} has been seized "
                f"following a confirmed scam dispute resolution. "
                f"Your account has been suspended. Contact support to appeal."
            ),
        )

        return Response({
            "detail":       "Bond seized and account banned.",
            "amount_seized": str(amount_seized),
            "user":          target.username,
        })
