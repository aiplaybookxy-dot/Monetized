import hashlib
import hmac
import requests
from django.conf import settings

PAYSTACK_BASE_URL = "https://api.paystack.co"


def _headers():
    return {
        "Authorization": f"Bearer {settings.PAYSTACK_SECRET_KEY}",
        "Content-Type": "application/json",
    }


def initialize_transaction(email: str, amount_naira: float, reference: str, metadata: dict = None) -> dict:
    """
    Initialize a Paystack transaction.
    Amount is in Naira — Paystack API expects kobo (multiply by 100).
    """
    payload = {
        "email": email,
        "amount": int(amount_naira * 100),  # Convert to kobo
        "reference": reference,
        "callback_url": f"{settings.FRONTEND_URL}/payment/verify",
        "metadata": metadata or {},
    }
    response = requests.post(f"{PAYSTACK_BASE_URL}/transaction/initialize", json=payload, headers=_headers())
    response.raise_for_status()
    return response.json()


def verify_transaction(reference: str) -> dict:
    """Verify a transaction by reference."""
    response = requests.get(
        f"{PAYSTACK_BASE_URL}/transaction/verify/{reference}",
        headers=_headers()
    )
    response.raise_for_status()
    return response.json()


def create_transfer_recipient(name: str, account_number: str, bank_code: str) -> dict:
    """Create a transfer recipient for seller payout."""
    payload = {
        "type": "nuban",
        "name": name,
        "account_number": account_number,
        "bank_code": bank_code,
        "currency": "NGN",
    }
    response = requests.post(f"{PAYSTACK_BASE_URL}/transferrecipient", json=payload, headers=_headers())
    response.raise_for_status()
    return response.json()


def initiate_transfer(amount_naira: float, recipient_code: str, reason: str, reference: str) -> dict:
    """Transfer funds to seller after order completion."""
    payload = {
        "source": "balance",
        "amount": int(amount_naira * 100),
        "recipient": recipient_code,
        "reason": reason,
        "reference": reference,
    }
    response = requests.post(f"{PAYSTACK_BASE_URL}/transfer", json=payload, headers=_headers())
    response.raise_for_status()
    return response.json()


def verify_webhook_signature(payload: bytes, signature: str) -> bool:
    """
    Verify that the webhook request genuinely came from Paystack.
    Paystack signs the raw body with the webhook secret using HMAC-SHA512.
    """
    expected = hmac.new(
        settings.PAYSTACK_WEBHOOK_SECRET.encode("utf-8"),
        payload,
        digestmod=hashlib.sha512
    ).hexdigest()
    return hmac.compare_digest(expected, signature)