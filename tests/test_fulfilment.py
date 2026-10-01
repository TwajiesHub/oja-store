import pytest
from sqlmodel import select

from api import fulfilment
from api.fulfilment import mark_paid
from api.models import BagItem, Order, Variant
from scripts.init_db import seed
from tests.helpers import checkout, put_bag, variant_id


@pytest.fixture
def seeded(session):
    seed(session)
    return session


@pytest.fixture
def order_for(client, seeded, auth, fake_paystack):
    """Places an order for the given (sku, quantity) pairs and returns it."""
    def place(items, user="user-a", email="amina@example.com"):
        put_bag(client, auth, [(variant_id(seeded, sku), qty) for sku, qty in items], user=user, email=email)
        checkout(client, auth, user=user, email=email)
        seeded.expire_all()
        return seeded.exec(select(Order).order_by(Order.id.desc())).first()

    return place


def stock(session, sku: str) -> int:
    session.expire_all()
    return session.exec(select(Variant).where(Variant.sku == sku)).one().stock


def test_mark_paid_marks_the_order_paid_takes_stock_and_empties_the_bag(seeded, order_for):
    order = order_for([("OSHODI-HOODIE-M", 2), ("MOLUE-CAP-ONE-SIZE", 1)])
    hoodie_before, cap_before = stock(seeded, "OSHODI-HOODIE-M"), stock(seeded, "MOLUE-CAP-ONE-SIZE")

    result = mark_paid(seeded, order.paystack_reference, order.total_kobo, "NGN")

    seeded.refresh(order)
    assert result == fulfilment.PAID
    assert order.status == "paid"
    assert order.paid_at is not None
    assert order.stock_issue is False
    assert stock(seeded, "OSHODI-HOODIE-M") == hoodie_before - 2
    assert stock(seeded, "MOLUE-CAP-ONE-SIZE") == cap_before - 1
    assert seeded.exec(select(BagItem)).all() == []


def test_mark_paid_twice_decrements_stock_once(seeded, order_for):
    order = order_for([("OSHODI-HOODIE-M", 2)])
    before = stock(seeded, "OSHODI-HOODIE-M")

    first = mark_paid(seeded, order.paystack_reference, order.total_kobo, "NGN")
    second = mark_paid(seeded, order.paystack_reference, order.total_kobo, "NGN")

    assert (first, second) == (fulfilment.PAID, fulfilment.ALREADY_PAID)
    assert stock(seeded, "OSHODI-HOODIE-M") == before - 2


def test_mark_paid_rejects_a_different_amount(seeded, order_for):
    order = order_for([("MOLUE-CAP-ONE-SIZE", 1)])
    before = stock(seeded, "MOLUE-CAP-ONE-SIZE")

    result = mark_paid(seeded, order.paystack_reference, order.total_kobo - 1, "NGN")

    seeded.refresh(order)
    assert result == fulfilment.AMOUNT_MISMATCH
    assert order.status == "pending_payment"
    assert stock(seeded, "MOLUE-CAP-ONE-SIZE") == before


def test_mark_paid_rejects_a_different_currency(seeded, order_for):
    order = order_for([("MOLUE-CAP-ONE-SIZE", 1)])

    result = mark_paid(seeded, order.paystack_reference, order.total_kobo, "USD")

    seeded.refresh(order)
    assert result == fulfilment.AMOUNT_MISMATCH
    assert order.status == "pending_payment"


def test_mark_paid_rejects_a_missing_amount(seeded, order_for):
    order = order_for([("MOLUE-CAP-ONE-SIZE", 1)])

    assert mark_paid(seeded, order.paystack_reference, None, None) == fulfilment.AMOUNT_MISMATCH


@pytest.mark.parametrize("reference", ["", "nonsense", "OJA-99999-1", "OJA-10001", "OJA-10001-0", "OJA-10001-5", "x-OJA-10001-1"])
def test_mark_paid_ignores_references_it_does_not_know(seeded, order_for, reference):
    order = order_for([("MOLUE-CAP-ONE-SIZE", 1)])

    result = mark_paid(seeded, reference, order.total_kobo, "NGN")

    seeded.refresh(order)
    assert result == fulfilment.UNKNOWN_REFERENCE
    assert order.status == "pending_payment"


def test_a_payment_from_an_earlier_attempt_still_counts(client, seeded, auth, order_for):
    order = order_for([("MOLUE-CAP-ONE-SIZE", 1)])
    client.post(f"/api/orders/{order.number}/pay", headers=auth())  # attempt 2 begins

    result = mark_paid(seeded, f"{order.number}-1", order.total_kobo, "NGN")

    seeded.refresh(order)
    assert result == fulfilment.PAID
    assert order.status == "paid"


def test_stock_never_goes_negative_and_the_order_is_flagged(seeded, order_for):
    order = order_for([("MOLUE-CAP-ONE-SIZE", 3)])
    variant = seeded.exec(select(Variant).where(Variant.sku == "MOLUE-CAP-ONE-SIZE")).one()
    variant.stock = 1
    seeded.add(variant)
    seeded.commit()

    result = mark_paid(seeded, order.paystack_reference, order.total_kobo, "NGN")

    seeded.refresh(order)
    assert result == fulfilment.PAID
    assert order.status == "paid"
    assert order.stock_issue is True
    assert stock(seeded, "MOLUE-CAP-ONE-SIZE") == 1


def test_paying_does_not_empty_other_users_bags(client, seeded, auth, order_for):
    put_bag(client, auth, [(variant_id(seeded, "SHEA-LIP-BALM-15-G"), 1)], user="user-b", email="bola@example.com")
    order = order_for([("MOLUE-CAP-ONE-SIZE", 1)])

    mark_paid(seeded, order.paystack_reference, order.total_kobo, "NGN")

    remaining = seeded.exec(select(BagItem)).all()
    assert [row.user_id for row in remaining] == ["user-b"]


def test_a_cancelled_order_cannot_be_paid(seeded, order_for):
    order = order_for([("MOLUE-CAP-ONE-SIZE", 1)])
    order.status = "cancelled"
    seeded.add(order)
    seeded.commit()

    result = mark_paid(seeded, order.paystack_reference, order.total_kobo, "NGN")

    seeded.refresh(order)
    assert result == fulfilment.NOT_PAYABLE
    assert order.status == "cancelled"
