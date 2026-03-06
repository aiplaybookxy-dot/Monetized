"""
apps/storefront/models.py

Store        — one per seller, unique slug, Facebook Pixel support
PageView     — every storefront visit recorded (for real-time analytics)
ButtonClick  — every "Buy Now" click on the store (lead tracking)
"""
import uuid
from django.db import models
from django.conf import settings
from django.utils.text import slugify


class Store(models.Model):
    id          = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    owner       = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="store"
    )
    store_name  = models.CharField(max_length=100)
    slug        = models.SlugField(max_length=80, unique=True)
    description = models.TextField(blank=True, max_length=1000)
    logo        = models.ImageField(upload_to="store_logos/", blank=True, null=True)
    pixel_id    = models.CharField(
        max_length=100, blank=True,
        help_text="Facebook Pixel ID for conversion tracking"
    )
    is_active   = models.BooleanField(default=True)
    created_at  = models.DateTimeField(auto_now_add=True)
    updated_at  = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "stores"

    def __str__(self):
        return f"{self.store_name} (@{self.owner.username})"

    def save(self, *args, **kwargs):
        if not self.slug:
            base = slugify(self.store_name or self.owner.username)
            slug = base
            n = 1
            while Store.objects.filter(slug=slug).exclude(pk=self.pk).exists():
                slug = f"{base}-{n}"
                n += 1
            self.slug = slug
        super().save(*args, **kwargs)


class PageView(models.Model):
    """Recorded every time someone visits a store URL."""
    id         = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    store      = models.ForeignKey(Store, on_delete=models.CASCADE, related_name="page_views")
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True)
    referrer   = models.URLField(blank=True, max_length=500)
    timestamp  = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table  = "store_page_views"
        ordering  = ["-timestamp"]
        indexes   = [models.Index(fields=["store", "timestamp"])]


class ButtonClick(models.Model):
    """Recorded every time a visitor clicks 'Buy Now' on a store listing."""
    id         = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    store      = models.ForeignKey(Store, on_delete=models.CASCADE, related_name="button_clicks")
    listing_id = models.UUIDField(null=True, blank=True)   # which listing was clicked
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    timestamp  = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "store_button_clicks"
        ordering = ["-timestamp"]
        indexes  = [models.Index(fields=["store", "timestamp"])]