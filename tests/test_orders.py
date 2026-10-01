import pytest
from sqlmodel import select

from api.models import Order
from scripts.init_db import seed
from tests.helpers import checkout, post_webhook, put_bag, variant_id, webhook_body


@pytest.fixture
def seeded(session):
    seed(session)
    return session


@pytest.fixture
def pending_order(client, seeded, auth, fake_paystack):
    put_bag(client, auth, [(variant_id(seeded, "OSHODI-HOODIE-M"), 1), (variant_id(seeded, "SHEA-LIP-BALM-15-G"), 2)])
    checkout(client, auth)
    seeded.expire_all()
    return seeded.exec(select(Order)).one()


def test_order_detail_requires_sign_in(client, seeded):
    assert client.get("/api/orders/OJA-10001").status_code == 401


def test_order_detail_shows_items_totals_and_delivery_details(client, seeded, auth, pending_order):
    response = client.get("/api/orders/OJA-10001", headers=auth())

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "pending_payment"
    assert (body["subtotal_kobo"], body["delivery_kobo"], body["total_kobo"]) == (4_900_000, 250_000, 5_150_000)
    assert (body["full_name"], body["area"], body["state"], body["phone"]) == ("Amina Bello", "Yaba", "Lagos", "+2348030000000")
    assert [(i["brand_name"], i["product_name"], i["variant_label"], i["quantity"]) for i in body["items"]] == [
        ("DANFO", "Oshodi Hoodie", "M", 1), ("kade", "Shea Lip Balm", "15 g", 2)]
    assert body["items"][1]["line_total_kobo"] == 700_000


def test_an_unpaid_order_has_no_arrival_dates(client, seeded, auth, pending_order):
    body = client.get("/api/orders/OJA-10001", headers=auth()).json()

    assert (body["paid_at"], body["arriving_from"], body["arriving_to"]) == (None, None, None)


def test_a_paid_order_shows_when_it_arrives(client, seeded, auth, pending_order):
    post_webhook(client, webhook_body(pending_order.paystack_reference, pending_order.total_kobo))

    body = client.get("/api/orders/OJA-10001", headers=auth()).json()

    assert body["status"] == "paid"
    assert body["paid_at"] is not None
    assert body["arriving_from"] is not None and body["arriving_to"] is not None
    assert body["arriving_from"] < body["arriving_to"]


def test_order_detail_for_an_unknown_order_is_404(client, seeded, auth):
    response = client.get("/api/orders/OJA-99999", headers=auth())

    assert response.status_code == 404
    assert response.json() == {"detail": "Order OJA-99999 not found"}


def test_order_detail_for_someone_elses_order_is_403(client, seeded, auth, pending_order):
    response = client.get("/api/orders/OJA-10001", headers=auth("user-b", "bola@example.com"))

    assert response.status_code == 403


# The list of the user's orders

def place_and_pay(client, seeded, auth, sku, quantity, user="user-a", email="amina@example.com"):
    put_bag(client, auth, [(variant_id(seeded, sku), quantity)], user=user, email=email)
    checkout(client, auth, user=user, email=email)
    seeded.expire_all()
    order = seeded.exec(select(Order).where(Order.user_id == user).order_by(Order.id.desc())).first()
    post_webhook(client, webhook_body(order.paystack_reference, order.total_kobo))
    return order


def test_order_list_requires_sign_in(client, seeded):
    assert client.get("/api/orders").status_code == 401


def test_order_list_is_empty_for_a_new_user(client, seeded, auth):
    response = client.get("/api/orders", headers=auth())

    assert response.status_code == 200
    assert response.json() == []


def test_order_list_shows_paid_orders_newest_first(client, seeded, auth, fake_paystack):
    first = place_and_pay(client, seeded, auth, "MOLUE-CAP-ONE-SIZE", 1)
    second = place_and_pay(client, seeded, auth, "SHEA-LIP-BALM-15-G", 3)

    orders = client.get("/api/orders", headers=auth()).json()

    assert [o["number"] for o in orders] == [second.number, first.number]
    assert orders[0]["status"] == "paid"
    assert (orders[0]["item_count"], orders[0]["total_kobo"]) == (3, 3 * 350_000 + 250_000)
    assert orders[0]["paid_at"] is not None


def test_order_list_leaves_out_orders_that_were_never_paid(client, seeded, auth, fake_paystack, pending_order):
    response = client.get("/api/orders", headers=auth())

    assert response.json() == []


def test_order_list_only_shows_your_own_orders(client, seeded, auth, fake_paystack):
    mine = place_and_pay(client, seeded, auth, "MOLUE-CAP-ONE-SIZE", 1)
    place_and_pay(client, seeded, auth, "SHEA-LIP-BALM-15-G", 1, user="user-b", email="bola@example.com")

    orders = client.get("/api/orders", headers=auth()).json()

    assert [o["number"] for o in orders] == [mine.number]


# Whether a receipt really went out

def test_the_order_says_when_the_receipt_was_sent(client, seeded, auth, fake_paystack, pending_order):
    post_webhook(client, webhook_body(pending_order.paystack_reference, pending_order.total_kobo))

    assert client.get("/api/orders/OJA-10001", headers=auth()).json()["receipt_sent"] is True


def test_the_order_says_when_the_receipt_has_not_been_sent(client, seeded, auth, fake_paystack, pending_order, fake_mailgun):
    fake_mailgun.fail_with = "Mailgun refused the email (HTTP 403): sandbox"
    post_webhook(client, webhook_body(pending_order.paystack_reference, pending_order.total_kobo))

    body = client.get("/api/orders/OJA-10001", headers=auth()).json()

    assert body["status"] == "paid"
    assert body["receipt_sent"] is False


def test_an_unpaid_order_has_no_receipt(client, seeded, auth, pending_order):
    assert client.get("/api/orders/OJA-10001", headers=auth()).json()["receipt_sent"] is False
