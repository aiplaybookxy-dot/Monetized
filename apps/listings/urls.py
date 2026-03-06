"""
apps/listings/urls.py
"""
from django.urls import path
from .views import (
    ListingListView,
    ListingDetailView,
    MyListingsView,
    ListingCreateView,
    ListingUpdateView,
    ListingDeleteView,
    ListingVaultUploadView,
    ListingVaultRetrieveView,
    ModeratorVerifyVaultView,
)

urlpatterns = [
    # ── Public ────────────────────────────────────────────────────────────────
    path("listings/",                  ListingListView.as_view(),   name="listing-list"),
    path("listings/<uuid:pk>/",        ListingDetailView.as_view(), name="listing-detail"),

    # ── Seller ────────────────────────────────────────────────────────────────
    path("listings/mine/",             MyListingsView.as_view(),    name="my-listings"),
    path("listings/create/",           ListingCreateView.as_view(), name="listing-create"),
    path("listings/<uuid:pk>/update/", ListingUpdateView.as_view(), name="listing-update"),
    path("listings/<uuid:pk>/delete/", ListingDeleteView.as_view(), name="listing-delete"),

    # ── Pre-listing Vault (Level 2 custody) ───────────────────────────────────
    # GET  → retrieve credentials (seller / mod only)
    # POST → upload / replace credentials
    path("listings/<uuid:pk>/vault/",          ListingVaultUploadView.as_view(),   name="listing-vault-upload"),
    path("listings/<uuid:pk>/vault/retrieve/", ListingVaultRetrieveView.as_view(), name="listing-vault-retrieve"),

    # ── Moderator verification ────────────────────────────────────────────────
    path("listings/<uuid:pk>/vault/verify/",   ModeratorVerifyVaultView.as_view(), name="listing-vault-verify"),
]