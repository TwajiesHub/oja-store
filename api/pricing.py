"""Delivery fees, totals, order numbers and delivery dates. Every amount is an integer number of kobo."""
from datetime import date, datetime, timedelta, timezone

KOBO_PER_NAIRA = 100
MAX_QUANTITY = 10

FREE_DELIVERY_THRESHOLD_KOBO = 5_000_000  # Lagos standard is free from ₦50,000
LAGOS_STANDARD_FEE_KOBO = 250_000
LAGOS_EXPRESS_FEE_KOBO = 500_000
OTHER_STATES_STANDARD_FEE_KOBO = 450_000

ORDER_NUMBER_OFFSET = 10_000

# Delivery windows, in working days (Monday to Friday) counted from the day of payment.
LAGOS_STANDARD_DAYS = (1, 3)
OTHER_STATES_STANDARD_DAYS = (3, 5)
EXPRESS_CUTOFF_HOUR = 12  # Express is same day when paid before 12:00 WAT on a working day
WAT = timezone(timedelta(hours=1))

STANDARD = "standard"
EXPRESS = "express"
DELIVERY_SPEEDS = (STANDARD, EXPRESS)


def format_naira(kobo: int) -> str:
    """For display only: 1_850_000 becomes ₦18,500. Never do arithmetic on the result."""
    naira, remainder = divmod(kobo, KOBO_PER_NAIRA)
    if remainder:
        return f"₦{naira:,}.{remainder:02d}"
    return f"₦{naira:,}"


def is_lagos(state: str) -> bool:
    return state.strip().lower() == "lagos"


def delivery_fee_kobo(state: str, speed: str, subtotal_kobo: int) -> int:
    """The delivery fee for an order. Raises ValueError for a speed that is not offered."""
    if speed not in DELIVERY_SPEEDS:
        raise ValueError(f"Unknown delivery speed: {speed}")
    if not is_lagos(state):
        if speed == EXPRESS:
            raise ValueError("Express delivery is only available in Lagos")
        return OTHER_STATES_STANDARD_FEE_KOBO
    if speed == EXPRESS:
        return LAGOS_EXPRESS_FEE_KOBO
    if subtotal_kobo >= FREE_DELIVERY_THRESHOLD_KOBO:
        return 0
    return LAGOS_STANDARD_FEE_KOBO


def free_delivery_remaining_kobo(subtotal_kobo: int) -> int:
    """How much more to spend for free Lagos standard delivery (0 once reached)."""
    return max(0, FREE_DELIVERY_THRESHOLD_KOBO - subtotal_kobo)


def order_number(order_id: int) -> str:
    return f"OJA-{ORDER_NUMBER_OFFSET + order_id}"


def add_working_days(start: date, days: int) -> date:
    """The date `days` working days after `start`. Public holidays are not counted out."""
    current = start
    counted = 0
    while counted < days:
        current += timedelta(days=1)
        if current.weekday() < 5:
            counted += 1
    return current


def expected_delivery(paid_at: datetime, state: str, speed: str) -> tuple[date, date]:
    """The earliest and latest expected delivery dates for an order paid at `paid_at`."""
    local = paid_at.astimezone(WAT)
    day = local.date()
    if speed == EXPRESS:
        same_day = day.weekday() < 5 and local.hour < EXPRESS_CUTOFF_HOUR
        arrival = day if same_day else add_working_days(day, 1)
        return arrival, arrival
    fastest, slowest = LAGOS_STANDARD_DAYS if is_lagos(state) else OTHER_STATES_STANDARD_DAYS
    return add_working_days(day, fastest), add_working_days(day, slowest)
