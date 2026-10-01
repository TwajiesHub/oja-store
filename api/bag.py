"""The bag. For now only the guest quote: prices and stock for a list of variant ids."""
from fastapi import APIRouter, Depends
from sqlmodel import Session, select

from api.catalogue import brand_kit
from api.db import get_session
from api.models import Brand, Product, Variant
from api.pricing import MAX_QUANTITY, free_delivery_remaining_kobo
from api.schemas import BagQuote, BagQuoteLine, BagQuoteRequest

router = APIRouter(prefix="/api/bag")


def merge_requested(request: BagQuoteRequest) -> dict[int, int]:
    """Total requested per variant, in first-seen order, so a repeated id cannot dodge the limit."""
    requested: dict[int, int] = {}
    for item in request.items:
        requested[item.variant_id] = requested.get(item.variant_id, 0) + item.quantity
    return requested


@router.post("/quote", response_model=BagQuote)
def quote_bag(body: BagQuoteRequest, session: Session = Depends(get_session)) -> BagQuote:
    requested = merge_requested(body)
    rows = session.exec(
        select(Variant, Product, Brand)
        .join(Product, Product.id == Variant.product_id)
        .join(Brand, Brand.id == Product.brand_id)
        .where(Variant.id.in_(list(requested)), Variant.is_active, Product.is_active, Brand.is_active)
    ).all()
    by_variant = {variant.id: (variant, product, brand) for variant, product, brand in rows}

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
