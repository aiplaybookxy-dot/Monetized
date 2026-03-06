from django.urls import path
from .views import (
    DisputedOrderListView,
    DisputeResolveView,
    PendingListingsView,
    ListingApproveView,
    UserAuditListView,
    UserAuditDetailView,
    ModeratorStatsView,
)

urlpatterns = [
    # Dashboard stats
    path("mod/stats/",                              ModeratorStatsView.as_view(),     name="mod-stats"),

    # Disputes
    path("mod/disputes/",                           DisputedOrderListView.as_view(),  name="mod-disputes"),
    path("mod/disputes/<uuid:order_id>/resolve/",   DisputeResolveView.as_view(),     name="mod-dispute-resolve"),

    # Listings
    path("mod/listings/pending/",                   PendingListingsView.as_view(),    name="mod-listings-pending"),
    path("mod/listings/<uuid:listing_id>/review/",  ListingApproveView.as_view(),     name="mod-listing-review"),

    # User audits
    path("mod/users/",                              UserAuditListView.as_view(),      name="mod-users"),
    path("mod/users/<uuid:id>/",                    UserAuditDetailView.as_view(),    name="mod-user-detail"),
]