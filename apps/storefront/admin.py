from django.contrib import admin
from .models import Store, PageView, ButtonClick


@admin.register(Store)
class StoreAdmin(admin.ModelAdmin):
    list_display  = ["store_name", "slug", "owner", "is_active", "total_views", "total_leads", "created_at"]
    list_filter   = ["is_active", "created_at"]
    search_fields = ["store_name", "slug", "owner__username", "owner__email"]
    readonly_fields = ["id", "created_at", "updated_at", "total_views", "total_leads"]
    prepopulated_fields = {"slug": ("store_name",)}

    def total_views(self, obj):
        return obj.page_views.count()
    total_views.short_description = "Views"

    def total_leads(self, obj):
        return obj.button_clicks.count()
    total_leads.short_description = "Leads"


@admin.register(PageView)
class PageViewAdmin(admin.ModelAdmin):
    list_display  = ["store", "ip_address", "referrer", "timestamp"]
    list_filter   = ["store", "timestamp"]
    readonly_fields = ["id", "store", "ip_address", "user_agent", "referrer", "timestamp"]
    search_fields = ["store__store_name", "ip_address"]

    def has_add_permission(self, request):
        return False  # Views are recorded by the API only

    def has_change_permission(self, request, obj=None):
        return False  # Immutable audit data


@admin.register(ButtonClick)
class ButtonClickAdmin(admin.ModelAdmin):
    list_display  = ["store", "listing_id", "ip_address", "timestamp"]
    list_filter   = ["store", "timestamp"]
    readonly_fields = ["id", "store", "listing_id", "ip_address", "timestamp"]
    search_fields = ["store__store_name", "ip_address"]

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False