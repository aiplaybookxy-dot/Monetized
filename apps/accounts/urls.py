"""
apps/accounts/urls.py

Admin user management has moved to apps/platform_admin/urls.py.
This file only handles auth, profile, and public routes.
"""
from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from .views import (
    RegisterView,
    CustomTokenObtainPairView,
    MeView,
    ChangePasswordView,
    LoginHistoryView,
    PublicProfileView,
)

urlpatterns = [
    # Auth
    path("auth/register/",        RegisterView.as_view(),              name="auth-register"),
    path("auth/login/",           CustomTokenObtainPairView.as_view(), name="auth-login"),
    path("auth/token/refresh/",   TokenRefreshView.as_view(),          name="token-refresh"),

    # Profile
    path("auth/me/",              MeView.as_view(),                    name="auth-me"),
    path("auth/change-password/", ChangePasswordView.as_view(),        name="change-password"),
    path("auth/login-history/",   LoginHistoryView.as_view(),          name="login-history"),

    # Public
    path("users/<str:username>/", PublicProfileView.as_view(),         name="public-profile"),
]