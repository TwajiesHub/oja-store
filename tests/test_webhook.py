import pytest
from sqlmodel import select

from api.models import BagItem, Order, PaymentEvent, Variant
from scripts.init_db import seed
from tests.helpers import checkout, post_webhook, put_bag, sign, variant_id, webhook_body


@pytest.fixture
def seeded(session):
    seed(session)
    return session


@pytest.fixture
def pending_order(client, seeded, auth, fake_paystack):
    put_bag(client, auth, [(variant_id(seeded, "OSHODI-HOODIE-M"), 2)])
    checkout(client, auth)
    seeded.expire_all()
    return seeded.exec(select(Order)).one()


def refreshed(session, order):
    session.expire_all()
    return session.get(Order, order.id)


def hoodie_stock(session) -> int:
    session.expire_all()
    return session.exec(select(Variant).where(Variant.sku == "OSHODI-HOODIE-M")).one().stock


def test_webhook_rejects_bad_signature(client, seeded, pending_order):
    body = webhook_body(pending_order.paystack_reference, pending_order.total_kobo)
    stock_before = hoodie_stock(seeded)

    response = post_webhook(client, body, signature="0" * 128)

    assert response.status_code == 401
    assert refreshed(seeded, pending_order).status == "pending_payment"
    assert hoodie_stock(seeded) == stock_before
    assert seeded.exec(select(PaymentEvent)).all() == []


def test_webhook_rejects_a_missing_signature(client, seeded, pending_order):
    body = webhook_body(pending_order.paystack_reference, pending_order.total_kobo)

    response = client.post("/api/paystack/webhook", content=body)

    assert response.status_code == 401
    assert refreshed(seeded, pending_order).status == "pending_payment"


def test_webhook_rejects_a_signature_made_with_another_key(client, seeded, pending_order):
    body = webhook_body(pending_order.paystack_reference, pending_order.total_kobo)

    response = post_webhook(client, body, signature=sign(body, key="sk_test_someone_elses_key"))

    assert response.status_code == 401
    assert refreshed(seeded, pending_order).status == "pending_payment"


def test_webhook_rejects_a_signature_for_a_different_body(client, seeded, pending_order):
    real = webhook_body(pending_order.paystack_reference, pending_order.total_kobo)
    tampered = webhook_body(pending_order.paystack_reference, 100)

    assert post_webhook(client, tampered, signature=sign(real)).status_code == 401


def test_webhook_marks_the_order_paid_and_records_the_event(client, seeded, pending_order):
    stock_before = hoodie_stock(seeded)
    body = webhook_body(pending_order.paystack_reference, pending_order.total_kobo)

    response = post_webhook(client, body)

    assert response.status_code == 200
    assert refreshed(seeded, pending_order).status == "paid"
    assert hoodie_stock(seeded) == stock_before - 2
    assert seeded.exec(select(BagItem)).all() == []
    [event] = seeded.exec(select(PaymentEvent)).all()
    assert (event.reference, event.event) == (pending_order.paystack_reference, "charge.success")


def test_the_same_webhook_twice_takes_stock_once(client, seeded, pending_order):
    stock_before = hoodie_stock(seeded)
    body = webhook_body(pending_order.paystack_reference, pending_order.total_kobo)

    assert post_webhook(client, body).status_code == 200
    assert post_webhook(client, body).status_code == 200

    assert hoodie_stock(seeded) == stock_before - 2
    assert len(seeded.exec(select(PaymentEvent)).all()) == 2


def test_webhook_for_an_unknown_reference_is_200_and_changes_nothing(client, seeded, pending_order):
    response = post_webhook(client, webhook_body("OJA-99999-1", 100))

    assert response.status_code == 200
    assert refreshed(seeded, pending_order).status == "pending_payment"


def test_webhook_with_the_wrong_amount_does_not_mark_paid(client, seeded, pending_order):
    response = post_webhook(client, webhook_body(pending_order.paystack_reference, pending_order.total_kobo - 1))

    assert response.status_code == 200
    assert refreshed(seeded, pending_order).status == "pending_payment"


def test_webhook_with_the_wrong_currency_does_not_mark_paid(client, seeded, pending_order):
    body = webhook_body(pending_order.paystack_reference, pending_order.total_kobo, currency="USD")

    assert post_webhook(client, body).status_code == 200
    assert refreshed(seeded, pending_order).status == "pending_payment"


@pytest.mark.parametrize("event", ["charge.failed", "transfer.success", "customeridentification.success"])
def test_other_events_are_acknowledged_and_ignored(client, seeded, pending_order, event):
    body = webhook_body(pending_order.paystack_reference, pending_order.total_kobo, event=event)

    assert post_webhook(client, body).status_code == 200
    assert refreshed(seeded, pending_order).status == "pending_payment"
    assert seeded.exec(select(PaymentEvent)).one().event == event


def test_a_signed_body_that_is_not_json_is_acknowledged(client, seeded, pending_order):
    assert post_webhook(client, b"not json").status_code == 200
    assert refreshed(seeded, pending_order).status == "pending_payment"


def test_webhook_then_verify_takes_stock_once(client, seeded, auth, fake_paystack, pending_order):
    stock_before = hoodie_stock(seeded)
    reference = pending_order.paystack_reference
    fake_paystack.verify_results[reference] = {"status": "success", "amount": pending_order.total_kobo, "currency": "NGN"}

    post_webhook(client, webhook_body(reference, pending_order.total_kobo))
    verified = client.post("/api/payments/verify", json={"reference": reference}, headers=auth())

    assert verified.json()["status"] == "paid"
    assert hoodie_stock(seeded) == stock_before - 2


def test_verify_then_webhook_takes_stock_once(client, seeded, auth, fake_paystack, pending_order):
    stock_before = hoodie_stock(seeded)
    reference = pending_order.paystack_reference
    fake_paystack.verify_results[reference] = {"status": "success", "amount": pending_order.total_kobo, "currency": "NGN"}

    client.post("/api/payments/verify", json={"reference": reference}, headers=auth())
    post_webhook(client, webhook_body(reference, pending_order.total_kobo))

    assert hoodie_stock(seeded) == stock_before - 2


def test_webhook_is_unavailable_without_a_configured_key(client, seeded, pending_order, monkeypatch):
    from api import config

    monkeypatch.setattr(config, "PAYSTACK_SECRET_KEY", "")
    body = webhook_body(pending_order.paystack_reference, pending_order.total_kobo)

    response = client.post("/api/paystack/webhook", content=body, headers={"x-paystack-signature": sign(body, key="")})

    assert response.status_code == 503
    assert refreshed(seeded, pending_order).status == "pending_payment"
