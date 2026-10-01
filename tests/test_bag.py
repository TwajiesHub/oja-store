import pytest
from sqlmodel import select

from api.models import Product, Variant
from scripts.init_db import seed


@pytest.fixture
def seeded(session):
    seed(session)
    return session


def variant_id(session, sku: str) -> int:
    return session.exec(select(Variant).where(Variant.sku == sku)).one().id


def quote(client, items):
    return client.post("/api/bag/quote", json={"items": items})


def test_quote_prices_come_from_the_database(client, seeded):
    hoodie = variant_id(seeded, "OSHODI-HOODIE-M")
    shea = variant_id(seeded, "WHIPPED-SHEA-BUTTER-250-ML")

    response = quote(client, [{"variant_id": hoodie, "quantity": 1}, {"variant_id": shea, "quantity": 2}])

    assert response.status_code == 200
    body = response.json()
    assert [line["unit_price_kobo"] for line in body["lines"]] == [4_200_000, 1_800_000]
    assert [line["line_total_kobo"] for line in body["lines"]] == [4_200_000, 3_600_000]
    assert body["subtotal_kobo"] == 7_800_000
    assert body["item_count"] == 3
    assert body["free_delivery_remaining_kobo"] == 0
    assert body["lines"][0]["brand"]["slug"] == "danfo"
    assert body["lines"][0]["product_name"] == "Oshodi Hoodie"
    assert body["lines"][0]["variant_label"] == "M"
    assert body["lines"][0]["issue"] is None


def test_quote_ignores_a_price_sent_by_the_browser(client, seeded):
    cap = variant_id(seeded, "MOLUE-CAP-ONE-SIZE")

    response = quote(client, [{"variant_id": cap, "quantity": 1, "price_kobo": 1, "unit_price_kobo": 1}])

    assert response.status_code == 200
    assert response.json()["subtotal_kobo"] == 1_200_000


def test_quote_reports_how_far_from_free_delivery(client, seeded):
    lip_balm = variant_id(seeded, "SHEA-LIP-BALM-15-G")

    body = quote(client, [{"variant_id": lip_balm, "quantity": 2}]).json()

    assert body["subtotal_kobo"] == 700_000
    assert body["free_delivery_remaining_kobo"] == 4_300_000


def test_quote_of_an_empty_bag_is_empty(client, seeded):
    body = quote(client, []).json()

    assert body == {"lines": [], "removed_variant_ids": [], "item_count": 0,
                    "subtotal_kobo": 0, "free_delivery_remaining_kobo": 5_000_000}


def test_quote_reduces_quantity_to_the_stock_left(client, seeded):
    variant = seeded.exec(select(Variant).where(Variant.sku == "OSHODI-HOODIE-M")).one()
    variant.stock = 2
    seeded.add(variant)
    seeded.commit()

    line = quote(client, [{"variant_id": variant.id, "quantity": 5}]).json()["lines"][0]

    assert line["requested_quantity"] == 5
    assert line["quantity"] == 2
    assert line["issue"] == "reduced"
    assert line["line_total_kobo"] == 8_400_000


def test_quote_flags_a_sold_out_variant_and_leaves_it_out_of_the_subtotal(client, seeded):
    sold_out = variant_id(seeded, "CONDUCTOR-JACKET-XXL")
    cap = variant_id(seeded, "MOLUE-CAP-ONE-SIZE")

    body = quote(client, [{"variant_id": sold_out, "quantity": 1}, {"variant_id": cap, "quantity": 1}]).json()

    assert body["lines"][0]["issue"] == "sold_out"
    assert body["lines"][0]["quantity"] == 0
    assert body["lines"][0]["line_total_kobo"] == 0
    assert body["subtotal_kobo"] == 1_200_000
    assert body["item_count"] == 1


def test_quote_never_allows_more_than_ten_of_a_variant(client, seeded):
    cap = variant_id(seeded, "MOLUE-CAP-ONE-SIZE")

    body = quote(client, [{"variant_id": cap, "quantity": 10}, {"variant_id": cap, "quantity": 10}]).json()

    assert len(body["lines"]) == 1
    assert body["lines"][0]["quantity"] == 10
    assert body["lines"][0]["issue"] == "reduced"


def test_quote_lists_unknown_variants_as_removed(client, seeded):
    cap = variant_id(seeded, "MOLUE-CAP-ONE-SIZE")

    body = quote(client, [{"variant_id": 999_999, "quantity": 1}, {"variant_id": cap, "quantity": 1}]).json()

    assert body["removed_variant_ids"] == [999_999]
    assert [line["variant_id"] for line in body["lines"]] == [cap]


def test_quote_lists_inactive_variant_and_inactive_product_as_removed(client, seeded):
    hoodie = seeded.exec(select(Variant).where(Variant.sku == "OSHODI-HOODIE-M")).one()
    hoodie.is_active = False
    tote_product = seeded.exec(select(Product).where(Product.slug == "route-tote")).one()
    tote_product.is_active = False
    tote = seeded.exec(select(Variant).where(Variant.product_id == tote_product.id)).one()
    seeded.add(hoodie)
    seeded.add(tote_product)
    seeded.commit()

    body = quote(client, [{"variant_id": hoodie.id, "quantity": 1}, {"variant_id": tote.id, "quantity": 1}]).json()

    assert body["lines"] == []
    assert sorted(body["removed_variant_ids"]) == sorted([hoodie.id, tote.id])


@pytest.mark.parametrize("quantity", [0, -1, 11])
def test_quote_rejects_quantity_outside_1_to_10(client, seeded, quantity):
    response = quote(client, [{"variant_id": 1, "quantity": quantity}])

    assert response.status_code == 422


def test_quote_rejects_a_malformed_body(client, seeded):
    assert client.post("/api/bag/quote", json={"items": [{"quantity": 1}]}).status_code == 422
    assert client.post("/api/bag/quote", json={"items": "nope"}).status_code == 422
    assert client.post("/api/bag/quote", json={}).status_code == 422


def test_quote_rejects_a_bag_with_too_many_lines(client, seeded):
    items = [{"variant_id": i, "quantity": 1} for i in range(1, 52)]

    assert quote(client, items).status_code == 422
