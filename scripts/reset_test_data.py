"""Removes test orders and puts stock back to the seed values, before submission.

    python -m scripts.reset_test_data                       look at local SQLite (changes nothing)
    python -m scripts.reset_test_data --apply               do it on local SQLite
    python -m scripts.reset_test_data --supabase            look at Supabase (changes nothing)
    python -m scripts.reset_test_data --supabase --apply    do it on Supabase

By default this only PRINTS what it would do. Nothing is changed without --apply, and the live
database is only touched with --supabase (which uses DATABASE_URL_SESSION). Run it on Supabase
only when you mean to.

What it removes: every order and its items, the payment events, and every saved bag.
What it resets: the stock of every catalogue variant that is in the seed.
What it keeps: the catalogue, and the profiles (real people's saved addresses), unless you
add --profiles. Variants that are not in the seed are left alone.
"""
import argparse
import os
from dataclasses import dataclass, field

from sqlalchemy import delete
from sqlmodel import Session, func, select

from api.db import make_engine
from api.models import BagItem, Order, OrderItem, PaymentEvent, Profile, Variant
from scripts.seed_data import seed_skus


@dataclass
class ResetPlan:
    orders_by_status: dict[str, int] = field(default_factory=dict)
    order_items: int = 0
    payment_events: int = 0
    bag_items: int = 0
    profiles: int = 0
    # sku -> (stock now, stock after the reset), only for variants whose stock would change
    stock_changes: dict[str, tuple[int, int]] = field(default_factory=dict)

    @property
    def orders(self) -> int:
        return sum(self.orders_by_status.values())


def count(session: Session, model) -> int:
    return session.exec(select(func.count()).select_from(model)).one()


def plan_reset(session: Session) -> ResetPlan:
    """Works out what a reset would change, without changing anything."""
    plan = ResetPlan()
    for status, total in session.exec(select(Order.status, func.count()).group_by(Order.status)).all():
        plan.orders_by_status[status] = total
    plan.order_items = count(session, OrderItem)
    plan.payment_events = count(session, PaymentEvent)
    plan.bag_items = count(session, BagItem)
    plan.profiles = count(session, Profile)

    seed = seed_skus()
    for variant in session.exec(select(Variant).where(Variant.sku.in_(list(seed)))).all():
        if variant.stock != seed[variant.sku]:
            plan.stock_changes[variant.sku] = (variant.stock, seed[variant.sku])
    return plan


def apply_reset(session: Session, include_profiles: bool = False) -> None:
    """Does the reset in one transaction: either all of it happens or none of it."""
    seed = seed_skus()
    # Children first, so the foreign keys are never broken.
    session.exec(delete(PaymentEvent))
    session.exec(delete(OrderItem))
    session.exec(delete(Order))
    session.exec(delete(BagItem))
    if include_profiles:
        session.exec(delete(Profile))
    for variant in session.exec(select(Variant).where(Variant.sku.in_(list(seed)))).all():
        variant.stock = seed[variant.sku]
        session.add(variant)
    session.commit()


def describe(plan: ResetPlan, include_profiles: bool) -> str:
    by_status = ", ".join(f"{total} {status}" for status, total in sorted(plan.orders_by_status.items())) or "none"
    lines = [
        f"Orders to remove:         {plan.orders} ({by_status})",
        f"Order items to remove:    {plan.order_items}",
        f"Payment events to remove: {plan.payment_events}",
        f"Saved bags to remove:     {plan.bag_items} items",
        f"Profiles:                 {plan.profiles} ({'will be removed' if include_profiles else 'kept'})",
        f"Variants whose stock goes back to the seed value: {len(plan.stock_changes)}",
    ]
    for sku, (now, after) in sorted(plan.stock_changes.items())[:20]:
        lines.append(f"    {sku}: {now} -> {after}")
    if len(plan.stock_changes) > 20:
        lines.append(f"    ... and {len(plan.stock_changes) - 20} more")
    return "\n".join(lines)


def main() -> None:
    parser = argparse.ArgumentParser(description="Remove test orders and reset stock to the seed values.")
    parser.add_argument("--supabase", action="store_true", help="use DATABASE_URL_SESSION (the live Supabase database)")
    parser.add_argument("--apply", action="store_true", help="actually make the changes (the default only prints them)")
    parser.add_argument("--profiles", action="store_true", help="also remove saved profiles")
    args = parser.parse_args()

    from dotenv import load_dotenv  # development only; production never runs this script

    load_dotenv()
    if args.supabase:
        url = os.environ.get("DATABASE_URL_SESSION")
        if not url:
            raise SystemExit("DATABASE_URL_SESSION is not set.")
        target = "Supabase (the live database)"
    else:
        url = os.environ.get("DATABASE_URL") or ""
        if not url.startswith("sqlite"):
            url = "sqlite:///./oja.db"
        target = "local SQLite"

    engine = make_engine(url)
    with Session(engine) as session:
        plan = plan_reset(session)
        print(f"Target: {target}\n")
        print(describe(plan, args.profiles))
        if not args.apply:
            print("\nNothing was changed. Add --apply to do this.")
            return
        apply_reset(session, include_profiles=args.profiles)
        print(f"\nDone. The test data on {target} is gone and stock is back to the seed values.")


if __name__ == "__main__":
    main()
