from django.contrib import admin
from django.utils.html import format_html
from django.db.models import Sum, Count
from django.utils import timezone

from .models import Order, OrderStatus, EscrowVault, PlatformRevenue
from apps.accounts.signals import send_fund_release_email
from apps.notifications.models import Notification, NotificationType


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = [
        "short_id", "buyer_link", "seller_link", "listing_title",
        "amount_display", "status_badge", "created_at"
    ]
    list_filter = ["status", "created_at", "listing__platform"]
    search_fields = ["buyer__email", "buyer__username", "listing__title", "paystack_reference"]
    readonly_fields = [
        "id", "buyer", "listing", "amount", "commission", "seller_payout",
        "paystack_reference", "created_at",
        "funded_at", "provisioned_at", "disputed_at",
    ]
    actions = ["release_to_seller", "refund_to_buyer"]

    def short_id(self, obj):
        return str(obj.id)[:8].upper()
    short_id.short_description = "Order ID"

    def buyer_link(self, obj):
        return format_html('<a href="/admin/accounts/user/{}/change/">{}</a>', obj.buyer.id, obj.buyer.username)
    buyer_link.short_description = "Buyer"

    def seller_link(self, obj):
        return format_html('<a href="/admin/accounts/user/{}/change/">{}</a>', obj.seller.id, obj.seller.username)
    seller_link.short_description = "Seller"

    def listing_title(self, obj):
        return obj.listing.title[:40]

    def amount_display(self, obj):
        return f"₦{obj.amount:,.2f}"
    amount_display.short_description = "Amount"

    def status_badge(self, obj):
        colors = {
            "pending": "#6B7280",
            "funded": "#3B82F6",
            "in_provision": "#F59E0B",
            "disputed": "#EF4444",
            "completed": "#10B981",
            "cancelled": "#9CA3AF",
            "refunded": "#8B5CF6",
        }
        color = colors.get(obj.status, "#6B7280")
        return format_html(
            '<span style="background:{};color:#fff;padding:3px 8px;border-radius:4px;font-size:11px;">{}</span>',
            color, obj.get_status_display()
        )
    status_badge.short_description = "Status"

    @admin.action(description="✅ Release funds to Seller (resolve dispute → complete)")
    def release_to_seller(self, request, queryset):
        for order in queryset.filter(status=OrderStatus.DISPUTED):
            order.admin_notes = f"Resolved by {request.user.username} on {timezone.now().date()}"
            order.transition_to(OrderStatus.COMPLETED, actor=request.user)

            # Record platform revenue
            PlatformRevenue.objects.get_or_create(
                order=order,
                defaults={
                    "commission_amount": order.commission,
                    "platform": order.listing.platform,
                }
            )

            # Notify both parties
            Notification.objects.create(
                recipient=order.buyer,
                notification_type=NotificationType.DISPUTE_RESOLVED,
                title="Dispute Resolved",
                message="The admin has reviewed your dispute and released funds to the seller.",
                action_url=f"/orders/{order.id}",
            )
            Notification.objects.create(
                recipient=order.listing.seller,
                notification_type=NotificationType.DISPUTE_RESOLVED,
                title="Dispute Resolved — Funds Released",
                message="The admin has resolved the dispute in your favor. Payout is being processed.",
                action_url=f"/seller/orders/{order.id}",
            )
            send_fund_release_email(order)

        self.message_user(request, f"Released funds for {queryset.count()} order(s).")

    @admin.action(description="↩️ Refund Buyer (resolve dispute → refunded)")
    def refund_to_buyer(self, request, queryset):
        for order in queryset.filter(status=OrderStatus.DISPUTED):
            order.admin_notes = f"Refunded by {request.user.username} on {timezone.now().date()}"
            order.transition_to(OrderStatus.REFUNDED, actor=request.user)

            Notification.objects.create(
                recipient=order.buyer,
                notification_type=NotificationType.DISPUTE_RESOLVED,
                title="Refund Approved",
                message="The dispute was resolved in your favor. Your refund is being processed.",
                action_url=f"/orders/{order.id}",
            )
        self.message_user(request, f"Initiated refund for {queryset.count()} order(s).")


class PlatformRevenueAdmin(admin.ModelAdmin):
    """Revenue analytics dashboard view."""
    list_display = ["order_id", "platform", "commission_amount", "recorded_at"]
    list_filter = ["platform", "recorded_at"]
    readonly_fields = ["order", "commission_amount", "platform", "recorded_at"]

    def order_id(self, obj):
        return str(obj.order_id)[:8].upper()

    def changelist_view(self, request, extra_context=None):
        extra_context = extra_context or {}
        # Aggregate stats for the dashboard header
        from apps.orders.models import PlatformRevenue
        stats = PlatformRevenue.objects.aggregate(
            total_revenue=Sum("commission_amount"),
            total_transactions=Count("id"),
        )
        extra_context["total_revenue"] = stats["total_revenue"] or 0
        extra_context["total_transactions"] = stats["total_transactions"] or 0
        return super().changelist_view(request, extra_context=extra_context)


admin.site.register(PlatformRevenue, PlatformRevenueAdmin)
admin.site.register(EscrowVault)