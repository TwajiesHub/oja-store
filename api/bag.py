"""The bag: a public quote for guests, and the signed-in user's saved bag."""
from collections.abc import Callable

from fastapi import APIRouter, Depends
from sqlalchemy import delete
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, select

from api.auth import AuthUser, current_user
from api.catalogue import brand_kit
from api.db import get_session
from api.models import BagItem, Brand, Product, Variant, utc_now
from api.pricing import MAX_QUANTITY, free_delivery_remaining_kobo
from api.schemas import BagQuote, BagQuoteLine, BagQuoteRequest

router = APIRouter(prefix="/api/bag")


def merge_requested(request: BagQuoteRequest) -> dict[int, int]:
    """Total requested per variant, in first-seen order, so a repeated id cannot dodge the limit."""
    requested: dict[int, int] = {}
    for item in request.items:
        requested[item.variant_id] = requested.get(item.variant_id, 0) + item.quantity
    return requested


def purchasable_variants(session: Session, variant_ids: list[int]) -> dict[int, tuple[Variant, Product, Brand]]:
    """Variants that can be sold right now: the variant, its product and its brand are all active."""
    rows = session.exec(
        select(Variant, Product, Brand)
        .join(Product, Product.id == Variant.product_id)
        .join(Brand, Brand.id == Product.brand_id)
        .where(Variant.id.in_(variant_ids), Variant.is_active, Product.is_active, Brand.is_active)
    ).all()
    return {variant.id: (variant, product, brand) for variant, product, brand in rows}


def quote_items(session: Session, requested: dict[int, int]) -> BagQuote:
    """Prices a bag from the database. Prices and stock never come from the browser."""
    by_variant = purchasable_variants(session, list(requested))

    lines: list[BagQuoteLine] = []
    removed: list[int] = []
    for variant_id, wanted in requested.items():
        if variant_id not in by_variant:
            removed.append(variant_id)
            continue
        variant, product, brand = by_variant[variant_id]
        allowed = min(wanted, variant.stock, MAX_QUANTITY)
        issue = "sold_out" if variant.stock == 0 else "reduced" if allowed < wanted else None
        lines.append(BagQuoteLine(
            variant_id=variant.id, product_slug=product.slug, product_name=product.name,
            variant_label=variant.label, brand=brand_kit(brand), unit_price_kobo=variant.price_kobo,
            stock=variant.stock, requested_quantity=wanted, quantity=allowed,
            line_total_kobo=variant.price_kobo * allowed, issue=issue,
        ))

    subtotal = sum(line.line_total_kobo for line in lines)
    return BagQuote(
        lines=lines, removed_variant_ids=removed, item_count=sum(line.quantity for line in lines),
        subtotal_kobo=subtotal, free_delivery_remaining_kobo=free_delivery_remaining_kobo(subtotal),
    )


def storable_quantity(wanted: int, stock: int) -> int:
    """What to save: capped at stock and 10. A sold-out item keeps 1, so the shopper still sees it flagged."""
    limit = min(stock, MAX_QUANTITY) if stock > 0 else 1
    return max(1, min(wanted, limit))


def saved_quantities(session: Session, user_id: str) -> dict[int, int]:
    rows = session.exec(select(BagItem).where(BagItem.user_id == user_id).order_by(BagItem.id)).all()
    return {row.variant_id: row.quantity for row in rows}


def save_bag(session: Session, user_id: str, wanted: dict[int, int]) -> dict[int, int]:
    """Replaces the user's saved bag with `wanted`, dropping anything no longer sold. Returns what was saved."""
    by_variant = purchasable_variants(session, list(wanted))
    session.exec(delete(BagItem).where(BagItem.user_id == user_id))
    saved: dict[int, int] = {}
    for variant_id, quantity in wanted.items():
        if variant_id not in by_variant:
            continue
        saved[variant_id] = storable_quantity(quantity, by_variant[variant_id][0].stock)
        session.add(BagItem(user_id=user_id, variant_id=variant_id, quantity=saved[variant_id], updated_at=utc_now()))
    session.commit()
    return saved


def save_with_retry(session: Session, user_id: str, wanted_for: Callable[[], dict[int, int]]) -> dict[int, int]:
    """Two tabs saving at once can collide on the unique (user, variant) key; the second tries again."""
    try:
        return save_bag(session, user_id, wanted_for())
    except IntegrityError:
        session.rollback()
        return save_bag(session, user_id, wanted_for())


@router.post("/quote", response_model=BagQuote)
def quote_bag(body: BagQuoteRequest, session: Session = Depends(get_session)) -> BagQuote:
    return quote_items(session, merge_requested(body))


@router.get("", response_model=BagQuote)
def get_bag(user: AuthUser = Depends(current_user), session: Session = Depends(get_session)) -> BagQuote:
    quote = quote_items(session, saved_quantities(session, user.user_id))
    if quote.removed_variant_ids:
        # Tidy up items that are no longer sold, so they are reported once.
        session.exec(delete(BagItem).where(
            BagItem.user_id == user.user_id, BagItem.variant_id.in_(quote.removed_variant_ids)))
        session.commit()
    return quote


@router.put("", response_model=BagQuote)
def replace_bag(body: BagQuoteRequest, user: AuthUser = Depends(current_user),
                session: Session = Depends(get_session)) -> BagQuote:
    requested = merge_requested(body)
    saved = save_with_retry(session, user.user_id, lambda: requested)
    return quote_items(session, saved)


@router.post("/merge", response_model=BagQuote)
def merge_bag(body: BagQuoteRequest, user: AuthUser = Depends(current_user),
              session: Session = Depends(get_session)) -> BagQuote:
    """Adds a guest bag into the saved one when someone signs in: quantities add up, capped at stock and 10."""
    incoming = merge_requested(body)

    def combined() -> dict[int, int]:
        merged = saved_quantities(session, user.user_id)
        for variant_id, quantity in incoming.items():
            merged[variant_id] = merged.get(variant_id, 0) + quantity
        return merged

    saved = save_with_retry(session, user.user_id, combined)
    return quote_items(session, saved)
