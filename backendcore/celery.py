"""
backendcore/celery.py

Celery application configuration with django-celery-beat schedule.

TASKS SCHEDULE:
  Every 12 hours  → listings.credential_heartbeat
  Every 4 hours   → listings.moderator_reverify_reminder
  Every 1 hour    → orders.release_held_funds
  Every 6 hours   → orders.check_overdue_provisions

SETUP INSTRUCTIONS:
  1. pip install celery redis django-celery-beat
  2. Add to INSTALLED_APPS: 'django_celery_beat'
  3. Run migration: python manage.py migrate django_celery_beat
  4. Add to .env: CELERY_BROKER_URL=redis://localhost:6379/0
  5. Start worker:  celery -A backendcore worker -l info
  6. Start beat:    celery -A backendcore beat -l info --scheduler django_celery_beat.schedulers:DatabaseScheduler
"""
import os
from celery import Celery
from celery.schedules import crontab

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "backendcore.settings")

app = Celery("backendcore")

# Read config from Django settings (namespace CELERY_)
app.config_from_object("django.conf:settings", namespace="CELERY")

# Auto-discover tasks in all INSTALLED_APPS
app.autodiscover_tasks()


# ── Beat schedule ─────────────────────────────────────────────────────────────
app.conf.beat_schedule = {

    # ── Credential heartbeat — every 12 hours ─────────────────────────────────
    "credential-heartbeat": {
        "task":     "listings.credential_heartbeat",
        "schedule": crontab(minute=0, hour="*/12"),
        "options":  {"expires": 3600},  # don't run if delayed > 1h
    },

    # ── Moderator re-verify reminder — every 4 hours ──────────────────────────
    "moderator-reverify-reminder": {
        "task":     "listings.moderator_reverify_reminder",
        "schedule": crontab(minute=0, hour="*/4"),
    },

    # ── Release held funds — every hour ───────────────────────────────────────
    "release-held-funds": {
        "task":     "orders.release_held_funds",
        "schedule": crontab(minute=5),   # 5 minutes past every hour
        "options":  {"expires": 1800},
    },

    # ── Check overdue provisions — every 6 hours ──────────────────────────────
    "check-overdue-provisions": {
        "task":     "orders.check_overdue_provisions",
        "schedule": crontab(minute=15, hour="*/6"),
    },
}

app.conf.timezone = "Africa/Lagos"


@app.task(bind=True, ignore_result=True)
def debug_task(self):
    print(f"Request: {self.request!r}")