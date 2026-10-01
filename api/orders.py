"""The signed-in user's orders."""
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from api.auth import AuthUser, current_user
from api.db import get_session
from api.models import Order, OrderItem
from api.pricing import expected_delivery
from api.schemas import OrderItemOut, OrderOut

router = APIRouter(prefix="/api/orders")


def get_owned_order(session: Session, number: str, user: AuthUser) -> Order:
    """The order, or 404 if there is none and 403 if it belongs to someone else."""
    order = session.exec(select(Order).where(Order.number == number)).first()
    if order is None:
        raise HTTPException(status_code=404, detail=f"Order {number} not found")
    if order.user_id != user.user_id:
        raise HTTPException(status_code=403, detail="That order belongs to another account")
    return order


def order_out(session: Session, order: Order) -> OrderOut:
    items = session.exec(select(OrderItem).where(OrderItem.order_id == order.id).order_by(OrderItem.id)).all()
    arriving_from = arriving_to = None
    if order.paid_at is not None:
        arriving_from, arriving_to = expected_delivery(order.paid_at, order.state, order.delivery_speed)
    return OrderOut(
        number=order.number, status=order.status, email=order.email, created_at=order.created_at,
        paid_at=order.paid_at, delivery_speed=order.delivery_speed, subtotal_kobo=order.subtotal_kobo,
        delivery_kobo=order.delivery_kobo, total_kobo=order.total_kobo, full_name=order.full_name,
        phone=order.phone, address=order.address, area=order.area, state=order.state,
        arriving_from=arriving_from, arriving_to=arriving_to,
        items=[OrderItemOut(brand_name=i.brand_name, product_name=i.product_name, variant_label=i.variant_label,
                            unit_price_kobo=i.unit_price_kobo, quantity=i.quantity,
                            line_total_kobo=i.line_total_kobo) for i in items],
    )


@router.get("/{number}", response_model=OrderOut)
def get_order(number: str, user: AuthUser = Depends(current_user), session: Session = Depends(get_session)) -> OrderOut:
    return order_out(session, get_owned_order(session, number, user))
