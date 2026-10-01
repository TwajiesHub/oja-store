import pytest
from sqlmodel import func, select

from api.models import BagItem, Order, OrderItem, PaymentEvent, Product, Profile, Variant
from scripts.init_db import seed
from scripts.reset_test_data import apply_reset, describe, plan_reset
from scripts.seed_data import seed_skus


@pytest.fixture
def seeded(session):
    seed(session)
    return session


def count(session, model) -> int:
    session.expire_all()
    return session.exec(select(func.count()).select_from(model)).one()


def stock_of(session, sku: str) -> int:
    session.expire_all()
    return session.exec(select(Variant).where(Variant.sku == sku)).one().stock


def make_order(session, status: str, number: str) -> Order:
    variant = session.exec(select(Variant).where(Variant.sku == "OSHODI-HOODIE-M")).one()
    product = session.get(Product, variant.product_id)
    order = Order(
        number=number, user_id="user-a", email="a@example.com", status=status, subtotal_kobo=100, delivery_kobo=0,
        total_kobo=100, delivery_speed="standard", full_name="A B", phone="+2348030000000",
        address="12 Test Street", area="Yaba", state="Lagos",
    )
    session.add(order)
    session.flush()
    session.add(OrderItem(order_id=order.id, product_id=product.id, variant_id=variant.id, brand_name="DANFO",
                          product_name=product.name, variant_label="M", unit_price_kobo=100, quantity=1,
                          line_total_kobo=100))
    session.add(PaymentEvent(reference=f"{number}-1", event="charge.success", raw={}))
    return order


@pytest.fixture
def with_test_data(seeded):
    """Two orders, an event each, a saved bag and a profile, and stock moved away from the seed."""
    make_order(seeded, "paid", "OJA-10001")
    make_order(seeded, "pending_payment", "OJA-10002")
    hoodie = seeded.exec(select(Variant).where(Variant.sku == "OSHODI-HOODIE-M")).one()
    seeded.add(BagItem(user_id="user-b", variant_id=hoodie.id, quantity=2))
    seeded.add(Profile(user_id="user-a", email="a@example.com", full_name="A B"))
    hoodie.stock = 3
    seeded.add(hoodie)
    seeded.commit()
    return seeded


def test_the_plan_describes_what_would_change_and_changes_nothing(with_test_data):
    plan = plan_reset(with_test_data)

    assert plan.orders_by_status == {"paid": 1, "pending_payment": 1}
    assert (plan.order_items, plan.payment_events, plan.bag_items, plan.profiles) == (2, 2, 1, 1)
    assert plan.stock_changes == {"OSHODI-HOODIE-M": (3, seed_skus()["OSHODI-HOODIE-M"])}
    assert count(with_test_data, Order) == 2
    assert stock_of(with_test_data, "OSHODI-HOODIE-M") == 3


def test_the_description_names_each_thing_it_would_remove(with_test_data):
    text = describe(plan_reset(with_test_data), include_profiles=False)

    assert "Orders to remove:         2 (1 paid, 1 pending_payment)" in text
    assert "Profiles:                 1 (kept)" in text
    assert "OSHODI-HOODIE-M: 3 -> 19" in text


def test_apply_removes_orders_events_and_bags_and_resets_stock(with_test_data):
    apply_reset(with_test_data)

    assert count(with_test_data, Order) == 0
    assert count(with_test_data, OrderItem) == 0
    assert count(with_test_data, PaymentEvent) == 0
    assert count(with_test_data, BagItem) == 0
    assert stock_of(with_test_data, "OSHODI-HOODIE-M") == seed_skus()["OSHODI-HOODIE-M"]


def test_a_failure_part_way_through_leaves_the_database_exactly_as_it_was(with_test_data, monkeypatch):
    """The deletes have already run when the stock reset fails: none of it may stick."""
    orders_before = count(with_test_data, Order)
    items_before = count(with_test_data, OrderItem)
    events_before = count(with_test_data, PaymentEvent)
    bags_before = count(with_test_data, BagItem)
    stock_before = stock_of(with_test_data, "OSHODI-HOODIE-M")

    class Breaks(dict):
        def __getitem__(self, key):
            raise RuntimeError("the connection dropped")

    monkeypatch.setattr("scripts.reset_test_data.seed_skus", lambda: Breaks(seed_skus()))

    with pytest.raises(RuntimeError, match="connection dropped"):
        apply_reset(with_test_data)

    assert count(with_test_data, Order) == orders_before
    assert count(with_test_data, OrderItem) == items_before
    assert count(with_test_data, PaymentEvent) == events_before
    assert count(with_test_data, BagItem) == bags_before
    assert stock_of(with_test_data, "OSHODI-HOODIE-M") == stock_before


def test_an_interrupted_reset_on_a_second_connection_is_never_seen_half_done(with_test_data, engine, monkeypatch):
    """Even before the failure is handled, another connection never sees a partly reset database."""
    from sqlmodel import Session

    seen = {}

    class Breaks(dict):
        def __getitem__(self, key):
            # The deletes have run in the reset's transaction. A separate connection must still see everything.
            with Session(engine) as other:
                seen["orders"] = other.exec(select(func.count()).select_from(Order)).one()
            raise RuntimeError("interrupted")

    monkeypatch.setattr("scripts.reset_test_data.seed_skus", lambda: Breaks(seed_skus()))

    with pytest.raises(RuntimeError):
        apply_reset(with_test_data)

    assert seen["orders"] == 2


def test_profiles_are_kept_unless_asked(with_test_data):
    apply_reset(with_test_data)

    assert count(with_test_data, Profile) == 1


def test_profiles_can_be_removed_on_request(with_test_data):
    apply_reset(with_test_data, include_profiles=True)

    assert count(with_test_data, Profile) == 0


def test_the_catalogue_is_left_alone(with_test_data):
    products_before = count(with_test_data, Product)

    apply_reset(with_test_data)

    assert count(with_test_data, Product) == products_before
    assert count(with_test_data, Variant) == len(seed_skus())


def test_variants_that_are_not_in_the_seed_keep_their_stock(with_test_data):
    extra = Variant(product_id=1, label="Extra", sku="NOT-IN-THE-SEED", price_kobo=100, stock=7)
    with_test_data.add(extra)
    with_test_data.commit()

    apply_reset(with_test_data)

    assert stock_of(with_test_data, "NOT-IN-THE-SEED") == 7
    assert "NOT-IN-THE-SEED" not in plan_reset(with_test_data).stock_changes


def test_a_second_reset_changes_nothing_more(with_test_data):
    apply_reset(with_test_data)

    plan = plan_reset(with_test_data)

    assert plan.orders == 0 and plan.stock_changes == {}
    apply_reset(with_test_data)
    assert count(with_test_data, Order) == 0


def test_an_already_clean_database_has_nothing_to_do(seeded):
    plan = plan_reset(seeded)

    assert plan.orders == 0
    assert plan.stock_changes == {}
