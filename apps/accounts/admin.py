from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import User, LoginActivity


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display  = ['username', 'email', 'role', 'is_active', 'is_staff', 'date_joined']
    list_filter   = ['role', 'is_active', 'is_staff', 'is_email_verified']
    search_fields = ['username', 'email', 'full_name']
    ordering      = ['-date_joined']

    fieldsets = (
        (None, {'fields': ('email', 'username', 'password')}),
        ('Personal Info', {'fields': ('full_name', 'bio', 'avatar')}),
        ('Role & Access', {'fields': ('role', 'is_active', 'is_staff', 'is_superuser', 'is_email_verified')}),
        ('Financials', {'fields': ('total_earned', 'total_spent', 'seller_rating', 'completed_sales', 'completed_purchases')}),
        ('Security', {'fields': ('last_login_ip', 'last_active_at')}),
        ('Permissions', {'fields': ('groups', 'user_permissions')}),
        ('Dates', {'fields': ('date_joined', 'last_login')}),
    )

    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('email', 'username', 'role', 'password1', 'password2'),
        }),
    )

    # Role is the key field — Admin can promote users to Moderator here
    readonly_fields = ['date_joined', 'last_login', 'last_active_at', 'last_login_ip']


@admin.register(LoginActivity)
class LoginActivityAdmin(admin.ModelAdmin):
    list_display  = ['user', 'ip_address', 'was_successful', 'timestamp']
    list_filter   = ['was_successful']
    search_fields = ['user__username', 'ip_address']
    readonly_fields = ['user', 'ip_address', 'user_agent', 'was_successful', 'timestamp']
    ordering = ['-timestamp']

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False