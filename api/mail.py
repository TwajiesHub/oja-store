"""The order confirmation email: building it, and sending it through Mailgun.

An order that is paid stays paid whatever happens here. A failed send is logged and kept on the
order, and the next verify or webhook call for that order tries again.
"""
import logging
from dataclasses import dataclass
from html import escape
from pathlib import Path
from string import Template

import httpx
from sqlalchemy import update
from sqlmodel import Session, select

from api import config
from api.nigeria import format_phone
from api.models import Order, OrderItem, utc_now
from api.pricing import EXPRESS, WAT, expected_delivery, format_arrival, format_day, format_naira

logger = logging.getLogger("oja.mail")

REQUEST_TIMEOUT_SECONDS = 10
TEMPLATE_DIR = Path(__file__).parent / "emails"
MAX_ERROR_LENGTH = 500

SENT = "sent"
ALREADY_SENT = "already_sent"
FAILED = "failed"
NOT_PAID = "not_paid"

MONO = "font-family:Consolas,'Courier New',monospace;"


class MailgunError(Exception):
    """The email could not be sent. The message is safe to store and log."""


@dataclass(frozen=True)
class EmailContent:
    subject: str
    html: str
    text: str


def send_email(*, to: str, subject: str, html: str, text: str) -> None:
    """One Mailgun call. Tests replace this function."""
    if not (config.MAILGUN_API_KEY and config.MAILGUN_DOMAIN and config.MAILGUN_FROM):
        raise MailgunError("Mailgun is not configured")
    if "@" not in config.MAILGUN_FROM:
        raise MailgunError("MAILGUN_FROM must look like: Oja <orders@your-domain>")
    try:
        response = httpx.post(
            f"{config.MAILGUN_API_BASE.rstrip('/')}/v3/{config.MAILGUN_DOMAIN}/messages",
            auth=("api", config.MAILGUN_API_KEY),
            data={"from": config.MAILGUN_FROM, "to": to, "subject": subject, "text": text, "html": html},
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
    except httpx.HTTPError as error:
        raise MailgunError(f"Could not reach Mailgun ({type(error).__name__})") from error
    if response.status_code != 200:
        try:
            reason = str(response.json().get("message", ""))
        except ValueError:
            reason = ""
        raise MailgunError(f"Mailgun refused the email (HTTP {response.status_code}): {reason}"[:MAX_ERROR_LENGTH])


def _read_template(name: str) -> Template:
    return Template((TEMPLATE_DIR / name).read_text(encoding="utf-8"))


def _item_name(item: OrderItem) -> str:
    variant = "" if item.variant_label.startswith("One ") else f" · {item.variant_label}"
    return f"{item.product_name}{variant} · × {item.quantity}"


def _group_by_brand(items: list[OrderItem]) -> dict[str, list[OrderItem]]:
    groups: dict[str, list[OrderItem]] = {}
    for item in items:
        groups.setdefault(item.brand_name, []).append(item)
    return groups


def _items_html(groups: dict[str, list[OrderItem]]) -> str:
    rows = []
    for brand, brand_items in groups.items():
        rows.append(
            f'<tr><td colspan="2" style="padding-top:14px;{MONO}font-size:11px;letter-spacing:1.5px;'
            f'text-transform:uppercase;color:#6A645B;">{escape(brand)}</td></tr>'
        )
        for item in brand_items:
            rows.append(
                f'<tr><td style="padding:10px 0;border-bottom:1px solid #D9D3C7;font-size:15px;">{escape(_item_name(item))}</td>'
                f'<td align="right" style="padding:10px 0;border-bottom:1px solid #D9D3C7;{MONO}font-size:15px;">'
                f"{escape(format_naira(item.line_total_kobo))}</td></tr>"
            )
    return "\n".join(rows)


def _items_text(groups: dict[str, list[OrderItem]]) -> str:
    lines = []
    for brand, brand_items in groups.items():
        lines.append(brand.upper())
        lines.extend(f"  {_item_name(item)}  {format_naira(item.line_total_kobo)}" for item in brand_items)
    return "\n".join(lines)


def build_confirmation(order: Order, items: list[OrderItem], base_url: str, contact_email: str) -> EmailContent:
    """Everything shown comes from the saved order. Every piece of customer text is escaped."""
    groups = _group_by_brand(items)
    brands = len(groups)
    first_name = order.full_name.strip().split()[0] if order.full_name.strip() else "there"
    arriving_from, arriving_to = expected_delivery(order.paid_at, order.state, order.delivery_speed)
    expected = format_arrival(arriving_from, arriving_to)
    paid_day = format_day(order.paid_at.astimezone(WAT).date(), with_year=True)
    delivery_label = f"Delivery · {'Express' if order.delivery_speed == EXPRESS else 'Standard'}"
    delivery_price = "Free" if order.delivery_kobo == 0 else format_naira(order.delivery_kobo)
    total = format_naira(order.total_kobo)
    order_url = f"{base_url}/orders/{order.number}"
    headline = f"Thank you, {first_name}. Your order is confirmed."
    brand_word = "brand" if brands == 1 else "brands"
    intro_text = (
        f"We've received your payment of {total}. Your order has pieces from {brands} Nigerian {brand_word}, "
        "and we'll deliver them together."
    )
    help_text = (
        f"Write to {contact_email} with your order number. " if contact_email else "Contact the shop with your order number. "
    ) + "Returns are accepted within 7 days of delivery on unused items."
    help_html = escape(help_text)
    if contact_email:
        help_html = help_html.replace(escape(contact_email), f'<a href="mailto:{escape(contact_email)}" style="color:#121110;">{escape(contact_email)}</a>')

    deliver_lines = [order.full_name, order.address, f"{order.area}, {order.state}", format_phone(order.phone)]
    delivery_note = "Dates are working days from your payment."
    values = {
        "title": f"Your Ọjà order {order.number}",
        "preheader": f"Order {order.number} is confirmed. Expected {expected}.",
        "order_line": escape(f"Order {order.number} · {paid_day}"),
        "headline": escape(headline),
        "intro_html": escape(intro_text).replace(escape(total), f"<strong>{escape(total)}</strong>", 1),
        "intro_text": intro_text,
        "order_url": escape(order_url, quote=True),
        "items_html": _items_html(groups),
        "items_text": _items_text(groups),
        "subtotal": escape(format_naira(order.subtotal_kobo)),
        "delivery_label": escape(delivery_label),
        "delivery_price": escape(delivery_price),
        "total": escape(total),
        "deliver_html": "<br>".join(escape(line) for line in deliver_lines),
        "deliver_text": "\n".join(deliver_lines),
        "expected": escape(expected),
        "delivery_note": escape(delivery_note),
        "help_html": help_html,
        "help_text": help_text,
        "number": order.number,
        "date": paid_day,
    }
    text_values = {
        **values, "subtotal": format_naira(order.subtotal_kobo), "delivery_label": delivery_label,
        "delivery_price": delivery_price, "total": total, "expected": expected, "delivery_note": delivery_note,
        "headline": headline, "order_url": order_url,
    }
    return EmailContent(
        subject=f"Your Ọjà order {order.number} is confirmed",
        html=_read_template("order_confirmation.html").substitute(values),
        text=_read_template("order_confirmation.txt").substitute(text_values),
    )


def send_order_confirmation(session: Session, order_id: int) -> str:
    """Sends the confirmation for a paid order, once. Never raises: a failure is stored for the next try."""
    order = session.get(Order, order_id)
    if order is None or order.status != "paid" or order.paid_at is None:
        return NOT_PAID

    # Claim the send first, in one atomic UPDATE, so two callers at once cannot both send it.
    claim = session.exec(
        update(Order).where(Order.id == order_id, Order.email_sent_at.is_(None)).values(email_sent_at=utc_now())
    )
    session.commit()
    if claim.rowcount == 0:
        return ALREADY_SENT

    session.refresh(order)
    try:
        if not order.email:
            raise MailgunError("The order has no email address")
        items = list(session.exec(select(OrderItem).where(OrderItem.order_id == order_id).order_by(OrderItem.id)).all())
        content = build_confirmation(order, items, config.app_base_url(), config.CONTACT_EMAIL)
        send_email(to=order.email, subject=content.subject, html=content.html, text=content.text)
    except Exception as error:  # noqa: BLE001 - nothing here may undo or block a paid order
        logger.error("Confirmation email for %s failed: %s", order.number, str(error)[:MAX_ERROR_LENGTH])
        session.exec(update(Order).where(Order.id == order_id).values(
            email_sent_at=None, email_error=str(error)[:MAX_ERROR_LENGTH]))
        session.commit()
        return FAILED

    session.exec(update(Order).where(Order.id == order_id).values(email_error=None))
    session.commit()
    logger.info("Confirmation email sent for %s", order.number)
    return SENT
