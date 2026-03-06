"""
apps/listings/views.py

CHANGES:
  1. ListingCreateView now uses ListingCreateSerializer (was using ListingSerializer — bug)
  2. ListingCreateView enforces seller bond for listings above BOND_REQUIRED_ABOVE
  3. ListingVaultUploadView  — seller uploads credentials at listing time
  4. ListingVaultRetrieveView — seller/moderator reads vault (with ActivityLog)
  5. ModeratorVerifyVaultView — moderator marks vault as verified
"""
import logging
from decimal import Decimal

from django.conf import settings
from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import AccountListing, ListingStatus, ListingVault, CredentialStatus, CustodyLevel
from .serializers import (
    ListingSerializer,
    ListingCreateSerializer,
    ListingVaultUploadSerializer,
    ListingVaultRetrieveSerializer,
)
from apps.activity.models import ActivityLog, ActionType
from apps.notifications.models import Notification, NotificationType

logger = logging.getLogger(__name__)

BOND_REQUIRED_ABOVE = Decimal(str(getattr(settings, "BOND_REQUIRED_ABOVE", 200_000)))
SELLER_BOND_AMOUNT  = Decimal(str(getattr(settings, "SELLER_BOND_AMOUNT",   10_000)))


# ── Public listing views ───────────────────────────────────────────────────────

class ListingListView(generics.ListAPIView):
    """GET /api/v1/listings/ — public marketplace, no auth required."""
    serializer_class   = ListingSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        qs = AccountListing.objects.filter(
            status=ListingStatus.ACTIVE
        ).select_related("seller").order_by("-created_at")

        search    = self.request.query_params.get("search", "").strip()
        platform  = self.request.query_params.get("platform", "").strip()
        min_price = self.request.query_params.get("min_price", "").strip()
        max_price = self.request.query_params.get("max_price", "").strip()

        if search:
            qs = qs.filter(
                Q(title__icontains=search)
                | Q(description__icontains=search)
                | Q(account_handle__icontains=search)
            )
        if platform:
            qs = qs.filter(platform=platform)
        if min_price:
            qs = qs.filter(price__gte=min_price)
        if max_price:
            qs = qs.filter(price__lte=max_price)
        return qs


class ListingDetailView(generics.RetrieveAPIView):
    """GET /api/v1/listings/<id>/"""
    serializer_class   = ListingSerializer
    permission_classes = [AllowAny]
    queryset           = AccountListing.objects.select_related("seller")

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        AccountListing.objects.filter(pk=instance.pk).update(
            view_count=instance.view_count + 1
        )
        return Response(self.get_serializer(instance).data)


class MyListingsView(generics.ListAPIView):
    """GET /api/v1/listings/mine/ — seller's own listings."""
    serializer_class   = ListingSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return AccountListing.objects.filter(
            seller=self.request.user
        ).order_by("-created_at")


# ── Listing Create (FIXED) ─────────────────────────────────────────────────────

class ListingCreateView(generics.CreateAPIView):
    """
    POST /api/v1/listings/create/

    FIXES:
      - Now uses ListingCreateSerializer (not ListingSerializer).
        ListingSerializer was designed for READ, not write — it was ignoring
        write validations and incorrectly setting status via the serializer.

    BOND ENFORCEMENT:
      - If price >= BOND_REQUIRED_ABOVE (default ₦200,000), the seller must
        have at least SELLER_BOND_AMOUNT (default ₦10,000) in their
        total_earned that can be reserved as collateral.
      - The bond is reserved (not withdrawn) — it stays in their balance but
        cannot be withdrawn while they have active high-value listings.
    """
    serializer_class   = ListingCreateSerializer
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def perform_create(self, serializer):
        price = Decimal(str(serializer.validated_data.get("price", 0)))
        user  = self.request.user

        # ── Bond enforcement ──────────────────────────────────────────────────
        if price >= BOND_REQUIRED_ABOVE:
            if user.total_earned < SELLER_BOND_AMOUNT:
                from rest_framework.exceptions import ValidationError
                raise ValidationError({
                    "bond": (
                        f"Listings priced ₦{BOND_REQUIRED_ABOVE:,.0f} or above require a "
                        f"₦{SELLER_BOND_AMOUNT:,.0f} seller bond in your balance as collateral. "
                        f"Your current balance: ₦{user.total_earned:,.2f}. "
                        f"Complete a sale first or contact support."
                    )
                })
            # Reserve the bond
            user.reserve_bond(SELLER_BOND_AMOUNT)

        listing = serializer.save(
            seller=self.request.user,
            status=ListingStatus.PENDING_REVIEW,
        )

        ActivityLog.log_from_request(
            self.request,
            action=ActionType.LISTING_CREATED,
            description=f"{self.request.user.username} created listing: {listing.title}",
            object_type="Listing",
            object_id=str(listing.id),
        )

        return listing


class ListingUpdateView(generics.UpdateAPIView):
    """PATCH /api/v1/listings/<id>/update/"""
    serializer_class   = ListingSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return AccountListing.objects.filter(seller=self.request.user)

    def perform_update(self, serializer):
        listing = serializer.save()
        ActivityLog.log_from_request(
            self.request,
            action=ActionType.LISTING_UPDATED,
            description=f"{self.request.user.username} updated listing: {listing.title}",
            object_type="Listing",
            object_id=str(listing.id),
        )


class ListingDeleteView(generics.DestroyAPIView):
    """DELETE /api/v1/listings/<id>/delete/"""
    serializer_class   = ListingSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return AccountListing.objects.filter(seller=self.request.user)

    def perform_destroy(self, instance):
        seller = instance.seller
        instance.delete()
        # Release bond if no more high-value listings
        seller.release_bond()


# ── Listing Vault — pre-listing credential storage ────────────────────────────

class ListingVaultUploadView(APIView):
    """
    POST /api/v1/listings/<pk>/vault/

    Seller uploads credentials BEFORE any order exists.
    Automatically sets custody_level = PRE_VAULT and credential_status = UNVERIFIED.
    Moderator must verify separately via ModeratorVerifyVaultView.

    This also enables Level 3 Full Custody: if a moderator verifies + changes
    credentials, they set custody_level = FULL_CUSTODY manually in the admin.
    """
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request, pk):
        try:
            listing = AccountListing.objects.get(pk=pk)
        except AccountListing.DoesNotExist:
            return Response({"error": "Listing not found."}, status=404)

        if listing.seller != request.user:
            return Response({"error": "Only the listing owner can upload credentials."}, status=403)

        if listing.status not in (
            ListingStatus.DRAFT,
            ListingStatus.PENDING_REVIEW,
            ListingStatus.ACTIVE,
        ):
            return Response(
                {"error": f"Cannot upload credentials for a {listing.status} listing."},
                status=400,
            )

        s = ListingVaultUploadSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        data = s.validated_data

        vault, created = ListingVault.objects.get_or_create(listing=listing)
        vault.set_credentials(
            username=data["username"],
            password=data["password"],
            oge=data["oge"],
        )
        vault.transfer_notes    = data.get("transfer_notes", "")
        vault.moderator_verified = False  # reset on every upload
        vault.verified_at        = None
        vault.verified_by        = None
        vault.save(update_fields=["transfer_notes", "moderator_verified", "verified_at", "verified_by"])

        # Upgrade custody level to at least PRE_VAULT
        if listing.custody_level < CustodyLevel.PRE_VAULT:
            listing.custody_level = CustodyLevel.PRE_VAULT

        listing.credential_status = CredentialStatus.UNVERIFIED
        listing.save(update_fields=["custody_level", "credential_status", "updated_at"])

        ActivityLog.log_from_request(
            request,
            action=ActionType.VAULT_UPLOADED,
            description=(
                f"Seller {request.user.username} uploaded pre-listing credentials "
                f"for listing {listing.account_handle} ({str(pk)[:8].upper()})"
            ),
            object_type="Listing",
            object_id=str(pk),
        )

        # Notify moderators to verify
        from django.contrib.auth import get_user_model
        User = get_user_model()
        mods = User.objects.filter(role__in=["moderator", "admin"], is_active=True)
        notifications = [
            Notification(
                recipient=mod,
                notification_type=NotificationType.SYSTEM,
                title="New Listing Vault — Needs Verification",
                message=(
                    f"@{listing.seller.username} uploaded credentials for "
                    f"'{listing.title}'. Please verify before approving the listing."
                ),
                action_url="/moderator/listings",
            )
            for mod in mods
        ]
        Notification.objects.bulk_create(notifications)

        return Response({
            "detail": "Credentials uploaded. Awaiting moderator verification.",
            "listing_id": str(pk),
            "custody_level": listing.custody_level,
            "credential_status": listing.credential_status,
        }, status=201 if created else 200)


class ListingVaultRetrieveView(APIView):
    """
    GET /api/v1/listings/<pk>/vault/

    Allowed: listing seller, moderators, admins.
    Every access is logged to ActivityLog.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        try:
            listing = AccountListing.objects.get(pk=pk)
        except AccountListing.DoesNotExist:
            return Response({"error": "Listing not found."}, status=404)

        if not listing.has_listing_vault:
            return Response(
                {"error": "No credentials have been uploaded for this listing yet."},
                status=404,
            )

        try:
            creds = listing.listing_vault.get_credentials(request.user)
        except PermissionError as e:
            return Response({"error": str(e)}, status=403)

        ActivityLog.log_from_request(
            request,
            action=ActionType.VAULT_UPLOADED,
            description=(
                f"{request.user.username} accessed listing vault credentials "
                f"for {listing.account_handle} ({str(pk)[:8].upper()})"
            ),
            object_type="Listing",
            object_id=str(pk),
        )

        return Response(ListingVaultRetrieveSerializer(creds).data)


class ModeratorVerifyVaultView(APIView):
    """
    POST /api/v1/listings/<pk>/vault/verify/

    Moderator confirms credentials are valid.
    Sets: vault.moderator_verified=True, listing.credential_status=VERIFIED,
          listing.last_verified_at=now
    Optionally sets custody_email (Level 1) and custody_level.
    """
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request, pk):
        if not getattr(request.user, "can_moderate", False):
            return Response({"error": "Moderator access required."}, status=403)

        try:
            listing = AccountListing.objects.select_for_update().get(pk=pk)
        except AccountListing.DoesNotExist:
            return Response({"error": "Listing not found."}, status=404)

        if not listing.has_listing_vault:
            return Response({"error": "No vault exists for this listing."}, status=404)

        vault = listing.listing_vault
        vault.moderator_verified = True
        vault.verified_by        = request.user
        vault.verified_at        = timezone.now()
        vault.save(update_fields=["moderator_verified", "verified_by", "verified_at"])

        listing.mark_verified()

        # Optional: set custody email from request body
        custody_email = request.data.get("custody_email", "").strip()
        if custody_email:
            listing.custody_email = custody_email
            if listing.custody_level < CustodyLevel.OGE_CUSTODY:
                listing.custody_level = CustodyLevel.OGE_CUSTODY
            listing.save(update_fields=["custody_email", "custody_level", "updated_at"])

        # Optional: set full custody level
        custody_level = request.data.get("custody_level")
        if custody_level is not None:
            try:
                listing.custody_level = int(custody_level)
                if listing.custody_level == CustodyLevel.FULL_CUSTODY:
                    listing.credential_status = CredentialStatus.CUSTODY_HELD
                listing.save(update_fields=["custody_level", "credential_status", "updated_at"])
            except (ValueError, TypeError):
                pass

        ActivityLog.log_from_request(
            request,
            action=ActionType.LISTING_APPROVED,
            description=(
                f"Moderator {request.user.username} verified listing vault "
                f"for {listing.account_handle} — custody_level={listing.custody_level}"
            ),
            object_type="Listing",
            object_id=str(pk),
        )

        # Notify seller
        Notification.objects.create(
            recipient=listing.seller,
            notification_type=NotificationType.LISTING_APPROVED,
            title="✅ Account Credentials Verified",
            message=(
                f"Your listing '{listing.title}' credentials have been verified "
                f"by a moderator. Your listing now shows a verification badge."
            ),
            action_url="/sell/listings",
        )

        return Response({
            "detail":            "Vault verified.",
            "listing_id":        str(pk),
            "credential_status": listing.credential_status,
            "custody_level":     listing.custody_level,
            "custody_email":     listing.custody_email,
        })