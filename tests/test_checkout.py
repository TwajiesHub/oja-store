import pytest
from sqlmodel import select

from api.models import BagItem, Order, OrderItem, Profile, Variant
from scripts.init_db import seed
from tests.helpers import DETAILS, checkout, put_bag, variant_id


@pytest.fixture
def seeded(session):
    seed(session)
    return session


@pytest.fixture
def hoodie(seeded):
    return variant_id(seeded, "OSHODI-HOODIE-M")


@pytest.fixture
def cap(seeded):
    return variant_id(seeded, "MOLUE-CAP-ONE-SIZE")


def orders(session) -> list[Order]:
    session.expire_all()
    return list(session.exec(select(Order).order_by(Order.id)).all())


def test_checkout_requires_sign_in(client, seeded):
    assert client.post("/api/checkout", json=DETAILS).status_code == 401


def test_checkout_with_an_empty_bag_is_409(client, seeded, auth, fake_paystack):
    response = checkout(client, auth)

    assert response.status_code == 409
    assert response.json() == {"detail": "Your bag is empty"}
    assert fake_paystack.initialized == []


def test_checkout_creates_a_pending_order_and_starts_paystack(client, seeded, auth, fake_paystack, hoodie, cap):
    put_bag(client, auth, [(hoodie, 1), (cap, 2)])

    response = checkout(client, auth)

    assert response.status_code == 200
    body = response.json()
    assert body["order_number"] == "OJA-10001"
    assert body["reference"] == "OJA-10001-1"
    assert body["authorization_url"] == "https://paystack.test/pay/OJA-10001-1"

    [order] = orders(seeded)
    assert (order.status, order.subtotal_kobo, order.delivery_kobo, order.total_kobo) == (
        "pending_payment", 6_600_000, 0, 6_600_000)
    assert (order.paystack_reference, order.payment_attempts) == ("OJA-10001-1", 1)
    assert order.email == "amina@example.com"
    assert order.phone == "+2348030000000"

    [call] = fake_paystack.initialized
    assert call["amount_kobo"] == 6_600_000
    assert call["reference"] == "OJA-10001-1"
    assert call["email"] == "amina@example.com"
    assert call["callback_url"] == "https://shop.test/checkout/complete"
    assert call["metadata"] == {
        "order_number": "OJA-10001", "user_id": "user-a",
        "cancel_action": "https://shop.test/checkout/complete?reference=OJA-10001-1",
    }


def test_order_items_copy_names_and_prices_at_purchase_time(client, seeded, auth, fake_paystack, hoodie):
    put_bag(client, auth, [(hoodie, 2)])
    checkout(client, auth)

    item = seeded.exec(select(OrderItem)).one()

    assert (item.brand_name, item.product_name, item.variant_label) == ("DANFO", "Oshodi Hoodie", "M")
    assert (item.unit_price_kobo, item.quantity, item.line_total_kobo) == (4_200_000, 2, 8_400_000)


def test_checkout_does_not_take_stock_or_empty_the_bag_until_paid(client, seeded, auth, fake_paystack, hoodie):
    stock_before = seeded.get(Variant, hoodie).stock
    put_bag(client, auth, [(hoodie, 2)])

    checkout(client, auth)

    seeded.expire_all()
    assert seeded.get(Variant, hoodie).stock == stock_before
    assert len(seeded.exec(select(BagItem)).all()) == 1


def test_a_price_sent_by_the_browser_cannot_change_what_is_charged(client, seeded, auth, fake_paystack, cap):
    put_bag(client, auth, [(cap, 1)])

    response = checkout(client, auth, total_kobo=100, subtotal_kobo=100, price_kobo=1, delivery_kobo=0)

    assert response.status_code == 200
    assert fake_paystack.initialized[0]["amount_kobo"] == 1_200_000 + 250_000


@pytest.mark.parametrize(
    ("state", "speed", "expected_fee"),
    [
        ("Lagos", "standard", 250_000),
        ("lagos", "express", 500_000),
        ("Kano", "standard", 450_000),
    ],
)
def test_delivery_fee_follows_the_rules(client, seeded, auth, fake_paystack, cap, state, speed, expected_fee):
    put_bag(client, auth, [(cap, 1)])

    response = checkout(client, auth, state=state, delivery_speed=speed)

    assert response.status_code == 200
    assert orders(seeded)[0].delivery_kobo == expected_fee
    assert orders(seeded)[0].total_kobo == 1_200_000 + expected_fee


def test_lagos_standard_is_free_from_50000(client, seeded, auth, fake_paystack, hoodie):
    put_bag(client, auth, [(hoodie, 2)])  # 84,000

    checkout(client, auth)

    assert orders(seeded)[0].delivery_kobo == 0


def test_express_outside_lagos_is_422(client, seeded, auth, fake_paystack, cap):
    put_bag(client, auth, [(cap, 1)])

    response = checkout(client, auth, state="Kano", delivery_speed="express")

    assert response.status_code == 422
    assert "only available in Lagos" in response.json()["detail"]
    assert orders(seeded) == []


@pytest.mark.parametrize(
    "bad",
    [
        {"full_name": "A"},
        {"phone": "12345"},
        {"address": "x"},
        {"area": ""},
        {"state": "Wakanda"},
        {"delivery_speed": "drone"},
    ],
)
def test_checkout_rejects_invalid_details(client, seeded, auth, fake_paystack, cap, bad):
    put_bag(client, auth, [(cap, 1)])

    assert checkout(client, auth, **bad).status_code == 422
    assert orders(seeded) == []


def test_checkout_saves_the_address_to_the_profile_by_default(client, seeded, auth, fake_paystack, cap):
    put_bag(client, auth, [(cap, 1)])

    checkout(client, auth)

    profile = seeded.get(Profile, "user-a")
    assert (profile.full_name, profile.area, profile.state) == ("Amina Bello", "Yaba", "Lagos")


def test_checkout_can_skip_saving_the_address(client, seeded, auth, fake_paystack, cap):
    put_bag(client, auth, [(cap, 1)])

    checkout(client, auth, save_address=False)

    assert seeded.get(Profile, "user-a") is None


def test_checkout_with_a_sold_out_item_is_409(client, seeded, auth, fake_paystack):
    sold_out = variant_id(seeded, "CONDUCTOR-JACKET-XXL")
    put_bag(client, auth, [(sold_out, 1)])

    response = checkout(client, auth)

    assert response.status_code == 409
    assert response.json() == {"detail": "Conductor Jacket (XXL) is sold out"}
    assert orders(seeded) == []


def test_checkout_with_less_stock_than_wanted_is_409_with_a_clear_message(client, seeded, auth, fake_paystack, hoodie):
    put_bag(client, auth, [(hoodie, 3)])
    variant = seeded.get(Variant, hoodie)
    variant.stock = 2
    seeded.add(variant)
    seeded.commit()

    response = checkout(client, auth)

    assert response.status_code == 409
    assert response.json() == {"detail": "Oshodi Hoodie (M) has only 2 left"}


def test_checkout_with_an_item_no_longer_sold_is_409(client, seeded, auth, fake_paystack, cap):
    put_bag(client, auth, [(cap, 1)])
    variant = seeded.get(Variant, cap)
    variant.is_active = False
    seeded.add(variant)
    seeded.commit()

    response = checkout(client, auth)

    assert response.status_code == 409
    assert "no longer sold" in response.json()["detail"]


def test_checkout_only_uses_the_signed_in_users_bag(client, seeded, auth, fake_paystack, cap, hoodie):
    put_bag(client, auth, [(hoodie, 1)], user="user-b", email="bola@example.com")
    put_bag(client, auth, [(cap, 1)])

    checkout(client, auth)

    [order] = orders(seeded)
    assert order.user_id == "user-a"
    assert order.subtotal_kobo == 1_200_000


def test_when_paystack_is_down_checkout_is_502_and_the_bag_is_kept(client, seeded, auth, fake_paystack, cap):
    put_bag(client, auth, [(cap, 1)])
    fake_paystack.fail_initialize = True

    response = checkout(client, auth)

    assert response.status_code == 502
    [order] = orders(seeded)
    assert (order.status, order.payment_attempts, order.paystack_reference) == ("pending_payment", 0, None)
    assert len(seeded.exec(select(BagItem)).all()) == 1


# The delivery quote the checkout page uses.

def quote(client, auth, **body):
    return client.post("/api/checkout/quote", json={"state": "Lagos", "delivery_speed": "standard", **body},
                       headers=auth())


def test_quote_requires_sign_in(client, seeded):
    assert client.post("/api/checkout/quote", json={"state": "Lagos", "delivery_speed": "standard"}).status_code == 401


def test_quote_adds_delivery_to_the_bag(client, seeded, auth, cap):
    put_bag(client, auth, [(cap, 1)])

    body = quote(client, auth).json()

    assert (body["bag"]["subtotal_kobo"], body["delivery_kobo"], body["total_kobo"]) == (1_200_000, 250_000, 1_450_000)
    assert body["delivery_options"] == [
        {"speed": "standard", "fee_kobo": 250_000, "available": True},
        {"speed": "express", "fee_kobo": 500_000, "available": True},
    ]


def test_quote_says_express_is_unavailable_outside_lagos(client, seeded, auth, cap):
    put_bag(client, auth, [(cap, 1)])

    body = quote(client, auth, state="Kano").json()

    assert body["delivery_options"] == [
        {"speed": "standard", "fee_kobo": 450_000, "available": True},
        {"speed": "express", "fee_kobo": None, "available": False},
    ]
    assert body["delivery_kobo"] == 450_000


def test_quote_shows_free_standard_delivery_over_the_threshold(client, seeded, auth, hoodie):
    put_bag(client, auth, [(hoodie, 2)])

    body = quote(client, auth).json()

    assert body["delivery_options"][0] == {"speed": "standard", "fee_kobo": 0, "available": True}
    assert body["total_kobo"] == 8_400_000


def test_quote_rejects_express_outside_lagos_and_bad_input(client, seeded, auth, cap):
    put_bag(client, auth, [(cap, 1)])

    assert quote(client, auth, state="Kano", delivery_speed="express").status_code == 422
    assert quote(client, auth, state="Wakanda").status_code == 422
    assert quote(client, auth, delivery_speed="drone").status_code == 422


# Trying payment again for the same order.

def test_pay_again_starts_a_new_attempt_for_the_same_order(client, seeded, auth, fake_paystack, cap):
    put_bag(client, auth, [(cap, 1)])
    checkout(client, auth)

    response = client.post("/api/orders/OJA-10001/pay", headers=auth())

    assert response.status_code == 200
    assert response.json() == {"authorization_url": "https://paystack.test/pay/OJA-10001-2", "reference": "OJA-10001-2"}
    [order] = orders(seeded)
    assert (order.payment_attempts, order.paystack_reference) == (2, "OJA-10001-2")
    assert len(orders(seeded)) == 1


def test_pay_again_requires_sign_in(client, seeded):
    assert client.post("/api/orders/OJA-10001/pay").status_code == 401


def test_pay_again_for_an_unknown_order_is_404(client, seeded, auth):
    assert client.post("/api/orders/OJA-99999/pay", headers=auth()).status_code == 404


def test_pay_again_for_someone_elses_order_is_403(client, seeded, auth, fake_paystack, cap):
    put_bag(client, auth, [(cap, 1)])
    checkout(client, auth)

    response = client.post("/api/orders/OJA-10001/pay", headers=auth("user-b", "bola@example.com"))

    assert response.status_code == 403


def test_pay_again_for_a_paid_order_is_409(client, seeded, auth, fake_paystack, cap):
    put_bag(client, auth, [(cap, 1)])
    checkout(client, auth)
    order = orders(seeded)[0]
    order.status = "paid"
    seeded.add(order)
    seeded.commit()

    response = client.post("/api/orders/OJA-10001/pay", headers=auth())

    assert response.status_code == 409


def test_pay_again_when_an_item_has_sold_out_is_409(client, seeded, auth, fake_paystack, cap):
    put_bag(client, auth, [(cap, 1)])
    checkout(client, auth)
    variant = seeded.get(Variant, cap)
    variant.stock = 0
    seeded.add(variant)
    seeded.commit()

    response = client.post("/api/orders/OJA-10001/pay", headers=auth())

    assert response.status_code == 409
    assert "sold out" in response.json()["detail"]


def test_pay_again_when_paystack_is_down_is_502_and_keeps_the_attempt_count(client, seeded, auth, fake_paystack, cap):
    put_bag(client, auth, [(cap, 1)])
    checkout(client, auth)
    fake_paystack.fail_initialize = True

    response = client.post("/api/orders/OJA-10001/pay", headers=auth())

    assert response.status_code == 502
    assert orders(seeded)[0].payment_attempts == 1
