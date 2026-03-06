"""
apps/accounts/validators.py

Reserved slug blacklist — prevents namespace hijacking.

Security rationale:
───────────────────
A seller choosing the slug "admin" would receive the URL /m/admin.
This creates two distinct attack vectors:

1. TRUST HIJACKING: Buyers conditioned to trust "yoursite.com/admin"
   might be manipulated into paying a fraudulent seller with that URL.

2. ROUTE SHADOWING: Depending on Nginx path matching order, /m/admin
   could shadow or conflict with Django's /admin/ panel in edge cases.

3. PHISHING SURFACE: "support", "help", "verify" as store slugs give
   fraudsters a platform-branded URL for social engineering attacks.

WHY enforce at both model AND serializer level:
  Serializer validation catches it at the API boundary (fast fail, good UX).
  Model validation is the last line of defense — catches direct ORM writes,
  Django admin saves, management commands, and test fixtures.
  Never rely on a single layer for security-critical validation.

Maintenance:
  Add to RESERVED_SLUGS as new platform routes are introduced.
  The set uses frozenset for O(1) lookup — irrelevant at small scale
  but establishes the correct pattern for future list growth.
"""

import re
from django.core.exceptions import ValidationError

# ── Reserved words — cannot be used as store slugs ───────────────────────────

RESERVED_SLUGS: frozenset[str] = frozenset({
    # Platform routes
    "admin", "api", "static", "media", "moderator",
    "login", "logout", "register", "signup", "signin",
    "dashboard", "settings", "profile", "account",
    "orders", "disputes", "payments", "verify",
    "checkout", "cart", "buy", "purchase",

    # Trust/authority terms
    "support", "help", "helpdesk", "contact",
    "official", "platform", "escrow", "team",
    "staff", "mod", "operator", "owner",
    "security", "trust", "safe", "verified",
    "legit", "authentic", "certified",

    # Brand/technical terms
    "www", "mail", "smtp", "ftp", "ssh",
    "blog", "news", "press", "app", "dev",
    "staging", "test", "demo", "prod", "beta",
    "null", "undefined", "root", "system",
    "webhook", "callback", "health", "ping",
    "robots", "sitemap", "favicon",
})


def validate_store_slug(value: str) -> None:
    """
    Validates a store slug against:
    1. Reserved namespace blacklist
    2. Character set rules (lowercase, numbers, hyphens only)
    3. Length constraints
    4. No leading/trailing/consecutive hyphens (aesthetic + SEO)

    Raises ValidationError with a descriptive message for each failure.
    Called from:
    - StoreSerializer.validate_store_slug()
    - Store.clean() model-level validation
    """
    if not value:
        raise ValidationError("Store slug cannot be empty.")

    # Normalise to lowercase before checking — "Admin" == "admin"
    slug = value.lower().strip()

    # Character set validation
    if not re.match(r'^[a-z0-9][a-z0-9-]*[a-z0-9]$', slug) and len(slug) > 1:
        raise ValidationError(
            "Slug may only contain lowercase letters, numbers, and hyphens. "
            "It must start and end with a letter or number."
        )

    # Minimum length — single characters are meaningless as store URLs
    if len(slug) < 3:
        raise ValidationError("Store slug must be at least 3 characters.")

    # Maximum length — keeps URLs clean and within DB index limits
    if len(slug) > 60:
        raise ValidationError("Store slug cannot exceed 60 characters.")

    # No consecutive hyphens — bad UX and can look like internal paths
    if "--" in slug:
        raise ValidationError("Store slug cannot contain consecutive hyphens.")

    # Reserved namespace check
    if slug in RESERVED_SLUGS:
        raise ValidationError(
            f"'{value}' is a reserved name and cannot be used as a store slug. "
            "Choose a unique name that represents your brand."
        )


def validate_pixel_id(value: str) -> None:
    """
    Validates a Facebook Pixel ID — must be numeric only.

    Security rationale:
    A non-numeric pixel ID that reaches document.head injection
    creates an XSS vector. This validator is the backend enforcement
    of the same rule applied in the serializer and React component.
    Defence in depth: all three layers must agree.

    Payloads like `1234; alert(1)` or `"><script>` are rejected here
    before they can ever reach the Fernet store or the storefront API.
    """
    if not value:
        return  # Empty is allowed — seller may not have a pixel

    cleaned = re.sub(r'\D', '', value)
    if cleaned != value:
        raise ValidationError(
            "Facebook Pixel ID must contain only numeric digits. "
            f"Remove non-numeric characters from: '{value}'"
        )
    if len(cleaned) < 10 or len(cleaned) > 20:
        raise ValidationError(
            "Facebook Pixel ID must be between 10 and 20 digits. "
            "Find yours in Facebook Events Manager → Pixels → Settings."
        )