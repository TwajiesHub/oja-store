import pytest
from sqlmodel import select

from api.models import BagItem, Product, Variant
from scripts.init_db import seed


@pytest.fixture
def seeded(session):
    seed(session)
    return session


def variant(session, sku: str) -> Variant:
    return session.exec(select(Variant).where(Variant.sku == sku)).one()


def items(*pairs):
    return {"items": [{"variant_id": vid, "quantity": qty} for vid, qty in pairs]}


def saved_rows(session, user_id: str) -> dict[int, int]:
    session.expire_all()
    rows = session.exec(select(BagItem).where(BagItem.user_id == user_id)).all()
    return {row.variant_id: row.quantity for row in rows}


@pytest.mark.parametrize("method", ["get", "put", "post"])
def test_signed_in_bag_routes_require_sign_in(client, seeded, method):
    path = "/api/bag/merge" if method == "post" else "/api/bag"
    kwargs = {} if method == "get" else {"json": items()}

    assert getattr(client, method)(path, **kwargs).status_code == 401


def test_a_new_users_bag_is_empty(client, seeded, auth):
    response = client.get("/api/bag", headers=auth())

    assert response.status_code == 200
    assert response.json()["lines"] == []
    assert response.json()["subtotal_kobo"] == 0


def test_put_saves_the_bag_and_get_returns_it_priced(client, seeded, auth):
    hoodie = variant(seeded, "OSHODI-HOODIE-M")
    shea = variant(seeded, "WHIPPED-SHEA-BUTTER-250-ML")

    put = client.put("/api/bag", json=items((hoodie.id, 1), (shea.id, 2)), headers=auth())
    got = client.get("/api/bag", headers=auth())

    assert put.status_code == 200
    assert got.json() == put.json()
    assert [line["variant_id"] for line in got.json()["lines"]] == [hoodie.id, shea.id]
    assert got.json()["subtotal_kobo"] == 4_200_000 + 3_600_000


def test_put_replaces_the_whole_bag(client, seeded, auth):
    hoodie = variant(seeded, "OSHODI-HOODIE-M")
    cap = variant(seeded, "MOLUE-CAP-ONE-SIZE")
    client.put("/api/bag", json=items((hoodie.id, 1)), headers=auth())

    client.put("/api/bag", json=items((cap.id, 3)), headers=auth())

    assert saved_rows(seeded, "user-a") == {cap.id: 3}


def test_put_with_an_empty_list_empties_the_bag(client, seeded, auth):
    cap = variant(seeded, "MOLUE-CAP-ONE-SIZE")
    client.put("/api/bag", json=items((cap.id, 3)), headers=auth())

    client.put("/api/bag", json=items(), headers=auth())

    assert saved_rows(seeded, "user-a") == {}


def test_put_clamps_quantity_to_stock(client, seeded, auth):
    hoodie = variant(seeded, "OSHODI-HOODIE-M")
    hoodie.stock = 2
    seeded.add(hoodie)
    seeded.commit()

    client.put("/api/bag", json=items((hoodie.id, 7)), headers=auth())

    assert saved_rows(seeded, "user-a") == {hoodie.id: 2}


def test_put_keeps_a_sold_out_item_so_the_shopper_sees_it_flagged(client, seeded, auth):
    sold_out = variant(seeded, "CONDUCTOR-JACKET-XXL")

    response = client.put("/api/bag", json=items((sold_out.id, 3)), headers=auth())

    assert saved_rows(seeded, "user-a") == {sold_out.id: 1}
    assert response.json()["lines"][0]["issue"] == "sold_out"


def test_put_drops_unknown_variants(client, seeded, auth):
    cap = variant(seeded, "MOLUE-CAP-ONE-SIZE")

    response = client.put("/api/bag", json=items((999_999, 1), (cap.id, 1)), headers=auth())

    assert saved_rows(seeded, "user-a") == {cap.id: 1}
    assert response.json()["removed_variant_ids"] == []


def test_put_merges_a_repeated_variant_and_caps_it_at_ten(client, seeded, auth):
    cap = variant(seeded, "MOLUE-CAP-ONE-SIZE")

    client.put("/api/bag", json=items((cap.id, 8), (cap.id, 8)), headers=auth())

    assert saved_rows(seeded, "user-a") == {cap.id: 10}


@pytest.mark.parametrize("quantity", [0, 11, -2])
def test_put_rejects_a_bad_quantity(client, seeded, auth, quantity):
    assert client.put("/api/bag", json=items((1, quantity)), headers=auth()).status_code == 422


def test_put_ignores_a_price_sent_by_the_browser(client, seeded, auth):
    cap = variant(seeded, "MOLUE-CAP-ONE-SIZE")
    body = {"items": [{"variant_id": cap.id, "quantity": 1, "price_kobo": 1}]}

    response = client.put("/api/bag", json=body, headers=auth())

    assert response.json()["subtotal_kobo"] == 1_200_000


def test_bags_are_private_to_each_user(client, seeded, auth):
    hoodie = variant(seeded, "OSHODI-HOODIE-M")
    cap = variant(seeded, "MOLUE-CAP-ONE-SIZE")
    client.put("/api/bag", json=items((hoodie.id, 1)), headers=auth("user-a"))
    client.put("/api/bag", json=items((cap.id, 2)), headers=auth("user-b", "bola@example.com"))

    a = client.get("/api/bag", headers=auth("user-a")).json()
    b = client.get("/api/bag", headers=auth("user-b", "bola@example.com")).json()

    assert [line["variant_id"] for line in a["lines"]] == [hoodie.id]
    assert [line["variant_id"] for line in b["lines"]] == [cap.id]
    assert saved_rows(seeded, "user-a") == {hoodie.id: 1}


def test_one_user_replacing_their_bag_never_touches_anothers(client, seeded, auth):
    hoodie = variant(seeded, "OSHODI-HOODIE-M")
    client.put("/api/bag", json=items((hoodie.id, 2)), headers=auth("user-a"))

    client.put("/api/bag", json=items(), headers=auth("user-b", "bola@example.com"))

    assert saved_rows(seeded, "user-a") == {hoodie.id: 2}


def test_merge_adds_guest_quantities_to_the_saved_bag(client, seeded, auth):
    hoodie = variant(seeded, "OSHODI-HOODIE-M")
    cap = variant(seeded, "MOLUE-CAP-ONE-SIZE")
    client.put("/api/bag", json=items((hoodie.id, 2)), headers=auth())

    response = client.post("/api/bag/merge", json=items((hoodie.id, 3), (cap.id, 1)), headers=auth())

    assert response.status_code == 200
    assert saved_rows(seeded, "user-a") == {hoodie.id: 5, cap.id: 1}
    assert [line["quantity"] for line in response.json()["lines"]] == [5, 1]


def test_merge_into_an_empty_saved_bag_saves_the_guest_bag(client, seeded, auth):
    cap = variant(seeded, "MOLUE-CAP-ONE-SIZE")

    client.post("/api/bag/merge", json=items((cap.id, 2)), headers=auth())

    assert saved_rows(seeded, "user-a") == {cap.id: 2}


def test_merge_caps_the_total_at_ten(client, seeded, auth):
    cap = variant(seeded, "MOLUE-CAP-ONE-SIZE")
    client.put("/api/bag", json=items((cap.id, 8)), headers=auth())

    client.post("/api/bag/merge", json=items((cap.id, 5)), headers=auth())

    assert saved_rows(seeded, "user-a") == {cap.id: 10}


def test_merge_caps_the_total_at_stock(client, seeded, auth):
    hoodie = variant(seeded, "OSHODI-HOODIE-M")
    hoodie.stock = 4
    seeded.add(hoodie)
    seeded.commit()
    client.put("/api/bag", json=items((hoodie.id, 3)), headers=auth())

    client.post("/api/bag/merge", json=items((hoodie.id, 3)), headers=auth())

    assert saved_rows(seeded, "user-a") == {hoodie.id: 4}


def test_merge_does_not_touch_other_users(client, seeded, auth):
    cap = variant(seeded, "MOLUE-CAP-ONE-SIZE")
    client.put("/api/bag", json=items((cap.id, 2)), headers=auth("user-b", "bola@example.com"))

    client.post("/api/bag/merge", json=items((cap.id, 3)), headers=auth("user-a"))

    assert saved_rows(seeded, "user-b") == {cap.id: 2}
    assert saved_rows(seeded, "user-a") == {cap.id: 3}


def test_merge_rejects_a_bad_quantity(client, seeded, auth):
    assert client.post("/api/bag/merge", json=items((1, 0)), headers=auth()).status_code == 422


def test_get_reports_and_tidies_items_that_are_no_longer_sold(client, seeded, auth):
    tote_product = seeded.exec(select(Product).where(Product.slug == "route-tote")).one()
    tote = seeded.exec(select(Variant).where(Variant.product_id == tote_product.id)).one()
    cap = variant(seeded, "MOLUE-CAP-ONE-SIZE")
    client.put("/api/bag", json=items((tote.id, 1), (cap.id, 1)), headers=auth())
    tote_product.is_active = False
    seeded.add(tote_product)
    seeded.commit()

    first = client.get("/api/bag", headers=auth()).json()
    second = client.get("/api/bag", headers=auth()).json()

    assert first["removed_variant_ids"] == [tote.id]
    assert second["removed_variant_ids"] == []
    assert saved_rows(seeded, "user-a") == {cap.id: 1}


def test_get_shows_stock_changes_since_the_bag_was_saved(client, seeded, auth):
    hoodie = variant(seeded, "OSHODI-HOODIE-M")
    client.put("/api/bag", json=items((hoodie.id, 5)), headers=auth())
    hoodie.stock = 2
    seeded.add(hoodie)
    seeded.commit()

    line = client.get("/api/bag", headers=auth()).json()["lines"][0]

    assert (line["requested_quantity"], line["quantity"], line["issue"]) == (5, 2, "reduced")
