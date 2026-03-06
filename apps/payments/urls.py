from django.urls import path
from .views import (
    PaymentInitiateView,
    PaymentVerifyView,
    paystack_webhook,
)

urlpatterns = [
    path("payments/initiate/", PaymentInitiateView.as_view(), name="payment-initiate"),
    path("payments/verify/",   PaymentVerifyView.as_view(),   name="payment-verify"),
    path("payments/webhook/",  paystack_webhook,              name="paystack-webhook"),
]