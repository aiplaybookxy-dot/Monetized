"""
apps/accounts/views.py

All admin/users/ routes have been moved to apps/platform_admin/.
This file only handles auth, profile, and public endpoints.
"""
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.contrib.auth.tokens import default_token_generator
from django.utils.http import urlsafe_base64_decode
from django.utils.encoding import force_str
from django.contrib.auth import get_user_model
from django.core.mail import send_mail
from django.template.loader import render_to_string
from django.conf import settings

from rest_framework import generics, status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework import serializers as drf_serializers

from .models import LoginActivity
from .serializers import (
    RegisterSerializer,
    CustomTokenObtainPairSerializer,
    UserPublicSerializer,
    UserUpdateSerializer,
    ChangePasswordSerializer,
    LoginActivitySerializer,
)

User = get_user_model()


class RegisterView(generics.CreateAPIView):
    """POST /api/v1/auth/register/"""
    queryset         = User.objects.all()
    serializer_class = RegisterSerializer
    permission_classes = [AllowAny]

    def create(self, request, *args, **kwargs):
        # Enforce platform setting — owner can disable signups from admin panel
        try:
            from apps.platform_admin.models import PlatformSettings
            cfg = PlatformSettings.get()
            if cfg.disable_new_signups:
                return Response(
                    {"detail": "New registrations are currently disabled. Please try again later."},
                    status=status.HTTP_503_SERVICE_UNAVAILABLE,
                )
        except Exception:
            pass  # If platform_admin app not yet migrated, allow registration

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(
            {"detail": "Account created successfully. Please log in."},
            status=status.HTTP_201_CREATED,
        )


class CustomTokenObtainPairView(TokenObtainPairView):
    """POST /api/v1/auth/login/"""
    serializer_class = CustomTokenObtainPairSerializer


class MeView(APIView):
    """GET / PATCH /api/v1/auth/me/"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(UserPublicSerializer(request.user).data)

    def patch(self, request):
        serializer = UserUpdateSerializer(request.user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(UserPublicSerializer(request.user).data)


class ChangePasswordView(APIView):
    """POST /api/v1/auth/change-password/"""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        send_mail(
            subject="Your EscrowMarket password was changed",
            message=render_to_string("emails/password_change.txt", {"user": user}),
            html_message=render_to_string("emails/password_change.html", {"user": user}),
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[user.email],
            fail_silently=True,
        )
        return Response({"detail": "Password updated successfully."})


class LoginHistoryView(generics.ListAPIView):
    """GET /api/v1/auth/login-history/"""
    serializer_class   = LoginActivitySerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return LoginActivity.objects.filter(user=self.request.user).order_by("-timestamp")[:20]


class PublicProfileView(generics.RetrieveAPIView):
    """GET /api/v1/users/<username>/"""
    serializer_class   = UserPublicSerializer
    permission_classes = [AllowAny]
    lookup_field       = "username"
    queryset           = User.objects.filter(is_active=True)
    
    


class PasswordResetConfirmView(APIView):
    """
    POST /api/v1/auth/password-reset-confirm/

    Used by:
      1. Guest checkout — buyer sets password via emailed link
      2. Normal password reset — any user who clicked "Forgot password?"

    Body:
      uid           — base64-encoded user PK (from email link)
      token         — Django password-reset token (from email link)
      new_password  — desired new password
      new_password2 — confirm password

    Django's default_token_generator validates:
      - token was generated for this specific user
      - token has not been used before
      - token is not expired (default: 3 days)
    """
    permission_classes = [AllowAny]

    def post(self, request):
        uid           = request.data.get("uid", "").strip()
        token         = request.data.get("token", "").strip()
        new_password  = request.data.get("new_password", "")
        new_password2 = request.data.get("new_password2", "")

        # ── Basic presence check ──────────────────────────────────────────────
        if not all([uid, token, new_password, new_password2]):
            return Response(
                {"error": "uid, token, new_password, and new_password2 are all required."},
                status=400,
            )

        # ── Passwords match ───────────────────────────────────────────────────
        if new_password != new_password2:
            return Response({"new_password2": ["Passwords do not match."]}, status=400)

        # ── Decode uid → user ─────────────────────────────────────────────────
        try:
            user_pk = force_str(urlsafe_base64_decode(uid))
            user    = User.objects.get(pk=user_pk)
        except (TypeError, ValueError, OverflowError, User.DoesNotExist):
            return Response(
                {"error": "Link is invalid or has expired. Please request a new one."},
                status=400,
            )

        # ── Validate token ────────────────────────────────────────────────────
        if not default_token_generator.check_token(user, token):
            return Response(
                {"error": "Link is invalid or has already been used. Please request a new one."},
                status=400,
            )

        # ── Django password validators ────────────────────────────────────────
        try:
            validate_password(new_password, user)
        except ValidationError as e:
            return Response({"new_password": list(e.messages)}, status=400)

        # ── Set new password ──────────────────────────────────────────────────
        user.set_password(new_password)
        user.is_email_verified = True   # guest email is now verified
        user.save(update_fields=["password", "is_email_verified"])

        return Response({"detail": "Password set successfully. You can now log in."})