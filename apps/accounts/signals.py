"""
Django signals for the accounts app.
Handles post-save automation for User model events.

WHY signals for welcome email but explicit calls for other emails:
Welcome email is a true side-effect of user creation — it always fires,
regardless of how the user was created (registration, silent signup,
admin panel). Signals are appropriate here.

Fund release email is a business workflow email — it must be called
explicitly from the moderator view after a deliberate resolution action.
Using a signal for this would make the trigger implicit and harder to trace.
"""
import logging
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.core.mail import send_mail
from django.template.loader import render_to_string
from django.conf import settings

logger = logging.getLogger(__name__)


@receiver(post_save, sender=settings.AUTH_USER_MODEL)
def on_user_created(sender, instance, created, **kwargs):
    """Send welcome email on first user creation."""
    if not created:
        return
    try:
        send_mail(
            subject="Welcome to EscrowMarket!",
            message=render_to_string("emails/welcome.txt", {"user": instance}),
            html_message=render_to_string("emails/welcome.html", {"user": instance}),
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[instance.email],
            fail_silently=True,
        )
    except Exception as e:
        logger.warning("Failed to send welcome email to %s: %s", instance.email, e)


def send_fund_release_email(order) -> None:
    """
    Explicit call from moderator/orders views when funds are released to seller.

    WHY not a signal:
    This is a deliberate business action email. Signals would fire on any
    COMPLETED status change — including automated completions. Explicit
    call from the resolution view makes the trigger clear and auditable.

    Called from:
    - apps/disputes/views.py → DisputeResolveView (RELEASED verdict)
    - apps/orders/views.py → OrderCompleteView (buyer confirms)
    """
    seller = order.listing.seller
    try:
        send_mail(
            subject=f"Funds Released — ₦{order.seller_payout:,.2f} for '{order.listing.title}'",
            message=render_to_string("emails/fund_released.txt", {
                "user":   seller,
                "order":  order,
                "payout": order.seller_payout,
            }),
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[seller.email],
            fail_silently=True,
        )
    except Exception as e:
        logger.warning("Failed to send fund release email to %s: %s", seller.email, e)


def send_login_notification(user, ip_address: str, user_agent: str = "") -> None:
    """
    Send login alert email when user logs in.
    Called explicitly from LoginView — not a signal to avoid duplicate sends
    on session refresh or token rotation.
    """
    try:
        send_mail(
            subject="New Login to Your EscrowMarket Account",
            message=render_to_string("emails/login_notification.txt", {
                "user": user, "ip": ip_address,
            }),
            html_message=render_to_string("emails/login_notification.html", {
                "user": user, "ip": ip_address,
            }),
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[user.email],
            fail_silently=True,
        )
    except Exception as e:
        logger.warning("Failed to send login notification to %s: %s", user.email, e)