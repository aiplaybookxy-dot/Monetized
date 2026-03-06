import json
from django.core.cache import cache
from django.http import JsonResponse

_CACHE_KEY = "platform_settings_middleware"
_CACHE_TTL  = 60


def _get_settings():
    cached = cache.get(_CACHE_KEY)
    if cached is not None:
        return cached
    try:
        from apps.platform_admin.models import PlatformSettings
        cfg = PlatformSettings.get()
        data = {
            "maintenance_mode": cfg.maintenance_mode,
            "disable_payments": cfg.disable_payments,
        }
        cache.set(_CACHE_KEY, data, timeout=_CACHE_TTL)
        return data
    except Exception:
        return {"maintenance_mode": False, "disable_payments": False}


class PlatformSettingsMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        path = request.path
        cfg  = _get_settings()

        if cfg["maintenance_mode"]:
            ALWAYS_ALLOWED = (
                "/admin/",
                "/api/v1/admin/",
                "/api/v1/auth/login/",
                "/api/v1/auth/token/",
                "/static/",
                "/media/",
            )
            if not any(path.startswith(p) for p in ALWAYS_ALLOWED):
                if path.startswith("/api/"):
                    return JsonResponse(
                        {"detail": "Platform is under maintenance. Please check back shortly."},
                        status=503,
                    )

        if cfg["disable_payments"] and request.method == "POST":
            if path.startswith("/api/v1/payments/") or path.startswith("/api/v1/orders/"):
                return JsonResponse(
                    {"detail": "Payments are temporarily disabled. Please try again later."},
                    status=503,
                )

        return self.get_response(request)