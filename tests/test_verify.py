from datetime import date, datetime, timezone

import pytest
from sqlmodel import select

from api import pricing
from api.models import Order
from scripts.init_db import seed
from tests.helpers import checkout, put_bag, variant_id


@pytest.fixture
def seeded(session):
    seed(session)
    return session


@pytest.fixture
def pending_order(client, seeded, auth, fake_paystack):
    put_bag(client, auth, [(variant_id(seeded, "MOLUE-CAP-ONE-SIZE"), 1)])
    checkout(client, auth)
    seeded.expire_all()
    return seeded.exec(select(Order)).one()


def verify(client, auth, reference, **auth_args):
    return client.post("/api/payments/verify", json={"reference": reference}, headers=auth(**auth_args))


def status_of(session, order) -> str:
    session.expire_all()
    return session.get(Order, order.id).status


def test_verify_requires_sign_in(client, seeded):
    assert client.post("/api/payments/verify", json={"reference": "OJA-10001-1"}).status_code == 401


def test_verify_marks_a_successful_payment_paid(client, seeded, auth, fake_paystack, pending_order):
    fake_paystack.verify_results["OJA-10001-1"] = {"status": "success", "amount": pending_order.total_kobo, "currency": "NGN"}

    response = verify(client, auth, "OJA-10001-1")

    assert response.status_code == 200
    assert response.json() == {"status": "paid", "order_number": "OJA-10001"}
    assert status_of(seeded, pending_order) == "paid"


def test_verify_twice_is_safe(client, seeded, auth, fake_paystack, pending_order):
    fake_paystack.verify_results["OJA-10001-1"] = {"status": "success", "amount": pending_order.total_kobo, "currency": "NGN"}

    first = verify(client, auth, "OJA-10001-1").json()
    second = verify(client, auth, "OJA-10001-1").json()

    assert first == second == {"status": "paid", "order_number": "OJA-10001"}
    assert fake_paystack.verified == ["OJA-10001-1"]


@pytest.mark.parametrize("paystack_status", ["failed", "abandoned", "reversed"])
def test_verify_reports_a_failed_payment(client, seeded, auth, fake_paystack, pending_order, paystack_status):
    fake_paystack.verify_results["OJA-10001-1"] = {"status": paystack_status, "amount": 0, "currency": "NGN"}

    response = verify(client, auth, "OJA-10001-1")

    assert response.json()["status"] == "failed"
    assert status_of(seeded, pending_order) == "pending_payment"


@pytest.mark.parametrize("paystack_status", ["ongoing", "pending", "processing", "queued"])
def test_verify_reports_a_payment_still_in_progress(client, seeded, auth, fake_paystack, pending_order, paystack_status):
    fake_paystack.verify_results["OJA-10001-1"] = {"status": paystack_status, "amount": 0, "currency": "NGN"}

    assert verify(client, auth, "OJA-10001-1").json()["status"] == "pending"


def test_verify_treats_a_paystack_outage_as_pending_not_failed(client, seeded, auth, fake_paystack, pending_order):
    fake_paystack.fail_verify = True

    response = verify(client, auth, "OJA-10001-1")

    assert response.status_code == 200
    assert response.json()["status"] == "pending"
    assert status_of(seeded, pending_order) == "pending_payment"


def test_verify_does_not_mark_paid_when_the_amount_differs(client, seeded, auth, fake_paystack, pending_order):
    fake_paystack.verify_results["OJA-10001-1"] = {"status": "success", "amount": 1, "currency": "NGN"}

    response = verify(client, auth, "OJA-10001-1")

    assert response.json()["status"] == "pending"
    assert status_of(seeded, pending_order) == "pending_payment"


def test_verify_an_unknown_reference_is_404(client, seeded, auth, fake_paystack, pending_order):
    assert verify(client, auth, "OJA-99999-1").status_code == 404
    assert verify(client, auth, "garbage").status_code == 404
    assert fake_paystack.verified == []


def test_verify_someone_elses_payment_is_403(client, seeded, auth, fake_paystack, pending_order):
    response = verify(client, auth, "OJA-10001-1", user_id="user-b", email="bola@example.com")

    assert response.status_code == 403
    assert fake_paystack.verified == []


def test_verify_rejects_an_empty_reference(client, seeded, auth):
    assert client.post("/api/payments/verify", json={"reference": ""}, headers=auth()).status_code == 422
    assert client.post("/api/payments/verify", json={}, headers=auth()).status_code == 422


# Delivery dates (Friday 2 Oct 2026 is a working day).

def at(day: int, hour: int, month: int = 10) -> datetime:
    """A moment in WAT (UTC+1), given as UTC."""
    return datetime(2026, month, day, hour - 1, 0, tzinfo=timezone.utc)


def test_lagos_standard_counts_working_days_from_payment():
    assert pricing.expected_delivery(at(2, 10), "Lagos", "standard") == (date(2026, 10, 5), date(2026, 10, 7))


def test_other_states_standard_takes_three_to_five_working_days():
    assert pricing.expected_delivery(at(2, 10), "Kano", "standard") == (date(2026, 10, 7), date(2026, 10, 9))


def test_a_mid_week_payment_does_not_skip_a_weekend_it_does_not_cross():
    assert pricing.expected_delivery(at(1, 10), "Lagos", "standard") == (date(2026, 10, 2), date(2026, 10, 6))


def test_express_paid_before_noon_on_a_working_day_arrives_the_same_day():
    assert pricing.expected_delivery(at(2, 11), "Lagos", "express") == (date(2026, 10, 2), date(2026, 10, 2))


def test_express_paid_after_noon_arrives_the_next_working_day():
    assert pricing.expected_delivery(at(1, 13), "Lagos", "express") == (date(2026, 10, 2), date(2026, 10, 2))


def test_express_paid_after_noon_on_friday_arrives_on_monday():
    assert pricing.expected_delivery(at(2, 13), "Lagos", "express") == (date(2026, 10, 5), date(2026, 10, 5))


def test_express_paid_on_a_weekend_arrives_on_monday():
    assert pricing.expected_delivery(at(3, 9), "Lagos", "express") == (date(2026, 10, 5), date(2026, 10, 5))


def test_standard_paid_on_a_weekend_counts_from_monday():
    assert pricing.expected_delivery(at(3, 9), "Lagos", "standard") == (date(2026, 10, 5), date(2026, 10, 7))


def test_the_date_is_worked_out_in_lagos_time_not_utc():
    # 23:30 UTC on Thursday 1 Oct is 00:30 WAT on Friday 2 Oct, which is before noon: express is same day.
    paid = datetime(2026, 10, 1, 23, 30, tzinfo=timezone.utc)

    assert pricing.expected_delivery(paid, "Lagos", "express") == (date(2026, 10, 2), date(2026, 10, 2))
