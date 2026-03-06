"""
backendcore/urls.py
"""
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

from apps.payments.views import PaymentInitiateView, PaymentVerifyView

urlpatterns = [
    path("admin/", admin.site.urls),

    # ── Core apps ─────────────────────────────────────────────────────────────
    path("api/v1/", include("apps.accounts.urls")),
    path("api/v1/", include("apps.listings.urls")),
    path("api/v1/", include("apps.orders.urls")),
    path("api/v1/", include("apps.payments.urls")),
    path("api/v1/", include("apps.notifications.urls")),
    path("api/v1/", include("apps.activity.urls")),
    path("api/v1/", include("apps.moderator.urls")),
    path("api/v1/", include("apps.storefront.urls")),

    # ── Platform admin (revenue, settings, withdrawals, users) ───────────────
    path("api/v1/", include("apps.platform_admin.urls")),

    # ── Payment initiate + verify (class-based, registered here directly) ────
    path("api/v1/payments/initiate/", PaymentInitiateView.as_view(), name="payment-initiate"),
    path("api/v1/payments/verify/",   PaymentVerifyView.as_view(),   name="payment-verify"),

] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)