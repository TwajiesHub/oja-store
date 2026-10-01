import pytest
from sqlmodel import select

from api.models import Brand, Edit, Product, Variant
from scripts.init_db import seed


@pytest.fixture
def seeded(session):
    seed(session)
    return session


def slugs(response) -> list[str]:
    return [item["slug"] for item in response.json()]


def test_brands_lists_six_with_kit_fields(client, seeded):
    response = client.get("/api/brands")

    assert response.status_code == 200
    brands = response.json()
    assert [b["slug"] for b in brands] == ["danfo", "elu", "kade", "ivie", "kofa", "oke"]
    danfo = brands[0]
    assert danfo["accent"] == "#F2B705"
    assert danfo["type_pairing"] == "condensed"
    assert danfo["slogan"] == "Built for 34° and go-slow."


def test_catalogue_responses_are_cached_at_the_edge(client, seeded):
    response = client.get("/api/brands")

    assert response.headers["cache-control"] == "public, s-maxage=60, stale-while-revalidate=300"


def test_brands_hides_inactive_brand(client, seeded):
    brand = seeded.exec(select(Brand).where(Brand.slug == "kofa")).one()
    brand.is_active = False
    seeded.add(brand)
    seeded.commit()

    assert "kofa" not in slugs(client.get("/api/brands"))
    assert client.get("/api/brands/kofa").status_code == 404
    assert all(c["brand"]["slug"] != "kofa" for c in client.get("/api/products").json())


def test_brand_detail_includes_products_and_edits(client, seeded):
    response = client.get("/api/brands/danfo")

    assert response.status_code == 200
    body = response.json()
    assert len(body["products"]) == 8
    assert [e["slug"] for e in body["edits"]] == ["harmattan"]


def test_brand_detail_404_for_unknown_slug(client, seeded):
    response = client.get("/api/brands/nope")

    assert response.status_code == 404
    assert response.json() == {"detail": "Brand nope not found"}


def test_categories_are_ordered(client, seeded):
    response = client.get("/api/categories")

    assert slugs(response) == ["clothing", "beauty", "jewellery", "leather-home"]


def test_products_returns_every_active_product(client, seeded):
    assert len(client.get("/api/products").json()) == 25


def test_products_filter_by_category_and_brand(client, seeded):
    clothing = client.get("/api/products?category=clothing").json()
    danfo_leather = client.get("/api/products?category=leather-home&brand=danfo").json()

    assert clothing and all(p["category"]["slug"] == "clothing" for p in clothing)
    assert [p["slug"] for p in danfo_leather] == ["route-tote"]


def test_products_unknown_filter_returns_empty_list(client, seeded):
    response = client.get("/api/products?brand=nope")

    assert response.status_code == 200
    assert response.json() == []


def test_products_sort_by_price(client, seeded):
    low = client.get("/api/products?sort=price_asc").json()
    high = client.get("/api/products?sort=price_desc").json()

    assert low[0]["from_price_kobo"] == 350_000
    assert high[0]["from_price_kobo"] == 9_500_000
    assert [p["from_price_kobo"] for p in low] == sorted(p["from_price_kobo"] for p in low)


def test_products_sort_featured_puts_featured_first(client, seeded):
    products = client.get("/api/products?sort=featured").json()
    featured = {p.id for p in seeded.exec(select(Product).where(Product.is_featured)).all()}

    leading = [p["id"] for p in products[:len(featured)]]
    assert set(leading) == featured


def test_products_sort_newest_puts_latest_first(client, seeded):
    products = client.get("/api/products?sort=newest").json()

    assert products[0]["created_at"] >= products[-1]["created_at"]


def test_products_featured_filter(client, seeded):
    featured = client.get("/api/products?featured=true").json()

    assert featured and len(featured) < 25


def test_products_rejects_unknown_sort(client, seeded):
    assert client.get("/api/products?sort=cheapest").status_code == 422


def test_product_card_shows_from_price_and_variant_labels(client, seeded):
    shea = next(p for p in client.get("/api/products").json() if p["slug"] == "whipped-shea-butter")

    assert shea["from_price_kobo"] == 950_000
    assert shea["price_varies"] is True
    assert shea["variant_labels"] == ["100 ml", "250 ml"]
    assert shea["in_stock"] is True
    assert shea["image_url"] is None


def test_product_card_not_in_stock_when_every_variant_sold_out(client, seeded):
    for variant in seeded.exec(select(Variant).join(Product).where(Product.slug == "molue-cap")).all():
        variant.stock = 0
        seeded.add(variant)
    seeded.commit()

    cap = next(p for p in client.get("/api/products").json() if p["slug"] == "molue-cap")

    assert cap["in_stock"] is False


def test_product_detail_has_variants_brand_and_edits(client, seeded):
    response = client.get("/api/products/whipped-shea-butter")

    assert response.status_code == 200
    body = response.json()
    assert [v["label"] for v in body["variants"]] == ["100 ml", "250 ml"]
    assert body["variants"][1]["price_kobo"] == 1_800_000
    assert body["brand_full"]["slug"] == "kade"
    assert {e["slug"] for e in body["edits"]} == {"owambe", "harmattan"}


def test_product_detail_keeps_sold_out_variants(client, seeded):
    body = client.get("/api/products/conductor-jacket").json()

    xxl = next(v for v in body["variants"] if v["label"] == "XXL")
    assert xxl["stock"] == 0


def test_product_detail_404_for_unknown_slug(client, seeded):
    response = client.get("/api/products/nope")

    assert response.status_code == 404
    assert response.json() == {"detail": "Product nope not found"}


def test_product_detail_404_for_inactive_product(client, seeded):
    product = seeded.exec(select(Product).where(Product.slug == "molue-cap")).one()
    product.is_active = False
    seeded.add(product)
    seeded.commit()

    assert client.get("/api/products/molue-cap").status_code == 404


def test_edits_list_has_piece_counts(client, seeded):
    response = client.get("/api/edits")

    assert response.status_code == 200
    assert {e["slug"]: e["piece_count"] for e in response.json()} == {"owambe": 5, "harmattan": 4}


def test_edit_detail_has_ordered_items_with_default_variants(client, seeded):
    response = client.get("/api/edits/owambe")

    assert response.status_code == 200
    items = response.json()["items"]
    assert [i["position"] for i in items] == [1, 2, 3, 4, 5]
    assert items[2]["product"]["slug"] == "aso-oke-gele"
    assert items[2]["default_variant"]["label"] == "Wine"
    assert items[0]["note"].startswith("The piece every aunty")


def test_edit_detail_404_for_unknown_slug(client, seeded):
    assert client.get("/api/edits/nope").status_code == 404


def test_edit_detail_404_for_inactive_edit(client, seeded):
    edit = seeded.exec(select(Edit).where(Edit.slug == "owambe")).one()
    edit.is_active = False
    seeded.add(edit)
    seeded.commit()

    assert client.get("/api/edits/owambe").status_code == 404
