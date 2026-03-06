"""
apps/listings/tasks.py

Celery tasks for the account custody / anti-fraud system.

TASKS:
  credential_heartbeat    — runs every 12h, checks all ACTIVE listings
                            with a ListingVault, marks STALE / FAILED / SUSPENDED
  auto_suspend_failed     — safety net: suspends any ACTIVE listings that have
                            been FAILED for > 1h without being auto-suspended
  notify_stale_sellers    — emails sellers whose credentials are STALE

WHY no actual social-media login check here?
──────────────────────────────────────────────
Instagram, TikTok, and YouTube actively block automated logins and will
lock the account after a few attempts. The heartbeat instead:
  1. Checks if the ListingVault was updated more recently than
     last_verified_at (seller changed credentials without telling us → STALE).
  2. Checks if the listing has been manually verified by a moderator
     (moderator_verified = True → VERIFIED, else STALE after interval).
  3. Suspends listings that have 3+ consecutive failures.

For platforms that offer public APIs (YouTube Data API), a real follower-count
check is possible and should be added in a future sprint.
"""
import logging

from celery import shared_task
from django.conf import settings
from django.core.mail import send_mail
from django.utils import timezone
from datetime import timedelta

logger = logging.getLogger(__name__)

# How many hours before a VERIFIED credential is considered STALE
HEARTBEAT_INTERVAL_HOURS = getattr(settings, "HEARTBEAT_INTERVAL_HOURS", 12)
# How many consecutive failures before auto-suspend
FAILURE_THRESHOLD = getattr(settings, "HEARTBEAT_FAILURE_THRESHOLD", 3)
# Minimum price for bond requirement
BOND_REQUIRED_ABOVE = getattr(settings, "BOND_REQUIRED_ABOVE", 200_000)


@shared_task(name="listings.credential_heartbeat", bind=True, max_retries=3)
def credential_heartbeat(self):
    """
    Runs every 12 hours via Celery Beat.

    Checks every ACTIVE listing that has a ListingVault:
      - If ListingVault.updated_at > AccountListing.last_verified_at
        → credentials may have changed → mark STALE, notify seller
      - If last_verified_at is None and custody_level >= PRE_VAULT
        → mark STALE (never verified)
      - If credential_failure_count >= FAILURE_THRESHOLD
        → mark FAILED + SUSPENDED

    Listings without a ListingVault are left as UNVERIFIED (no action).
    """
    from apps.listings.models import (
        AccountListing, ListingStatus, CredentialStatus, CustodyLevel
    )
    from apps.notifications.models import Notification, NotificationType

    now = timezone.now()
    stale_cutoff = now - timedelta(hours=HEARTBEAT_INTERVAL_HOURS)

    # Only check ACTIVE listings that have a vault (Level 2+)
    listings = (
        AccountListing.objects
        .filter(
            status=ListingStatus.ACTIVE,
            custody_level__gte=CustodyLevel.PRE_VAULT,
        )
        .select_related("listing_vault", "seller")
        .prefetch_related()
    )

    checked = stale_count = failed_count = 0

    for listing in listings:
        checked += 1

        # ── No vault attached (shouldn't happen at Level 2+, defensive check) ──
        if not listing.has_listing_vault:
            continue

        vault = listing.listing_vault

        # ── Check: vault was modified after last verification ─────────────────
        # This catches sellers who quietly updated their password in the vault
        # after verification (possibly because they sold the account elsewhere).
        credentials_changed = (
            listing.last_verified_at is None
            or vault.updated_at > listing.last_verified_at
        )

        if credentials_changed and vault.moderator_verified:
            # Moderator verified it, then credentials changed → STALE
            listing.mark_stale()
            stale_count += 1
            _notify_seller_stale(listing)
            logger.warning(
                "Listing %s (%s) marked STALE — vault updated after last verification",
                listing.id, listing.account_handle,
            )
            continue

        # ── Check: never verified + vault exists ──────────────────────────────
        if listing.last_verified_at is None:
            listing.mark_stale()
            stale_count += 1
            continue

        # ── Check: verified but interval has passed ───────────────────────────
        if listing.last_verified_at < stale_cutoff:
            listing.mark_stale()
            stale_count += 1
            _notify_seller_stale(listing)
            logger.info(
                "Listing %s (%s) marked STALE — verification interval elapsed",
                listing.id, listing.account_handle,
            )
            continue

        # ── Check: too many failures → auto-suspend ───────────────────────────
        if listing.credential_failure_count >= FAILURE_THRESHOLD:
            if listing.credential_status != CredentialStatus.FAILED:
                listing.mark_failed()
                failed_count += 1
                _notify_seller_suspended(listing)
                logger.error(
                    "Listing %s (%s) AUTO-SUSPENDED — %d consecutive failures",
                    listing.id, listing.account_handle, listing.credential_failure_count,
                )

    logger.info(
        "credential_heartbeat complete: checked=%d stale=%d failed=%d",
        checked, stale_count, failed_count,
    )
    return {"checked": checked, "stale": stale_count, "failed": failed_count}


@shared_task(name="listings.moderator_reverify_reminder")
def moderator_reverify_reminder():
    """
    Runs every 4 hours. Finds STALE listings and creates a moderator
    notification so they can manually verify and re-set to VERIFIED.
    """
    from apps.listings.models import AccountListing, ListingStatus, CredentialStatus
    from apps.notifications.models import Notification, NotificationType
    from django.contrib.auth import get_user_model

    User = get_user_model()

    stale_listings = AccountListing.objects.filter(
        status=ListingStatus.ACTIVE,
        credential_status=CredentialStatus.STALE,
    ).select_related("seller")

    if not stale_listings.exists():
        return {"stale": 0}

    # Notify all moderators and admins
    privileged = User.objects.filter(role__in=["moderator", "admin"], is_active=True)
    notifications = []
    for mod in privileged:
        notifications.append(Notification(
            recipient=mod,
            notification_type=NotificationType.SYSTEM,
            title=f"{stale_listings.count()} Listing(s) Need Re-verification",
            message=(
                f"{stale_listings.count()} active listing(s) have stale credentials "
                f"and require moderator re-verification. Check the listing queue."
            ),
            action_url="/moderator/listings",
        ))
    Notification.objects.bulk_create(notifications, ignore_conflicts=True)

    return {"stale": stale_listings.count()}


# ── Private helpers ───────────────────────────────────────────────────────────

def _notify_seller_stale(listing):
    from apps.notifications.models import Notification, NotificationType
    Notification.objects.create(
        recipient=listing.seller,
        notification_type=NotificationType.SYSTEM,
        title="⚠️ Credentials Need Re-verification",
        message=(
            f"Your listing '{listing.title}' requires credential re-verification. "
            f"Please ensure your account credentials are still correct and contact "
            f"support if you need help. Your listing is still active but may be "
            f"suspended if not verified within 24 hours."
        ),
        action_url=f"/sell/listings",
    )


def _notify_seller_suspended(listing):
    from apps.notifications.models import Notification, NotificationType
    Notification.objects.create(
        recipient=listing.seller,
        notification_type=NotificationType.SYSTEM,
        title="🚫 Listing Suspended — Credential Failure",
        message=(
            f"Your listing '{listing.title}' has been automatically suspended "
            f"because credential verification failed {listing.credential_failure_count} "
            f"consecutive times. This may indicate the account password was changed "
            f"outside the platform. Contact support to resolve."
        ),
        action_url="/sell/listings",
    )
    try:
        send_mail(
            subject=f"[{getattr(settings, 'PLATFORM_NAME', 'EscrowMarket')}] Listing Suspended",
            message=(
                f"Hi {listing.seller.display_name},\n\n"
                f"Your listing '{listing.title}' (@{listing.account_handle}) has been "
                f"suspended due to repeated credential verification failures.\n\n"
                f"If you changed the account password, please update it in your listing vault.\n\n"
                f"Contact support: {getattr(settings, 'SUPPORT_EMAIL', 'support@escrowmarket.com')}"
            ),
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[listing.seller.email],
            fail_silently=True,
        )
    except Exception as e:
        logger.error("Failed to send suspension email for listing %s: %s", listing.id, e)