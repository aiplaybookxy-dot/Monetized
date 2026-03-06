from django.apps import AppConfig


class AccountsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.accounts"
    verbose_name = "Accounts"

    def ready(self):
        # Wire up all Django signals (login logging, welcome email, etc.)
        import apps.accounts.signals  # noqa: F401