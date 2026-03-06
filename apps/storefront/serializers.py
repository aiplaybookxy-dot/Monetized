from rest_framework import serializers
from .models import Store
from apps.listings.serializers import ListingSerializer
from apps.listings.models import AccountListing, ListingStatus


class StoreSerializer(serializers.ModelSerializer):
    owner_username = serializers.CharField(source="owner.username", read_only=True)
    total_views    = serializers.SerializerMethodField()
    total_leads    = serializers.SerializerMethodField()

    class Meta:
        model  = Store
        fields = [
            "id", "owner_username", "store_name", "slug", "description",
            "logo", "pixel_id", "is_active",
            "total_views", "total_leads", "created_at",
        ]
        read_only_fields = ["id", "owner_username", "total_views", "total_leads", "created_at"]

    def get_total_views(self, obj):
        return obj.page_views.count()

    def get_total_leads(self, obj):
        return obj.button_clicks.count()


class StoreCreateUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Store
        fields = ["store_name", "slug", "description", "logo", "pixel_id", "is_active"]

    def validate_slug(self, value):
        import re
        if not re.match(r'^[a-z0-9-]+$', value):
            raise serializers.ValidationError(
                "Slug may only contain lowercase letters, numbers, and hyphens."
            )
        qs = Store.objects.filter(slug=value)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError("This store URL is already taken.")
        return value


class PublicStorefrontSerializer(serializers.ModelSerializer):
    owner_username = serializers.CharField(source="owner.username", read_only=True)
    listings       = serializers.SerializerMethodField()
    sold_listings  = serializers.SerializerMethodField()

    class Meta:
        model  = Store
        fields = [
            "id", "store_name", "slug", "description", "logo",
            "pixel_id", "owner_username", "listings", "sold_listings",
        ]

    def get_listings(self, obj):
        qs = AccountListing.objects.filter(
            seller=obj.owner,
            status=ListingStatus.ACTIVE,
        ).order_by("-created_at")[:20]
        return ListingSerializer(qs, many=True, context=self.context).data

    def get_sold_listings(self, obj):
        qs = AccountListing.objects.filter(
            seller=obj.owner,
            status=ListingStatus.SOLD,
        ).order_by("-updated_at")[:10]
        return ListingSerializer(qs, many=True, context=self.context).data


class StoreAnalyticsSerializer(serializers.Serializer):
    total_views      = serializers.IntegerField()
    total_leads      = serializers.IntegerField()
    views_today      = serializers.IntegerField()
    leads_today      = serializers.IntegerField()
    views_this_week  = serializers.IntegerField()
    leads_this_week  = serializers.IntegerField()
    daily_breakdown  = serializers.ListField()   # [{date, views, leads}]