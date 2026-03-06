"""
backendcore/__init__.py

Load the Celery app when Django starts so @shared_task decorators
in all apps resolve to the correct Celery instance.
"""
from .celery import app as celery_app

__all__ = ("celery_app",)