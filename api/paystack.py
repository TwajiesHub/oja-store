"""Paystack: the two API calls we make, and the webhook Paystack calls us on.

Each API call is one small function so tests can replace it. Nothing here marks an order
paid by itself: that only happens in fulfilment.mark_paid().
"""
import hashlib
import hmac
import json
import logging

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlmodel import Session

from api import config
from api.db import get_session
from api.fulfilment import mark_paid
from api.models import PaymentEvent

logger = logging.getLogger("oja.paystack")

PAYSTACK_API = "https://api.paystack.co"
REQUEST_TIMEOUT_SECONDS = 10

router = APIRouter(prefix="/api/paystack")


class PaystackError(Exception):
    """Paystack could not be reached or refused the request."""


def _headers() -> dict[str, str]:
    return {"Authorization": f"Bearer {config.PAYSTACK_SECRET_KEY}"}


def initialize_transaction(*, email: str, amount_kobo: int, reference: str, callback_url: str,
                           metadata: dict) -> str:
    """Starts a payment and returns the Paystack page to send the shopper to."""
    try:
        response = httpx.post(
            f"{PAYSTACK_API}/transaction/initialize",
            headers=_headers(),
            json={"email": email, "amount": amount_kobo, "currency": "NGN", "reference": reference,
                  "callback_url": callback_url, "metadata": metadata},
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
        body = response.json()
    except (httpx.HTTPError, ValueError) as error:
        logger.error("Paystack initialize failed for %s: %s", reference, type(error).__name__)
        raise PaystackError("Could not reach Paystack") from error
    if response.status_code != 200 or not body.get("status"):
        logger.error("Paystack refused initialize for %s: HTTP %s", reference, response.status_code)
        raise PaystackError("Paystack refused the request")
    return body["data"]["authorization_url"]


def verify_transaction(reference: str) -> dict:
    """What Paystack says about a payment: {status, amount, currency}."""
    try:
        response = httpx.get(
            f"{PAYSTACK_API}/transaction/verify/{reference}",
            headers=_headers(),
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
        body = response.json()
    except (httpx.HTTPError, ValueError) as error:
        logger.error("Paystack verify failed for %s: %s", reference, type(error).__name__)
        raise PaystackError("Could not reach Paystack") from error
    if response.status_code != 200 or not body.get("status"):
        raise PaystackError("Paystack could not verify the payment")
    data = body["data"]
    return {"status": data.get("status"), "amount": data.get("amount"), "currency": data.get("currency")}


def signature_is_valid(body: bytes, signature: str) -> bool:
    """Paystack signs the raw body with our secret key (HMAC-SHA512)."""
    expected = hmac.new(config.PAYSTACK_SECRET_KEY.encode(), body, hashlib.sha512).hexdigest()
    return hmac.compare_digest(expected, signature)


@router.post("/webhook")
async def webhook(request: Request, session: Session = Depends(get_session)) -> dict:
    # An empty key would make anyone's signature valid, so refuse to run without one.
    if not config.PAYSTACK_SECRET_KEY:
        raise HTTPException(status_code=503, detail="Payments are not configured")

    body = await request.body()
    if not signature_is_valid(body, request.headers.get("x-paystack-signature", "")):
        raise HTTPException(status_code=401, detail="Invalid signature")

    try:
        payload = json.loads(body)
    except ValueError:
        return {"ok": True}
    event = str(payload.get("event", ""))
    data = payload.get("data") or {}
    reference = str(data.get("reference", ""))

    session.add(PaymentEvent(reference=reference, event=event, raw=payload))
    session.commit()

    if event == "charge.success":
        mark_paid(session, reference, data.get("amount"), data.get("currency"))
    # Always answer 200 quickly so Paystack does not keep retrying events we ignore.
    return {"ok": True}
