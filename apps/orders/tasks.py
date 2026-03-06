"""
apps/orders/tasks.py

Celery tasks for the escrow holding period system.

TASKS:
  release_held_funds   — runs hourly, credits seller balances for orders
                         where funds_release_at <= now and seller_credited = False

WHY a holding period after COMPLETED?
───────────────────────────────────────
Even after the buyer clicks "Confirm", a bad seller might have:
  - Prepared a chargebacks via their bank
  - Secretly used the OGE to recover the account 2 days later

The 3-day hold (configurable via ESCROW_HOLD_DAYS) means:
  - Funds sit in the platform account for 3 more days
  - If buyer opens a dispute within that window → admin can seize
  - After 3 days with no dispute → Celery credits the seller, logs it
  - Seller sees a "Pending Release" balance in their dashboard

This does NOT change the order status (it stays COMPLETED).
It only controls when seller_payout hits their total_earned.
"""
import logging
from celery import shared_task
from django.db import transaction
from django.db.models import F
from django.utils import timezone

logger = logging.getLogger(__name__)


@shared_task(name="orders.release_held_funds", bind=True, max_retries=3)
def release_held_funds(self):
    """
    Runs every hour via Celery Beat.

    Finds all COMPLETED orders where:
      - funds_release_at <= now  (hold period has expired)
      - seller_credited = False  (not yet paid out)

    For each: credits seller_payout to total_earned, sets seller_credited=True,
    logs to ActivityLog, and sends an in-app notification.
    """
    from apps.orders.models import Order, OrderStatus
    from apps.notifications.models import Notification, NotificationType
    from apps.activity.models import ActivityLog, ActionType

    now = timezone.now()

    due_orders = Order.objects.filter(
        status=OrderStatus.COMPLETED,
        seller_credited=False,
        funds_release_at__lte=now,
        funds_release_at__isnull=False,
    ).select_related("listing__seller", "listing", "buyer")

    released_count = 0
    total_released = 0

    for order in due_orders:
        try:
            with transaction.atomic():
                # Lock the row to prevent double-credits
                locked = (
                    Order.objects
                    .select_for_update()
                    .get(pk=order.pk, seller_credited=False)
                )

                seller = locked.listing.seller

                # Credit the seller
                type(seller).objects.filter(pk=seller.pk).update(
                    total_earned=F("total_earned") + locked.seller_payout,
                    completed_sales=F("completed_sales") + 1,
                )

                locked.seller_credited = True
                locked.save(update_fields=["seller_credited", "updated_at"])

                # In-app notification
                Notification.objects.create(
                    recipient=seller,
                    notification_type=NotificationType.WITHDRAWAL_APPROVED,
                    title="💰 Funds Released to Your Balance",
                    message=(
                        f"₦{locked.seller_payout:,.2f} from the sale of "
                        f"'{locked.listing.title}' has been credited to your balance. "
                        f"You can now request a withdrawal."
                    ),
                    action_url="/profile",
                    metadata={
                        "order_id":     str(locked.id),
                        "amount":       str(locked.seller_payout),
                        "listing_title": locked.listing.title,
                    },
                )

                # Immutable audit log (system action, no request)
                ActivityLog.objects.create(
                    user=seller,
                    action=ActionType.PAYMENT_VERIFIED,
                    description=(
                        f"Escrow hold released: ₦{locked.seller_payout:,.2f} credited "
                        f"to {seller.username} for order {str(locked.id)[:8].upper()}"
                    ),
                    ip_address="0.0.0.0",  # system task — no request IP
                    object_type="Order",
                    object_id=str(locked.id),
                )

                released_count += 1
                total_released += float(locked.seller_payout)

                logger.info(
                    "Released ₦%s to %s for order %s",
                    locked.seller_payout, seller.username, locked.id,
                )

        except Order.DoesNotExist:
            # Another worker already processed this order (race condition handled)
            logger.info("Order %s already credited by another worker", order.pk)
        except Exception as e:
            logger.error("Failed to release funds for order %s: %s", order.pk, e)

    logger.info(
        "release_held_funds: released %d orders, total ₦%s",
        released_count, total_released,
    )
    return {"released": released_count, "total_naira": total_released}


@shared_task(name="orders.check_overdue_provisions")
def check_overdue_provisions():
    """
    Runs every 6 hours.

    Finds FUNDED orders where the seller has NOT uploaded credentials
    within PROVISION_DEADLINE_HOURS (default 24h) and notifies both
    the seller (reminder) and creates a moderator alert.

    Does NOT auto-cancel — that requires human review.
    """
    from apps.orders.models import Order, OrderStatus
    from apps.notifications.models import Notification, NotificationType
    from django.conf import settings
    from django.contrib.auth import get_user_model

    User = get_user_model()
    deadline_hours = getattr(settings, "PROVISION_DEADLINE_HOURS", 24)
    cutoff = timezone.now() - timezone.timedelta(hours=deadline_hours)

    overdue = Order.objects.filter(
        status=OrderStatus.FUNDED,
        funded_at__lte=cutoff,
    ).select_related("listing__seller", "listing", "buyer")

    for order in overdue:
        seller = order.listing.seller

        # Notify seller
        Notification.objects.get_or_create(
            recipient=seller,
            notification_type=NotificationType.SYSTEM,
            action_url=f"/orders/{order.id}",
            defaults={
                "title": "⏰ Upload Credentials — Buyer is Waiting",
                "message": (
                    f"You have not uploaded credentials for order "
                    f"'{order.listing.title}' (#{str(order.id)[:8].upper()}). "
                    f"Please upload immediately or the buyer may open a dispute."
                ),
            },
        )

        # Alert moderators
        mods = User.objects.filter(role__in=["moderator", "admin"], is_active=True)
        for mod in mods:
            Notification.objects.get_or_create(
                recipient=mod,
                notification_type=NotificationType.SYSTEM,
                action_url=f"/moderator/disputes",
                defaults={
                    "title": f"⚠️ Overdue Provision — {seller.username}",
                    "message": (
                        f"Order #{str(order.id)[:8].upper()} has been FUNDED for over "
                        f"{deadline_hours}h with no credentials uploaded. "
                        f"Seller: @{seller.username}"
                    ),
                },
            )

    logger.info("check_overdue_provisions: found %d overdue orders", overdue.count())
    return {"overdue": overdue.count()}