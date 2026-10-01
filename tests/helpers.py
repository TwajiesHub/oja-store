"""Small helpers shared by the checkout and payment tests."""
import hashlib
import hmac
import json

from sqlmodel import select

from api.models import Variant

DETAILS = {
    "full_name": "Amina Bello",
    "phone": "0803 000 0000",
    "address": "12 Herbert Macaulay Way",
    "area": "Yaba",
    "state": "Lagos",
    "delivery_speed": "standard",
}


def variant_id(session, sku: str) -> int:
    return session.exec(select(Variant).where(Variant.sku == sku)).one().id


def put_bag(client, auth, items: list[tuple[int, int]], user: str = "user-a", email: str = "amina@example.com"):
    body = {"items": [{"variant_id": vid, "quantity": qty} for vid, qty in items]}
    response = client.put("/api/bag", json=body, headers=auth(user, email))
    assert response.status_code == 200
    return response


def checkout(client, auth, user: str = "user-a", email: str = "amina@example.com", **overrides):
    return client.post("/api/checkout", json={**DETAILS, **overrides}, headers=auth(user, email))


def webhook_body(reference: str, amount: int, currency: str = "NGN", event: str = "charge.success") -> bytes:
    return json.dumps({"event": event, "data": {"reference": reference, "amount": amount, "currency": currency}}).encode()


def sign(body: bytes, key: str = "sk_test_unit_test_key") -> str:
    return hmac.new(key.encode(), body, hashlib.sha512).hexdigest()


def post_webhook(client, body: bytes, signature: str | None = None):
    headers = {"x-paystack-signature": sign(body) if signature is None else signature}
    return client.post("/api/paystack/webhook", content=body, headers=headers)
