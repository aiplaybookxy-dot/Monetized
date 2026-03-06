from django.urls import path
from .views import (
    DisputeCreateView,
    DisputeDetailView,
    MyDisputesView,
    DisputeMessageCreateView,
    EvidenceUploadView,
    DisputeResolveView,
    ActiveDisputeListView,
    DisputeVaultView,
)

urlpatterns = [
    # ── User-facing ───────────────────────────────────────────────────────────
    path("disputes/",                                DisputeCreateView.as_view(),    name="dispute-create"),
    path("disputes/mine/",                           MyDisputesView.as_view(),       name="my-disputes"),
    path("disputes/<uuid:dispute_id>/",              DisputeDetailView.as_view(),    name="dispute-detail"),
    path("disputes/<uuid:dispute_id>/messages/",     DisputeMessageCreateView.as_view(), name="dispute-message"),
    path("disputes/<uuid:dispute_id>/evidence/",     EvidenceUploadView.as_view(),   name="dispute-evidence"),

    # ── Moderator-facing ──────────────────────────────────────────────────────
    path("mod/disputes/",                            ActiveDisputeListView.as_view(), name="mod-disputes"),
    path("disputes/<uuid:dispute_id>/resolve/",      DisputeResolveView.as_view(),   name="dispute-resolve"),
    path("disputes/<uuid:dispute_id>/vault/",        DisputeVaultView.as_view(),     name="dispute-vault"),
]