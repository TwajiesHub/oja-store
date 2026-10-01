"""mark_paid(): the single, idempotent way an order becomes paid.

Both the Paystack webhook and the verify call end up here, and either can arrive first, twice,
or at the same time. Claiming the order is one atomic UPDATE, so only one caller does the work.
"""
import logging
import re

from sqlalchemy import delete, update
from sqlmodel import Session, select

from api.mail import send_order_confirmation
from api.models import BagItem, Order, OrderItem, Variant, utc_now

logger = logging.getLogger("oja.fulfilment")

CURRENCY = "NGN"
REFERENCE_PATTERN = re.compile(r"^(OJA-\d+)-(\d+)$")

PAID = "paid"
ALREADY_PAID = "already_paid"
UNKNOWN_REFERENCE = "unknown_reference"
AMOUNT_MISMATCH = "amount_mismatch"
NOT_PAYABLE = "not_payable"


def find_order(session: Session, reference: str) -> Order | None:
    """The order a reference belongs to. Any attempt up to the latest counts, because a payment
    started on attempt 1 can still finish after attempt 2 has begun."""
    match = REFERENCE_PATTERN.match(reference or "")
    if not match:
        return None
    number, attempt = match.group(1), int(match.group(2))
    order = session.exec(select(Order).where(Order.number == number)).first()
    if order is None or not 1 <= attempt <= order.payment_attempts:
        return None
    return order


def mark_paid(session: Session, reference: str, amount_kobo: int | None, currency: str | None) -> str:
    order = find_order(session, reference)
    if order is None:
        # Webhooks from previews or local runs can reach production, so an unknown reference is normal.
        logger.info("Ignoring payment for unknown reference %s", reference)
        return UNKNOWN_REFERENCE

    if amount_kobo != order.total_kobo or currency != CURRENCY:
        logger.error("Payment %s does not match order %s: got %s %s, expected %s %s",
                     reference, order.number, amount_kobo, currency, order.total_kobo, CURRENCY)
        return AMOUNT_MISMATCH

    claim = session.exec(
        update(Order)
        .where(Order.id == order.id, Order.status == "pending_payment")
        .values(status="paid", paid_at=utc_now(), updated_at=utc_now())
    )
    if claim.rowcount == 0:
        session.rollback()
        session.refresh(order)
        if order.status != "paid":
            return NOT_PAYABLE
        # Paid already, but the email may have failed last time: try again.
        send_order_confirmation(session, order.id)
        return ALREADY_PAID

    stock_issue = False
    for item in session.exec(select(OrderItem).where(OrderItem.order_id == order.id)).all():
        taken = session.exec(
            update(Variant)
            .where(Variant.id == item.variant_id, Variant.stock >= item.quantity)
            .values(stock=Variant.stock - item.quantity)
        )
        if taken.rowcount == 0:
            stock_issue = True
            logger.error("Order %s needs %s of variant %s but not enough is left", order.number,
                         item.quantity, item.variant_id)
    if stock_issue:
        session.exec(update(Order).where(Order.id == order.id).values(stock_issue=True))

    session.exec(delete(BagItem).where(BagItem.user_id == order.user_id))
    session.commit()
    logger.info("Order %s paid (reference %s)", order.number, reference)
    send_order_confirmation(session, order.id)
    return PAID
