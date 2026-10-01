from sqlmodel import func, select

from api.models import Brand, Category, Edit, EditItem, Product, Variant
from scripts.init_db import seed


def count(session, model) -> int:
    return session.exec(select(func.count()).select_from(model)).one()


def test_seed_creates_the_full_catalogue(session):
    seed(session)

    assert count(session, Brand) == 6
    assert count(session, Category) == 4
    assert count(session, Product) == 25
    assert count(session, Edit) == 2
    assert count(session, EditItem) == 9


def test_seed_twice_creates_no_duplicates(session):
    seed(session)
    first = {m: count(session, m) for m in (Brand, Product, Variant, Edit, EditItem)}

    seed(session)

    assert {m: count(session, m) for m in first} == first


def test_seed_does_not_reset_stock_on_rerun(session):
    seed(session)
    variant = session.exec(select(Variant).where(Variant.sku == "OSHODI-HOODIE-M")).one()
    variant.stock = 3
    session.add(variant)
    session.commit()

    seed(session)

    session.refresh(variant)
    assert variant.stock == 3


def test_seed_stores_prices_in_kobo(session):
    seed(session)

    variant = session.exec(select(Variant).where(Variant.sku == "CONDUCTOR-JACKET-M")).one()

    assert variant.price_kobo == 6_800_000


def test_seed_stock_range_and_sold_out_variants(session):
    seed(session)
    stocks = [v.stock for v in session.exec(select(Variant)).all()]

    assert sorted(set(s for s in stocks if s == 0)) == [0]
    assert 1 <= stocks.count(0) <= 3
    assert all(s == 0 or 8 <= s <= 25 for s in stocks)


def test_edit_items_point_at_in_stock_variants(session):
    seed(session)

    for item in session.exec(select(EditItem)).all():
        variant = session.get(Variant, item.variant_id)
        assert variant.product_id == item.product_id
        assert variant.stock > 0


def test_add_missing_columns_upgrades_an_m0_brands_table(tmp_path):
    from sqlalchemy import inspect, text
    from api.db import make_engine
    from scripts.init_db import add_missing_columns

    engine = make_engine(f"sqlite:///{tmp_path}/m0.db")
    with engine.begin() as connection:
        connection.execute(text("CREATE TABLE brands (id INTEGER PRIMARY KEY, slug VARCHAR)"))

    add_missing_columns(engine)
    add_missing_columns(engine)  # running twice must be safe

    columns = {c["name"] for c in inspect(engine).get_columns("brands")}
    assert {"descriptor", "slogan"} <= columns
    engine.dispose()
