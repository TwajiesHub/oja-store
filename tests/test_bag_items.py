"""The item-level bag endpoints: add, set the quantity, remove."""
from concurrent.futures import ThreadPoolExecutor

import pytest
from fastapi.testclient import TestClient
from sqlmodel import select

from api.index import app
from api.models import BagItem, Variant
from scripts.init_db import seed

HOODIE = "OSHODI-HOODIE-M"
CAP = "MOLUE-CAP-ONE-SIZE"


@pytest.fixture
def seeded(session):
    seed(session)
    return session


def variant(session, sku: str) -> Variant:
    return session.exec(select(Variant).where(Variant.sku == sku)).one()


def set_stock(session, found: Variant, stock: int) -> None:
    found.stock = stock
    session.add(found)
    session.commit()


def saved_rows(session, user_id: str) -> dict[int, int]:
    session.expire_all()
    rows = session.exec(select(BagItem).where(BagItem.user_id == user_id)).all()
    return {row.variant_id: row.quantity for row in rows}


def add(client, auth, variant_id, quantity=1, user="user-a"):
    return client.post("/api/bag/items", json={"variant_id": variant_id, "quantity": quantity}, headers=auth(user))


@pytest.mark.parametrize("method,path,body", [
    ("post", "/api/bag/items", {"variant_id": 1, "quantity": 1}),
    ("patch", "/api/bag/items/1", {"quantity": 1}),
    ("delete", "/api/bag/items/1", None),
])
def test_item_routes_require_sign_in(client, seeded, method, path, body):
    kwargs = {} if body is None else {"json": body}

    assert getattr(client, method)(path, **kwargs).status_code == 401


def test_add_puts_a_new_line_in_the_bag_and_returns_the_priced_bag(client, seeded, auth):
    hoodie = variant(seeded, HOODIE)

    response = add(client, auth, hoodie.id, 2)

    assert response.status_code == 200
    assert response.json()["lines"][0]["variant_id"] == hoodie.id
    assert response.json()["lines"][0]["quantity"] == 2
    assert response.json()["subtotal_kobo"] == 2 * hoodie.price_kobo
    assert client.get("/api/bag", headers=auth()).json() == response.json()


def test_add_adds_to_the_quantity_already_there(client, seeded, auth):
    hoodie = variant(seeded, HOODIE)
    add(client, auth, hoodie.id, 2)

    response = add(client, auth, hoodie.id, 3)

    assert response.json()["lines"][0]["quantity"] == 5
    assert saved_rows(seeded, "user-a") == {hoodie.id: 5}


def test_add_leaves_other_lines_alone(client, seeded, auth):
    hoodie, cap = variant(seeded, HOODIE), variant(seeded, CAP)
    add(client, auth, hoodie.id, 1)

    add(client, auth, cap.id, 1)

    assert saved_rows(seeded, "user-a") == {hoodie.id: 1, cap.id: 1}


def test_add_is_capped_at_ten(client, seeded, auth):
    hoodie = variant(seeded, HOODIE)
    set_stock(seeded, hoodie, 50)
    add(client, auth, hoodie.id, 8)

    response = add(client, auth, hoodie.id, 7)

    assert response.json()["lines"][0]["quantity"] == 10


def test_add_is_capped_at_stock(client, seeded, auth):
    hoodie = variant(seeded, HOODIE)
    set_stock(seeded, hoodie, 3)
    add(client, auth, hoodie.id, 2)

    assert add(client, auth, hoodie.id, 5).json()["lines"][0]["quantity"] == 3
    assert saved_rows(seeded, "user-a") == {hoodie.id: 3}


def test_a_first_add_is_capped_at_stock_too(client, seeded, auth):
    hoodie = variant(seeded, HOODIE)
    set_stock(seeded, hoodie, 2)

    assert add(client, auth, hoodie.id, 6).json()["lines"][0]["quantity"] == 2


def test_add_a_sold_out_variant_is_a_409_and_saves_nothing(client, seeded, auth):
    hoodie = variant(seeded, HOODIE)
    set_stock(seeded, hoodie, 0)

    response = add(client, auth, hoodie.id)

    assert response.status_code == 409
    assert "sold out" in response.json()["detail"]
    assert saved_rows(seeded, "user-a") == {}


def test_add_an_unknown_variant_is_a_404(client, seeded, auth):
    assert add(client, auth, 999_999).status_code == 404


def test_add_an_inactive_variant_is_a_404(client, seeded, auth):
    hoodie = variant(seeded, HOODIE)
    hoodie.is_active = False
    seeded.add(hoodie)
    seeded.commit()

    assert add(client, auth, hoodie.id).status_code == 404


@pytest.mark.parametrize("quantity", [0, -1, 11, "two", None])
def test_add_rejects_a_bad_quantity(client, seeded, auth, quantity):
    hoodie = variant(seeded, HOODIE)

    assert add(client, auth, hoodie.id, quantity).status_code == 422


def test_add_rejects_a_missing_variant_id(client, seeded, auth):
    assert client.post("/api/bag/items", json={"quantity": 1}, headers=auth()).status_code == 422


def test_add_ignores_a_price_sent_by_the_browser(client, seeded, auth):
    hoodie = variant(seeded, HOODIE)

    response = client.post("/api/bag/items", json={"variant_id": hoodie.id, "quantity": 1, "unit_price_kobo": 1},
                           headers=auth())

    assert response.json()["subtotal_kobo"] == hoodie.price_kobo


def test_patch_sets_the_quantity(client, seeded, auth):
    hoodie = variant(seeded, HOODIE)
    add(client, auth, hoodie.id, 4)

    response = client.patch(f"/api/bag/items/{hoodie.id}", json={"quantity": 2}, headers=auth())

    assert response.status_code == 200
    assert response.json()["lines"][0]["quantity"] == 2
    assert saved_rows(seeded, "user-a") == {hoodie.id: 2}


def test_patch_is_capped_at_stock(client, seeded, auth):
    hoodie = variant(seeded, HOODIE)
    add(client, auth, hoodie.id, 1)
    set_stock(seeded, hoodie, 3)

    response = client.patch(f"/api/bag/items/{hoodie.id}", json={"quantity": 9}, headers=auth())

    assert response.json()["lines"][0]["quantity"] == 3


def test_patch_a_line_that_is_not_in_the_bag_is_a_404(client, seeded, auth):
    hoodie = variant(seeded, HOODIE)

    response = client.patch(f"/api/bag/items/{hoodie.id}", json={"quantity": 2}, headers=auth())

    assert response.status_code == 404
    assert saved_rows(seeded, "user-a") == {}


def test_patch_an_unknown_variant_is_a_404(client, seeded, auth):
    assert client.patch("/api/bag/items/999999", json={"quantity": 1}, headers=auth()).status_code == 404


@pytest.mark.parametrize("quantity", [0, 11, -3, "x"])
def test_patch_rejects_a_bad_quantity(client, seeded, auth, quantity):
    hoodie = variant(seeded, HOODIE)
    add(client, auth, hoodie.id, 1)

    response = client.patch(f"/api/bag/items/{hoodie.id}", json={"quantity": quantity}, headers=auth())

    assert response.status_code == 422
    assert saved_rows(seeded, "user-a") == {hoodie.id: 1}


def test_delete_removes_only_that_line(client, seeded, auth):
    hoodie, cap = variant(seeded, HOODIE), variant(seeded, CAP)
    add(client, auth, hoodie.id, 1)
    add(client, auth, cap.id, 2)

    response = client.delete(f"/api/bag/items/{hoodie.id}", headers=auth())

    assert response.status_code == 200
    assert [line["variant_id"] for line in response.json()["lines"]] == [cap.id]
    assert saved_rows(seeded, "user-a") == {cap.id: 2}


def test_delete_twice_is_harmless(client, seeded, auth):
    hoodie = variant(seeded, HOODIE)
    add(client, auth, hoodie.id, 1)
    client.delete(f"/api/bag/items/{hoodie.id}", headers=auth())

    response = client.delete(f"/api/bag/items/{hoodie.id}", headers=auth())

    assert response.status_code == 200
    assert response.json()["lines"] == []


def test_users_cannot_touch_each_others_bags(client, seeded, auth):
    hoodie = variant(seeded, HOODIE)
    add(client, auth, hoodie.id, 2, user="user-a")

    add(client, auth, hoodie.id, 1, user="user-b")
    assert client.patch(f"/api/bag/items/{hoodie.id}", json={"quantity": 9}, headers=auth("user-c")).status_code == 404
    client.delete(f"/api/bag/items/{hoodie.id}", headers=auth("user-c"))

    assert saved_rows(seeded, "user-a") == {hoodie.id: 2}
    assert saved_rows(seeded, "user-b") == {hoodie.id: 1}


def test_a_change_on_one_device_keeps_items_the_other_added(client, seeded, auth):
    """The reason these endpoints exist: no whole-bag overwrite."""
    hoodie, cap = variant(seeded, HOODIE), variant(seeded, CAP)
    add(client, auth, hoodie.id, 1)  # the website
    add(client, auth, cap.id, 1)  # the phone, which never saw the hoodie

    client.patch(f"/api/bag/items/{cap.id}", json={"quantity": 3}, headers=auth())

    assert saved_rows(seeded, "user-a") == {hoodie.id: 1, cap.id: 3}


def test_adds_at_the_same_moment_all_count(client, seeded, auth):
    hoodie = variant(seeded, HOODIE)
    set_stock(seeded, hoodie, 50)
    # Read the id once, here: touching `hoodie` inside a worker would refresh it through this
    # test's own session from several threads at once, which SQLite rejects.
    variant_id = hoodie.id
    headers = auth()

    def one_add(_):
        # The client fixture's database override applies app-wide, so each thread uses the test database.
        with TestClient(app) as other:
            return other.post("/api/bag/items", json={"variant_id": variant_id, "quantity": 1}, headers=headers).status_code

    with ThreadPoolExecutor(max_workers=6) as pool:
        statuses = list(pool.map(one_add, range(6)))

    assert statuses == [200] * 6
    assert saved_rows(seeded, "user-a") == {variant_id: 6}
