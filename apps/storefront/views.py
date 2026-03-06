"""
apps/storefront/views.py

Public endpoints (no auth):
  GET  /api/v1/m/<slug>/          → PublicStorefrontView
  POST /api/v1/m/<slug>/click/    → RecordClickView

Seller endpoints (auth required):
  GET  /api/v1/store/             → StoreDetailView (get own store or 404)
  POST /api/v1/store/             → StoreDetailView (create store)
  PATCH /api/v1/store/            → StoreDetailView (update store)
  GET  /api/v1/store/analytics/   → StoreAnalyticsView
"""
from django.utils import timezone
from django.db.models import Count
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Store, PageView, ButtonClick
from .serializers import (
    PublicStorefrontSerializer,
    StoreSerializer,
    StoreCreateUpdateSerializer,
    StoreAnalyticsSerializer,
)


class PublicStorefrontView(APIView):
    """
    GET  /api/v1/m/<slug>/  → render public store
    POST /api/v1/m/<slug>/  → record a page view (called by frontend on mount)
    """
    permission_classes = [AllowAny]

    def _get_store(self, slug):
        try:
            return Store.objects.select_related("owner").get(slug=slug, is_active=True)
        except Store.DoesNotExist:
            return None

    def get(self, request, slug):
        store = self._get_store(slug)
        if not store:
            return Response(
                {"detail": "Store not found or has been deactivated."},
                status=status.HTTP_404_NOT_FOUND,
            )
        # Record page view (fire-and-forget)
        PageView.objects.create(
            store=store,
            ip_address=request.META.get("HTTP_X_FORWARDED_FOR", "").split(",")[0].strip()
                       or request.META.get("REMOTE_ADDR"),
            user_agent=request.META.get("HTTP_USER_AGENT", "")[:512],
            referrer=request.META.get("HTTP_REFERER", "")[:500],
        )
        serializer = PublicStorefrontSerializer(store, context={"request": request})
        return Response(serializer.data)


class RecordClickView(APIView):
    """POST /api/v1/m/<slug>/click/  — records a Buy Now button click (lead)."""
    permission_classes = [AllowAny]

    def post(self, request, slug):
        try:
            store = Store.objects.get(slug=slug, is_active=True)
        except Store.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)

        ButtonClick.objects.create(
            store=store,
            listing_id=request.data.get("listing_id"),
            ip_address=request.META.get("HTTP_X_FORWARDED_FOR", "").split(",")[0].strip()
                       or request.META.get("REMOTE_ADDR"),
        )
        return Response({"detail": "Click recorded."})


class StoreDetailView(APIView):
    """
    GET   → return seller's store (or 404 if none created yet)
    POST  → create store
    PATCH → update store
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            store = Store.objects.get(owner=request.user)
            return Response(StoreSerializer(store, context={"request": request}).data)
        except Store.DoesNotExist:
            return Response({"detail": "No store yet."}, status=status.HTTP_404_NOT_FOUND)

    def post(self, request):
        if Store.objects.filter(owner=request.user).exists():
            return Response(
                {"detail": "You already have a store. Use PATCH to update it."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        serializer = StoreCreateUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        store = serializer.save(owner=request.user)
        return Response(
            StoreSerializer(store, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )

    def patch(self, request):
        try:
            store = Store.objects.get(owner=request.user)
        except Store.DoesNotExist:
            return Response({"detail": "No store found."}, status=status.HTTP_404_NOT_FOUND)
        serializer = StoreCreateUpdateSerializer(store, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        store = serializer.save()
        return Response(StoreSerializer(store, context={"request": request}).data)


class StoreAnalyticsView(APIView):
    """GET /api/v1/store/analytics/ — seller's own store stats."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            store = Store.objects.get(owner=request.user)
        except Store.DoesNotExist:
            return Response({"detail": "No store found."}, status=status.HTTP_404_NOT_FOUND)

        now   = timezone.now()
        today = now.date()
        week_start = today - timezone.timedelta(days=6)

        views_qs  = store.page_views.all()
        clicks_qs = store.button_clicks.all()

        # Daily breakdown — last 7 days
        daily = []
        for i in range(6, -1, -1):
            day = today - timezone.timedelta(days=i)
            daily.append({
                "date":  day.strftime("%b %d"),
                "views": views_qs.filter(timestamp__date=day).count(),
                "leads": clicks_qs.filter(timestamp__date=day).count(),
            })

        data = {
            "total_views":     views_qs.count(),
            "total_leads":     clicks_qs.count(),
            "views_today":     views_qs.filter(timestamp__date=today).count(),
            "leads_today":     clicks_qs.filter(timestamp__date=today).count(),
            "views_this_week": views_qs.filter(timestamp__date__gte=week_start).count(),
            "leads_this_week": clicks_qs.filter(timestamp__date__gte=week_start).count(),
            "daily_breakdown": daily,
        }
        return Response(data)