from django.urls import path
from .views import SystemLogView, UserActivityLogView, MyActivityLogView

urlpatterns = [
    path("activity/logs/",                        SystemLogView.as_view(),      name="system-log"),
    path("activity/logs/user/<uuid:user_id>/",    UserActivityLogView.as_view(), name="user-activity-log"),
    path("activity/mine/",                        MyActivityLogView.as_view(),   name="my-activity-log"),
]