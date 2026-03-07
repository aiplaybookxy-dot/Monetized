"""
apps/platform_admin/urls.py

All routes are under /api/v1/admin/ prefix (set in backendcore/urls.py).
Every view is protected by IsPlatformOwner permission.
"""
from django.urls import path
from .views import (
    AdminStatsView,
    PlatformSettingsView,
    AdminUserListView,
    AdminUserUpdateView,
    WithdrawalListView,
    WithdrawalReviewView,
    RevenueView,
    PublicPlatformConfigView,
    SeizeBondView
)

urlpatterns = [
    # ── Public (no auth) — commission rate for live fee preview ───────────────
    path("platform/config/",          PublicPlatformConfigView.as_view(), name="platform-config"),

    # ── Dashboard stats ───────────────────────────────────────────────────────
    path("admin/stats/",              AdminStatsView.as_view(),        name="admin-stats"),

    # ── Revenue ledger (what Revenue.jsx calls) ───────────────────────────────
    path("admin/revenue/",            RevenueView.as_view(),           name="admin-revenue"),

    # ── Platform settings ─────────────────────────────────────────────────────
    path("admin/settings/",           PlatformSettingsView.as_view(),  name="admin-settings"),

    # ── Users ─────────────────────────────────────────────────────────────────
    path("admin/users/",              AdminUserListView.as_view(),     name="admin-users"),
    path("admin/users/<uuid:pk>/",    AdminUserUpdateView.as_view(),   name="admin-user-update"),

    # ── Withdrawals ───────────────────────────────────────────────────────────
    path("admin/withdrawals/",                      WithdrawalListView.as_view(),   name="admin-withdrawals"),
    path("admin/withdrawals/<uuid:pk>/review/",     WithdrawalReviewView.as_view(), name="admin-withdrawal-review"),

    # Shorthand aliases that Withdrawals.jsx uses (approve / reject)
    path("admin/withdrawals/<uuid:pk>/approve/",    WithdrawalReviewView.as_view(), name="admin-withdrawal-approve"),
    path("admin/withdrawals/<uuid:pk>/reject/",     WithdrawalReviewView.as_view(), name="admin-withdrawal-reject"),
    
    path("admin/users/<uuid:pk>/seize-bond/", SeizeBondView.as_view(), name="admin-seize-bond"),
]