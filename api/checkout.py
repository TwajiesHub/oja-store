"""Checkout: turn the saved bag into an order and send the shopper to Paystack to pay."""
import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from api import config, paystack
from api.auth import AuthUser, current_user
from api.bag import purchasable_variants, quote_items, saved_quantities
from api.db import get_session
from api.fulfilment import ALREADY_PAID, PAID, find_order, mark_paid
from api.models import Order, OrderItem, Profile, Variant, utc_now
from api.orders import get_owned_order
from api.pricing import DELIVERY_SPEEDS, delivery_fee_kobo, order_number
from api.schemas import (
    CheckoutIn, CheckoutOut, CheckoutQuote, CheckoutQuoteIn, DeliveryOption, PayOut, VerifyIn, VerifyOut,
)

logger = logging.getLogger("oja.checkout")

router = APIRouter(prefix="/api")

# What Paystack's transaction status means for the shopper.
FAILED_STATUSES = {"failed", "abandoned", "reversed"}


def fee_or_422(state: str, speed: str, subtotal_kobo: int) -> int:
    try:
        return delivery_fee_kobo(state, speed, subtotal_kobo)
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error


def delivery_options(state: str, subtotal_kobo: int) -> list[DeliveryOption]:
    """Every delivery speed with its fee for this state, or unavailable (express outside Lagos)."""
    options = []
    for speed in DELIVERY_SPEEDS:
        try:
            options.append(DeliveryOption(speed=speed, fee_kobo=delivery_fee_kobo(state, speed, subtotal_kobo), available=True))
        except ValueError:
            options.append(DeliveryOption(speed=speed, fee_kobo=None, available=False))
    return options


def stock_problem(name: str, label: str, stock: int, wanted: int) -> str | None:
    if stock == 0:
        return f"{name} ({label}) is sold out"
    if stock < wanted:
        return f"{name} ({label}) has only {stock} left"
    return None


def start_payment_attempt(session: Session, order: Order) -> tuple[str, str]:
    """Begins a new Paystack attempt for an unpaid order: returns (authorization_url, reference)."""
    attempt = order.payment_attempts + 1
    reference = f"{order.number}-{attempt}"
    complete_url = f"{config.app_base_url()}/checkout/complete"
    try:
        url = paystack.initialize_transaction(
            email=order.email, amount_kobo=order.total_kobo, reference=reference,
            callback_url=complete_url,
            # Where Paystack sends someone who closes or cancels its page: the payment screen
            # then asks Paystack what happened and offers "Try payment again".
            metadata={"order_number": order.number, "user_id": order.user_id,
                      "cancel_action": f"{complete_url}?reference={reference}"},
        )
    except paystack.PaystackError as error:
        raise HTTPException(status_code=502, detail="We couldn't reach Paystack. Try again in a moment.") from error
    order.payment_attempts = attempt
    order.paystack_reference = reference
    order.updated_at = utc_now()
    session.add(order)
    session.commit()
    return url, reference


def save_profile(session: Session, user: AuthUser, body: CheckoutIn) -> None:
    profile = session.get(Profile, user.user_id) or Profile(user_id=user.user_id, email=user.email)
    profile.email = user.email
    profile.full_name, profile.phone, profile.address = body.full_name, body.phone, body.address
    profile.area, profile.state, profile.updated_at = body.area, body.state, utc_now()
    session.add(profile)


@router.post("/checkout/quote", response_model=CheckoutQuote)
def quote_checkout(body: CheckoutQuoteIn, user: AuthUser = Depends(current_user),
                   session: Session = Depends(get_session)) -> CheckoutQuote:
    """The bag with delivery and total for a chosen state and speed, so the page shows server numbers."""
    quote = quote_items(session, saved_quantities(session, user.user_id))
    delivery = fee_or_422(body.state, body.delivery_speed, quote.subtotal_kobo)
    return CheckoutQuote(
        bag=quote, delivery_speed=body.delivery_speed, delivery_kobo=delivery,
        total_kobo=quote.subtotal_kobo + delivery, delivery_options=delivery_options(body.state, quote.subtotal_kobo),
    )


@router.post("/checkout", response_model=CheckoutOut)
def create_checkout(body: CheckoutIn, user: AuthUser = Depends(current_user),
                    session: Session = Depends(get_session)) -> CheckoutOut:
    requested = saved_quantities(session, user.user_id)
    if not requested:
        raise HTTPException(status_code=409, detail="Your bag is empty")

    # Prices and stock come from the database, never from the browser.
    by_variant = purchasable_variants(session, list(requested))
    for variant_id, wanted in requested.items():
        if variant_id not in by_variant:
            raise HTTPException(status_code=409, detail="Something in your bag is no longer sold. Remove it to continue.")
        variant, product, _ = by_variant[variant_id]
        problem = stock_problem(product.name, variant.label, variant.stock, wanted)
        if problem:
            raise HTTPException(status_code=409, detail=problem)

    subtotal = sum(by_variant[vid][0].price_kobo * qty for vid, qty in requested.items())
    delivery = fee_or_422(body.state, body.delivery_speed, subtotal)

    order = Order(
        user_id=user.user_id, email=user.email, status="pending_payment", subtotal_kobo=subtotal,
        delivery_kobo=delivery, total_kobo=subtotal + delivery, delivery_speed=body.delivery_speed,
        full_name=body.full_name, phone=body.phone, address=body.address, area=body.area, state=body.state,
    )
    session.add(order)
    session.flush()
    order.number = order_number(order.id)
    for variant_id, quantity in requested.items():
        variant, product, brand = by_variant[variant_id]
        session.add(OrderItem(
            order_id=order.id, product_id=product.id, variant_id=variant.id, brand_name=brand.name,
            product_name=product.name, variant_label=variant.label, unit_price_kobo=variant.price_kobo,
            quantity=quantity, line_total_kobo=variant.price_kobo * quantity,
        ))
    if body.save_address:
        save_profile(session, user, body)
    session.commit()

    url, reference = start_payment_attempt(session, order)
    return CheckoutOut(order_number=order.number, authorization_url=url, reference=reference)


@router.post("/orders/{number}/pay", response_model=PayOut)
def pay_order_again(number: str, user: AuthUser = Depends(current_user),
                    session: Session = Depends(get_session)) -> PayOut:
    """A new Paystack attempt for an order that is still unpaid."""
    order = get_owned_order(session, number, user)
    if order.status != "pending_payment":
        raise HTTPException(status_code=409, detail=f"Order {number} is already {order.status.replace('_', ' ')}")

    for item in session.exec(select(OrderItem).where(OrderItem.order_id == order.id)).all():
        variant = session.get(Variant, item.variant_id)
        problem = stock_problem(item.product_name, item.variant_label, variant.stock if variant else 0, item.quantity)
        if problem:
            raise HTTPException(status_code=409, detail=problem)

    url, reference = start_payment_attempt(session, order)
    return PayOut(authorization_url=url, reference=reference)


@router.post("/payments/verify", response_model=VerifyOut)
def verify_payment(body: VerifyIn, user: AuthUser = Depends(current_user),
                   session: Session = Depends(get_session)) -> VerifyOut:
    """Asks Paystack what happened. The browser's return from Paystack proves nothing by itself."""
    order = find_order(session, body.reference)
    if order is None:
        raise HTTPException(status_code=404, detail=f"Payment {body.reference} not found")
    if order.user_id != user.user_id:
        raise HTTPException(status_code=403, detail="That payment belongs to another account")
    if order.status == "paid":
        return VerifyOut(status="paid", order_number=order.number)

    try:
        result = paystack.verify_transaction(body.reference)
    except paystack.PaystackError:
        # A hiccup talking to Paystack is not a failed payment; the page asks again shortly.
        return VerifyOut(status="pending", order_number=order.number)

    status = result["status"]
    if status == "success":
        outcome = mark_paid(session, body.reference, result["amount"], result["currency"])
        return VerifyOut(status="paid" if outcome in (PAID, ALREADY_PAID) else "pending", order_number=order.number)
    if status in FAILED_STATUSES:
        return VerifyOut(status="failed", order_number=order.number)
    return VerifyOut(status="pending", order_number=order.number)
