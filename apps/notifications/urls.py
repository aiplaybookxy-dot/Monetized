from django.urls import path
from .views import (
    NotificationListView,
    NotificationMarkReadView,
    MarkAllReadView,
    UnreadCountView,
)

urlpatterns = [
    path("notifications/",                   NotificationListView.as_view(),    name="notification-list"),
    path("notifications/unread-count/",      UnreadCountView.as_view(),          name="notification-count"),
    path("notifications/mark-all-read/",     MarkAllReadView.as_view(),          name="notification-mark-all"),
    path("notifications/<uuid:pk>/read/",    NotificationMarkReadView.as_view(), name="notification-read"),
]