"""
apps/accounts/models.py

ADDITIONS vs original:
  - seller_bond, bond_reserved_at, bond_seized_at fields on User
  - available_balance property
  - reserve_bond(), release_bond(), seize_bond() methods
"""
import uuid

from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin, BaseUserManager
from django.db import models
from django.utils import timezone


# ── Choices ───────────────────────────────────────────────────────────────────

class UserRole(models.TextChoices):
    ADMIN     = "admin",     "Admin"
    MODERATOR = "moderator", "Moderator"
    USER      = "user",      "User"


# ── Manager (inline — no separate managers.py) ───────────────────────────────

class UserManager(BaseUserManager):
    def create_user(self, email, username, password=None, **extra_fields):
        if not email:
            raise ValueError("Email is required")
        email = self.normalize_email(email)
        user  = self.model(email=email, username=username, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, username, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("role", UserRole.ADMIN)
        return self.create_user(email, username, password, **extra_fields)


# ── User model ────────────────────────────────────────────────────────────────

class User(AbstractBaseUser, PermissionsMixin):
    id        = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email     = models.EmailField(unique=True, db_index=True)
    username  = models.CharField(max_length=50, unique=True, db_index=True)
    full_name = models.CharField(max_length=150, blank=True)
    avatar    = models.ImageField(upload_to="avatars/", blank=True, null=True)
    bio       = models.TextField(max_length=500, blank=True)

    role = models.CharField(
        max_length=20, choices=UserRole.choices, default=UserRole.USER, db_index=True,
    )

    total_earned = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    total_spent  = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    # ── Seller Bond ───────────────────────────────────────────────────────────
    seller_bond = models.DecimalField(
        max_digits=12, decimal_places=2, default=0,
        help_text="Reserved collateral slice of total_earned.",
    )
    bond_reserved_at = models.DateTimeField(null=True, blank=True)
    bond_seized_at   = models.DateTimeField(null=True, blank=True)

    seller_rating       = models.FloatField(default=0.0)
    completed_sales     = models.PositiveIntegerField(default=0)
    completed_purchases = models.PositiveIntegerField(default=0)

    last_login_ip     = models.GenericIPAddressField(null=True, blank=True)
    last_active_at    = models.DateTimeField(null=True, blank=True)
    is_email_verified = models.BooleanField(default=False)
    is_active         = models.BooleanField(default=True)
    is_staff          = models.BooleanField(default=False)

    date_joined = models.DateTimeField(default=timezone.now)
    updated_at  = models.DateTimeField(auto_now=True)

    USERNAME_FIELD  = "email"
    REQUIRED_FIELDS = ["username"]

    objects = UserManager()

    class Meta:
        db_table     = "users"
        verbose_name = "User"

    def __str__(self):
        return f"{self.username} <{self.email}> [{self.role}]"

    @property
    def display_name(self):
        return self.full_name or self.username

    @property
    def is_moderator(self):
        return self.role == UserRole.MODERATOR

    @property
    def is_admin_role(self):
        return self.role == UserRole.ADMIN

    @property
    def can_moderate(self):
        return self.role in (UserRole.MODERATOR, UserRole.ADMIN)

    @property
    def available_balance(self):
        from decimal import Decimal
        return max(self.total_earned - self.seller_bond, Decimal("0"))

    def reserve_bond(self, amount=None):
        from django.conf import settings as s
        from decimal import Decimal
        target = Decimal(str(amount or getattr(s, "SELLER_BOND_AMOUNT", 10_000)))
        if self.seller_bond < target:
            self.seller_bond      = target
            self.bond_reserved_at = timezone.now()
            self.save(update_fields=["seller_bond", "bond_reserved_at", "updated_at"])

    def release_bond(self):
        from django.conf import settings as s
        from decimal import Decimal
        from apps.listings.models import AccountListing, ListingStatus
        threshold = Decimal(str(getattr(s, "BOND_REQUIRED_ABOVE", 200_000)))
        has_high_value = AccountListing.objects.filter(
            seller=self,
            status__in=[ListingStatus.ACTIVE, ListingStatus.PENDING_REVIEW, ListingStatus.UNDER_REVIEW],
            price__gte=threshold,
        ).exists()
        if not has_high_value:
            self.seller_bond = Decimal("0")
            self.save(update_fields=["seller_bond", "updated_at"])

    def seize_bond(self):
        from decimal import Decimal
        amount = self.seller_bond
        self.total_earned   = max(self.total_earned - amount, Decimal("0"))
        self.seller_bond    = Decimal("0")
        self.bond_seized_at = timezone.now()
        self.is_active      = False
        self.save(update_fields=["total_earned", "seller_bond", "bond_seized_at", "is_active", "updated_at"])
        return amount


class LoginActivity(models.Model):
    id         = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user       = models.ForeignKey(User, on_delete=models.CASCADE, related_name="login_activities")
    ip_address = models.GenericIPAddressField()
    user_agent = models.TextField(blank=True)
    was_successful = models.BooleanField(default=True)
    timestamp  = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = "login_activities"
        ordering = ["-timestamp"]

    def __str__(self):
        return f"{self.user.username} [{'OK' if self.was_successful else 'FAIL'}] @ {self.ip_address}"