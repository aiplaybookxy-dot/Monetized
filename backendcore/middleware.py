"""
core/middleware.py

ActivityMiddleware
──────────────────
Middleware that runs on every request to:

  1. Enrich `request.client_ip` — parsed once, reused by all views.
  2. Update User.last_active_at — throttled to max once per 60s per user
     to avoid write-storms. Uses update() not save() to skip signals.
  3. Log every request to /admin/ or /mod/ routes into ActivityLog —
     this is the "paper trail" requirement for privileged route access.
     Logging runs POST-response so it never blocks the request path.

Performance notes:
  - Throttle uses Django's cache layer (Redis / LocMem fallback).
  - Route logging is gated behind path prefix checks before hitting the DB.
  - Non-/admin/ non-/mod/ requests exit _log_privileged_route() immediately.
  - Unauthenticated requests to privileged routes are still logged (access denied).
"""
import logging

from django.utils import timezone
from django.core.cache import cache

logger = logging.getLogger(__name__)

_THROTTLE_SECONDS = 60          # last_active_at max write frequency
_PRIVILEGED_PREFIXES = (        # Route prefixes that trigger ActivityLog write
    "/admin/",
    "/api/v1/mod/",
)


class ActivityMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # ── 1. Enrich request with real client IP (views read this) ──────────
        request.client_ip = self._get_ip(request)

        # ── 2. Process the normal Django/DRF stack ───────────────────────────
        response = self.get_response(request)

        # ── 3. Post-response work (never delays the response to the client) ──
        if hasattr(request, "user") and request.user.is_authenticated:
            self._update_last_active(request.user)

        # ── 4. Log every request hitting privileged routes ───────────────────
        self._log_privileged_route(request, response)

        return response

    # ── Helpers ───────────────────────────────────────────────────────────────

    @staticmethod
    def _get_ip(request) -> str:
        xff = request.META.get("HTTP_X_FORWARDED_FOR")
        if xff:
            return xff.split(",")[0].strip()
        return request.META.get("REMOTE_ADDR", "0.0.0.0")

    @staticmethod
    def _update_last_active(user) -> None:
        """
        Throttled last_active_at write — cache prevents a DB write on
        every API poll from an active user.
        """
        try:
            from django.contrib.auth import get_user_model
            User = get_user_model()
            cache_key = f"last_active:{user.pk}"
            if cache.get(cache_key):
                return
            User.objects.filter(pk=user.pk).update(last_active_at=timezone.now())
            cache.set(cache_key, True, timeout=_THROTTLE_SECONDS)
        except Exception:
            pass  # Never let this crash a request

    @staticmethod
    def _log_privileged_route(request, response) -> None:
        """
        Write an ActivityLog entry for every request to /admin/ or /mod/.
        This satisfies the paper-trail requirement: every privileged route
        access — whether allowed or denied — is permanently recorded.

        Skips:
        - Non-privileged paths (fast-exit, no DB hit)
        - Static asset requests (css/js/img inside /admin/)
        - Safe methods (GET) to /admin/ static resources
        """
        path = request.path

        # Fast-exit: not a privileged route
        if not any(path.startswith(prefix) for prefix in _PRIVILEGED_PREFIXES):
            return

        # Skip Django admin static files — they'd drown the log
        if "/admin/" in path and any(
            path.startswith(f"/admin/{seg}/")
            for seg in ("jsi18n", "static", "css", "js", "img", "fonts")
        ):
            return

        try:
            from apps.activity.models import ActivityLog, ActionType

            user = getattr(request, "user", None)
            authenticated_user = user if (user and user.is_authenticated) else None

            # Derive action type from route prefix
            if path.startswith("/admin/"):
                action = ActionType.ADMIN_ROUTE_ACCESS
            else:
                action = ActionType.MOD_ROUTE_ACCESS

            method = request.method
            status_code = response.status_code
            denied = status_code in (401, 403)

            ActivityLog.log(
                action=action,
                user=authenticated_user,
                description=(
                    f"{'DENIED ' if denied else ''}{method} {path} "
                    f"→ HTTP {status_code}"
                    + (f" (anonymous)" if not authenticated_user else "")
                ),
                ip_address=request.client_ip,
                user_agent=request.META.get("HTTP_USER_AGENT", "")[:512],
                object_type="Route",
                object_id=path[:100],
                metadata={
                    "method": method,
                    "path": path,
                    "status_code": status_code,
                    "denied": denied,
                    "user_id": str(authenticated_user.id) if authenticated_user else None,
                },
            )
        except Exception as exc:  # Never let logging crash the request
            logger.exception("ActivityMiddleware failed to write log entry: %s", exc)