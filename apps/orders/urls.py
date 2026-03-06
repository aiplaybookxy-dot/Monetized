from django.urls import path
from .views import (
    BuyerOrderListView,
    SellerOrderListView,
    OrderDetailView,
    VaultUploadView,
    VaultRetrieveView,
    OrderCompleteView,
    OrderDisputeView,
    OrderCancelView,
)

urlpatterns = [
    # Buyer
    path("orders/", BuyerOrderListView.as_view(), name="order-list"),
    path("orders/<uuid:pk>/", OrderDetailView.as_view(), name="order-detail"),
    path("orders/<uuid:pk>/credentials/", VaultRetrieveView.as_view(), name="order-credentials"),
    path("orders/<uuid:pk>/complete/", OrderCompleteView.as_view(), name="order-complete"),
    path("orders/<uuid:pk>/dispute/", OrderDisputeView.as_view(), name="order-dispute"),
    path("orders/<uuid:pk>/cancel/", OrderCancelView.as_view(), name="order-cancel"),

    # Seller
    path("orders/selling/", SellerOrderListView.as_view(), name="order-selling"),
    path("orders/<uuid:pk>/provision/", VaultUploadView.as_view(), name="order-provision"),
]