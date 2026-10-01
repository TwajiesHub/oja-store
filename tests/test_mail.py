from datetime import date, datetime, timezone

import httpx
import pytest
from sqlmodel import select

from api import mail
from api.models import Order, OrderItem, Variant
from api.pricing import format_arrival, format_day
from scripts.init_db import seed
from tests.conftest import REAL_SEND_EMAIL
from tests.helpers import checkout, post_webhook, put_bag, variant_id, webhook_body


@pytest.fixture
def seeded(session):
    seed(session)
    return session


@pytest.fixture
def pending_order(client, seeded, auth, fake_paystack):
    put_bag(client, auth, [(variant_id(seeded, "OSHODI-HOODIE-M"), 1), (variant_id(seeded, "WHIPPED-SHEA-BUTTER-250-ML"), 2)])
    checkout(client, auth)
    seeded.expire_all()
    return seeded.exec(select(Order)).one()


def pay_by_webhook(client, order):
    return post_webhook(client, webhook_body(order.paystack_reference, order.total_kobo))


def refreshed(session, order) -> Order:
    session.expire_all()
    return session.get(Order, order.id)


# Sending

def test_the_email_is_sent_once_when_an_order_is_paid(client, seeded, pending_order, fake_mailgun):
    pay_by_webhook(client, pending_order)

    [message] = fake_mailgun.sent
    assert message["to"] == "amina@example.com"
    assert message["subject"] == "Your Ọjà order OJA-10001 is confirmed"
    assert refreshed(seeded, pending_order).email_sent_at is not None
    assert refreshed(seeded, pending_order).email_error is None


def test_no_email_is_sent_while_an_order_is_unpaid(client, seeded, pending_order, fake_mailgun):
    assert mail.send_order_confirmation(seeded, pending_order.id) == mail.NOT_PAID

    assert fake_mailgun.sent == []


def test_no_email_is_sent_when_the_payment_does_not_match(client, seeded, pending_order, fake_mailgun):
    post_webhook(client, webhook_body(pending_order.paystack_reference, 1))

    assert fake_mailgun.sent == []


def test_the_same_webhook_twice_sends_one_email(client, seeded, pending_order, fake_mailgun):
    pay_by_webhook(client, pending_order)
    pay_by_webhook(client, pending_order)

    assert len(fake_mailgun.sent) == 1


def test_webhook_then_verify_sends_one_email(client, seeded, auth, fake_paystack, pending_order, fake_mailgun):
    fake_paystack.verify_results["OJA-10001-1"] = {"status": "success", "amount": pending_order.total_kobo, "currency": "NGN"}

    pay_by_webhook(client, pending_order)
    client.post("/api/payments/verify", json={"reference": "OJA-10001-1"}, headers=auth())

    assert len(fake_mailgun.sent) == 1


def test_verify_then_webhook_sends_one_email(client, seeded, auth, fake_paystack, pending_order, fake_mailgun):
    fake_paystack.verify_results["OJA-10001-1"] = {"status": "success", "amount": pending_order.total_kobo, "currency": "NGN"}

    client.post("/api/payments/verify", json={"reference": "OJA-10001-1"}, headers=auth())
    pay_by_webhook(client, pending_order)

    assert len(fake_mailgun.sent) == 1


def test_a_send_already_claimed_is_not_sent_again(client, seeded, pending_order, fake_mailgun):
    pay_by_webhook(client, pending_order)
    seeded.expire_all()  # this session still holds the pre-payment copy of the order

    assert mail.send_order_confirmation(seeded, pending_order.id) == mail.ALREADY_SENT
    assert len(fake_mailgun.sent) == 1


# Failure and retry

def test_a_failed_email_does_not_change_the_paid_order_or_the_webhook_answer(client, seeded, pending_order, fake_mailgun):
    fake_mailgun.fail_with = "Mailgun refused the email (HTTP 403): sandbox"

    response = pay_by_webhook(client, pending_order)

    order = refreshed(seeded, pending_order)
    assert response.status_code == 200
    assert order.status == "paid"
    assert order.email_sent_at is None
    assert "sandbox" in order.email_error


def test_a_failed_email_does_not_fail_verify(client, seeded, auth, fake_paystack, pending_order, fake_mailgun):
    fake_mailgun.fail_with = "down"
    fake_paystack.verify_results["OJA-10001-1"] = {"status": "success", "amount": pending_order.total_kobo, "currency": "NGN"}

    response = client.post("/api/payments/verify", json={"reference": "OJA-10001-1"}, headers=auth())

    assert response.json() == {"status": "paid", "order_number": "OJA-10001"}


def test_the_next_webhook_retries_a_failed_email(client, seeded, pending_order, fake_mailgun):
    fake_mailgun.fail_with = "down"
    pay_by_webhook(client, pending_order)
    fake_mailgun.fail_with = None

    pay_by_webhook(client, pending_order)

    assert len(fake_mailgun.sent) == 1
    order = refreshed(seeded, pending_order)
    assert order.email_sent_at is not None
    assert order.email_error is None


def test_the_next_verify_retries_a_failed_email(client, seeded, auth, fake_paystack, pending_order, fake_mailgun):
    fake_mailgun.fail_with = "down"
    pay_by_webhook(client, pending_order)
    fake_mailgun.fail_with = None

    client.post("/api/payments/verify", json={"reference": "OJA-10001-1"}, headers=auth())

    assert len(fake_mailgun.sent) == 1
    assert fake_paystack.verified == []  # an already-paid order needs no call to Paystack


def test_stock_is_taken_once_even_when_the_email_keeps_failing(client, seeded, pending_order, fake_mailgun):
    stock_before = seeded.exec(select(Variant).where(Variant.sku == "OSHODI-HOODIE-M")).one().stock
    fake_mailgun.fail_with = "down"

    pay_by_webhook(client, pending_order)
    pay_by_webhook(client, pending_order)

    seeded.expire_all()
    assert refreshed(seeded, pending_order).status == "paid"
    assert seeded.exec(select(Variant).where(Variant.sku == "OSHODI-HOODIE-M")).one().stock == stock_before - 1


def test_an_order_without_an_email_address_records_the_error(client, seeded, pending_order, fake_mailgun):
    pending_order.email = ""
    seeded.add(pending_order)
    seeded.commit()

    pay_by_webhook(client, pending_order)

    assert fake_mailgun.sent == []
    assert "no email address" in refreshed(seeded, pending_order).email_error


# What the email says

@pytest.fixture
def paid_content(client, seeded, pending_order, fake_mailgun):
    pay_by_webhook(client, pending_order)
    return fake_mailgun.sent[0]


def test_the_email_has_html_and_a_plain_text_version(paid_content):
    assert paid_content["html"].startswith("<!doctype html>")
    assert "Order OJA-10001" in paid_content["text"]


def test_the_email_greets_the_customer_and_confirms_the_total(paid_content):
    assert "Thank you, Amina. Your order is confirmed." in paid_content["html"]
    assert "<strong>₦78,000</strong>" in paid_content["html"]
    assert "We've received your payment of ₦78,000" in paid_content["text"]
    assert "pieces from 2 Nigerian brands" in paid_content["text"]


def test_the_email_groups_items_by_brand_with_variants_and_quantities(paid_content):
    text = paid_content["text"]
    assert text.index("DANFO") < text.index("Oshodi Hoodie · M · × 1") < text.index("KADE")
    assert "Whipped Shea Butter · 250 ml · × 2  ₦36,000" in text
    assert "₦42,000" in paid_content["html"]


def test_the_email_shows_subtotal_delivery_and_total(paid_content):
    assert "Subtotal: ₦78,000" in paid_content["text"]
    assert "Delivery · Standard: Free" in paid_content["text"]
    assert "Total paid (Paystack): ₦78,000" in paid_content["text"]


def test_the_email_shows_the_delivery_details_and_expected_dates(paid_content):
    text = paid_content["text"]
    assert "Amina Bello\n12 Herbert Macaulay Way\nYaba, Lagos\n+234 803 000 0000" in text
    assert " – " in text.split("EXPECTED\n")[1].splitlines()[0]


def test_the_email_links_to_the_order_and_names_the_help_address(paid_content):
    assert "https://shop.test/orders/OJA-10001" in paid_content["text"]
    assert 'href="https://shop.test/orders/OJA-10001"' in paid_content["html"]
    assert "Returns are accepted within 7 days of delivery on unused items." in paid_content["text"]


def test_the_email_does_not_promise_a_text_message(paid_content):
    assert "text you" not in paid_content["html"].lower()
    assert "text you" not in paid_content["text"].lower()


def test_the_email_uses_inline_styles_and_tables_not_a_stylesheet(paid_content):
    html = paid_content["html"]
    assert "<style" not in html and "<link" not in html and "<script" not in html
    assert '<table role="presentation"' in html


def test_customer_text_is_escaped_in_the_html_email(client, seeded, pending_order, fake_mailgun):
    pending_order.full_name = '<script>alert(1)</script> "Bello"'
    pending_order.address = "12 <b>Herbert</b> Way & Sons"
    seeded.add(pending_order)
    item = seeded.exec(select(OrderItem)).first()
    item.product_name = "Hoodie <img src=x>"
    seeded.add(item)
    seeded.commit()

    pay_by_webhook(client, pending_order)

    html = fake_mailgun.sent[0]["html"]
    assert "<script>alert" not in html
    assert "&lt;script&gt;" in html
    assert "<b>Herbert</b>" not in html and "&lt;b&gt;Herbert&lt;/b&gt;" in html
    assert "<img src=x>" not in html
    assert "Way &amp; Sons" in html


def test_express_orders_say_express(client, seeded, auth, fake_paystack, fake_mailgun):
    put_bag(client, auth, [(variant_id(seeded, "MOLUE-CAP-ONE-SIZE"), 1)])
    checkout(client, auth, delivery_speed="express")
    order = seeded.exec(select(Order)).one()

    pay_by_webhook(client, order)

    assert "Delivery · Express: ₦5,000" in fake_mailgun.sent[0]["text"]
    assert "Molue Cap · × 1" in fake_mailgun.sent[0]["text"]  # "One size" is not repeated


# The Mailgun call itself

class FakeResponse:
    def __init__(self, status_code=200, body=None):
        self.status_code = status_code
        self._body = body if body is not None else {"message": "Queued. Thank you."}

    def json(self):
        return self._body


@pytest.fixture
def mailgun_configured(monkeypatch):
    monkeypatch.setattr(mail.config, "MAILGUN_API_KEY", "key-test")
    monkeypatch.setattr(mail.config, "MAILGUN_DOMAIN", "sandbox123.mailgun.org")
    monkeypatch.setattr(mail.config, "MAILGUN_FROM", "Oja <orders@sandbox123.mailgun.org>")
    monkeypatch.setattr(mail.config, "MAILGUN_API_BASE", "https://api.mailgun.net/")


@pytest.fixture
def real_send():
    """The real Mailgun function. The autouse fake replaces it on the module for every test."""
    return REAL_SEND_EMAIL


def test_the_mailgun_call_uses_the_domain_basic_auth_and_both_bodies(monkeypatch, mailgun_configured, real_send):
    calls = []
    monkeypatch.setattr(httpx, "post", lambda url, **kwargs: calls.append((url, kwargs)) or FakeResponse())

    real_send(to="amina@example.com", subject="Hi", html="<p>Hi</p>", text="Hi")

    [(url, kwargs)] = calls
    assert url == "https://api.mailgun.net/v3/sandbox123.mailgun.org/messages"
    assert kwargs["auth"] == ("api", "key-test")
    assert kwargs["data"] == {"from": "Oja <orders@sandbox123.mailgun.org>", "to": "amina@example.com",
                              "subject": "Hi", "text": "Hi", "html": "<p>Hi</p>"}
    assert kwargs["timeout"] == 10


def test_a_sandbox_refusal_becomes_a_clear_error(monkeypatch, mailgun_configured, real_send):
    body = {"message": "Sandbox subdomains are for test purposes only."}
    monkeypatch.setattr(httpx, "post", lambda url, **kwargs: FakeResponse(403, body))

    with pytest.raises(mail.MailgunError, match="HTTP 403.*Sandbox subdomains"):
        real_send(to="x@example.com", subject="s", html="h", text="t")


def test_a_network_error_becomes_a_mailgun_error(monkeypatch, mailgun_configured, real_send):
    def boom(url, **kwargs):
        raise httpx.ConnectTimeout("slow")

    monkeypatch.setattr(httpx, "post", boom)

    with pytest.raises(mail.MailgunError, match="Could not reach Mailgun"):
        real_send(to="x@example.com", subject="s", html="h", text="t")


def test_a_sender_without_an_address_is_reported_clearly(monkeypatch, mailgun_configured, real_send):
    monkeypatch.setattr(mail.config, "MAILGUN_FROM", "Oja <sandbox123.mailgun.org>")
    called = []
    monkeypatch.setattr(httpx, "post", lambda *a, **k: called.append(1))

    with pytest.raises(mail.MailgunError, match="MAILGUN_FROM must look like"):
        real_send(to="x@example.com", subject="s", html="h", text="t")

    assert called == []


def test_an_unconfigured_mailgun_is_reported_not_called(monkeypatch, real_send):
    monkeypatch.setattr(mail.config, "MAILGUN_API_KEY", "")
    called = []
    monkeypatch.setattr(httpx, "post", lambda *a, **k: called.append(1))

    with pytest.raises(mail.MailgunError, match="not configured"):
        real_send(to="x@example.com", subject="s", html="h", text="t")

    assert called == []


# Dates in the email

def test_day_and_window_formats():
    assert format_day(date(2026, 10, 2)) == "Fri 2 Oct"
    assert format_day(date(2026, 10, 2), with_year=True) == "Fri 2 Oct 2026"
    assert format_arrival(date(2026, 10, 5), date(2026, 10, 7)) == "Mon 5 – Wed 7 Oct"
    assert format_arrival(date(2026, 10, 2), date(2026, 10, 2)) == "Fri 2 Oct"
    assert format_arrival(date(2026, 10, 29), date(2026, 11, 3)) == "Thu 29 Oct – Tue 3 Nov"


def test_the_order_date_is_in_lagos_time(client, seeded, pending_order, fake_mailgun):
    pending_order.status = "paid"
    pending_order.paid_at = datetime(2026, 10, 1, 23, 30, tzinfo=timezone.utc)  # 00:30 on Fri 2 Oct in Lagos
    seeded.add(pending_order)
    seeded.commit()

    mail.send_order_confirmation(seeded, pending_order.id)

    assert "Order OJA-10001 · Fri 2 Oct 2026" in fake_mailgun.sent[0]["text"]
