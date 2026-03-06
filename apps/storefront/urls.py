from django.urls import path
from .views import PublicStorefrontView, RecordClickView, StoreDetailView, StoreAnalyticsView

urlpatterns = [
    # Public
    path("m/<slug:slug>/",        PublicStorefrontView.as_view(), name="public-storefront"),
    path("m/<slug:slug>/click/",  RecordClickView.as_view(),      name="store-click"),

    # Seller (auth required)
    path("store/",                StoreDetailView.as_view(),       name="store-detail"),
    path("store/analytics/",      StoreAnalyticsView.as_view(),    name="store-analytics"),
]