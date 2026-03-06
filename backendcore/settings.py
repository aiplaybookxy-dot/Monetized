import environ
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

env = environ.Env()
environ.Env.read_env(BASE_DIR / '.env')

SECRET_KEY = env('SECRET_KEY')
DEBUG = env.bool('DEBUG', default=False)
ALLOWED_HOSTS = env.list('ALLOWED_HOSTS', default=['localhost'])

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',

    # Third party
    'rest_framework',
    'rest_framework_simplejwt',
    'corsheaders',
    'django_filters',

    # Our apps
    'apps.accounts',
    'apps.listings',
    'apps.orders',
    'apps.payments',
    'apps.notifications',
    'apps.activity',
    'apps.moderator',
    "apps.platform_admin",
    'django_celery_beat',
    "apps.disputes",
    'apps.storefront',
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "backendcore.middleware.ActivityMiddleware",           
    "django.middleware.common.CommonMiddleware",
    "apps.platform_admin.middleware.PlatformSettingsMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = 'backendcore.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / 'templates'],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'backendcore.wsgi.application'

DATABASES = {
    'default': env.db('DATABASE_URL', default=f'sqlite:///{BASE_DIR}/db.sqlite3')
}

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'Africa/Lagos'
USE_I18N = True
USE_TZ = True

STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

AUTH_USER_MODEL = 'accounts.User'

# ── JWT ───────────────────────────────────────────────────────────────────────
from datetime import timedelta
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(hours=6),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'ROTATE_REFRESH_TOKENS': True,
}

# ── DRF ──────────────────────────────────────────────────────────────────────
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 20,
}

# ── CORS ─────────────────────────────────────────────────────────────────────

CORS_ALLOWED_ORIGINS = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
]
CORS_ALLOW_CREDENTIALS = True

# FRONTEND_URL = "http://localhost:5173"

# ── Email ────────────────────────────────────────────────────────────────────
EMAIL_BACKEND = env(
    "EMAIL_BACKEND",
    default="django.core.mail.backends.console.EmailBackend"
)

# SMTP settings (only used when EMAIL_BACKEND = smtp)
EMAIL_HOST         = env("EMAIL_HOST",     default="smtp.gmail.com")
EMAIL_PORT         = env.int("EMAIL_PORT", default=587)
EMAIL_USE_TLS      = env.bool("EMAIL_USE_TLS", default=True)
EMAIL_HOST_USER    = env("EMAIL_HOST_USER",    default="")
EMAIL_HOST_PASSWORD= env("EMAIL_HOST_PASSWORD",default="")
DEFAULT_FROM_EMAIL = env("DEFAULT_FROM_EMAIL", default="EscrowMarket <noreply@escrowmarket.com>")
SERVER_EMAIL       = DEFAULT_FROM_EMAIL

FRONTEND_URL = env("FRONTEND_URL", default="http://localhost:5173")


# ── Paystack ──────────────────────────────────────────────────────────────────
PAYSTACK_SECRET_KEY = env('PAYSTACK_SECRET_KEY', default='')
PAYSTACK_PUBLIC_KEY = env('PAYSTACK_PUBLIC_KEY', default='')

# ── Encryption (Escrow Vault) ─────────────────────────────────────────────────
FERNET_KEY = env('FERNET_KEY', default='')


# ── Celery ────────────────────────────────────────────────────────────────────
# Worker: celery -A backendcore worker -l info
# Beat:   celery -A backendcore beat -l info --scheduler django_celery_beat.schedulers:DatabaseScheduler
CELERY_BROKER_URL        = env("CELERY_BROKER_URL", default="redis://localhost:6379/0")
CELERY_RESULT_BACKEND    = env("CELERY_RESULT_BACKEND", default="redis://localhost:6379/1")
CELERY_ACCEPT_CONTENT    = ["json"]
CELERY_TASK_SERIALIZER   = "json"
CELERY_RESULT_SERIALIZER = "json"
CELERY_TIMEZONE          = "Africa/Lagos"
CELERY_TASK_TRACK_STARTED = True

# Cache backend (used by ActivityMiddleware throttle + Django cache)
CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.redis.RedisCache",
        "LOCATION": env("CELERY_BROKER_URL", default="redis://localhost:6379/0"),
    }
}

# ── Escrow Hold Period ────────────────────────────────────────────────────────
# How many days after buyer confirmation before seller balance is credited.
# Set to 0 to disable the hold (instant credit, not recommended for production).
ESCROW_HOLD_DAYS = env.int("ESCROW_HOLD_DAYS", default=3)

# ── Provision Deadline ────────────────────────────────────────────────────────
# How many hours seller has to upload credentials after order is FUNDED.
# After this, moderators are alerted.
PROVISION_DEADLINE_HOURS = env.int("PROVISION_DEADLINE_HOURS", default=24)

# ── Seller Bond (Collateral) ──────────────────────────────────────────────────
# Listings priced at or above BOND_REQUIRED_ABOVE require the seller to have
# SELLER_BOND_AMOUNT reserved in their balance as collateral.
BOND_REQUIRED_ABOVE = env.int("BOND_REQUIRED_ABOVE", default=200_000)   # ₦200,000
SELLER_BOND_AMOUNT  = env.int("SELLER_BOND_AMOUNT",  default=10_000)    # ₦10,000

# ── Credential Heartbeat ──────────────────────────────────────────────────────
# Hours before a VERIFIED credential is marked STALE (triggers re-verification)
HEARTBEAT_INTERVAL_HOURS    = env.int("HEARTBEAT_INTERVAL_HOURS",    default=12)
# How many consecutive heartbeat failures before a listing is auto-suspended
HEARTBEAT_FAILURE_THRESHOLD = env.int("HEARTBEAT_FAILURE_THRESHOLD", default=3)
