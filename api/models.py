"""SQLModel tables. Every money column is an integer number of kobo."""
from datetime import datetime, timezone

from sqlalchemy import JSON, CheckConstraint, Column, DateTime, UniqueConstraint
from sqlalchemy.types import TypeDecorator
from sqlmodel import Field, SQLModel


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class UtcDateTime(TypeDecorator):
    """Always stores and returns timezone-aware UTC, so SQLite matches Postgres."""

    impl = DateTime(timezone=True)
    cache_ok = True

    def process_bind_param(self, value: datetime | None, dialect) -> datetime | None:
        if value is None:
            return None
        if value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc)

    def process_result_value(self, value: datetime | None, dialect) -> datetime | None:
        if value is None:
            return None
        if value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc)


def timestamp_field(nullable: bool = False) -> datetime | None:
    """A UTC timestamp column. Not-null ones default to now."""
    if nullable:
        return Field(default=None, sa_column=Column(UtcDateTime, nullable=True))
    return Field(default_factory=utc_now, sa_column=Column(UtcDateTime, nullable=False))


class Brand(SQLModel, table=True):
    __tablename__ = "brands"

    id: int | None = Field(default=None, primary_key=True)
    slug: str = Field(unique=True, index=True)
    name: str
    tagline: str
    story: str
    city: str
    # A short category label for tiles, e.g. "Streetwear", and the pull line on the brand page.
    descriptor: str = ""
    slogan: str = ""
    accent: str
    accent_text: str
    # condensed, serif, soft-serif, didone, display-serif or grotesk
    type_pairing: str
    hero_image_url: str | None = None
    sort_order: int = 0
    is_active: bool = True


class Category(SQLModel, table=True):
    __tablename__ = "categories"

    id: int | None = Field(default=None, primary_key=True)
    slug: str = Field(unique=True, index=True)
    name: str
    sort_order: int = 0


class Product(SQLModel, table=True):
    __tablename__ = "products"

    id: int | None = Field(default=None, primary_key=True)
    slug: str = Field(unique=True, index=True)
    brand_id: int = Field(foreign_key="brands.id", index=True)
    category_id: int = Field(foreign_key="categories.id", index=True)
    name: str
    description: str
    details: str = ""
    image_urls: list[str] = Field(default_factory=list, sa_column=Column(JSON, nullable=False))
    is_featured: bool = False
    is_active: bool = True
    created_at: datetime = timestamp_field()


class Variant(SQLModel, table=True):
    __tablename__ = "variants"
    __table_args__ = (CheckConstraint("stock >= 0", name="ck_variants_stock_not_negative"),)

    id: int | None = Field(default=None, primary_key=True)
    product_id: int = Field(foreign_key="products.id", index=True)
    label: str
    sku: str = Field(unique=True)
    price_kobo: int
    stock: int = 0
    sort_order: int = 0
    is_active: bool = True


class Edit(SQLModel, table=True):
    __tablename__ = "edits"

    id: int | None = Field(default=None, primary_key=True)
    slug: str = Field(unique=True, index=True)
    title: str
    # A short phrase shown beside the edit number, e.g. "For the party season".
    kicker: str = ""
    intro: str
    accent: str
    accent_text: str
    sort_order: int = 0
    is_active: bool = True


class EditItem(SQLModel, table=True):
    __tablename__ = "edit_items"

    id: int | None = Field(default=None, primary_key=True)
    edit_id: int = Field(foreign_key="edits.id", index=True)
    product_id: int = Field(foreign_key="products.id")
    # The variant that "Add all to bag" puts in the bag.
    variant_id: int = Field(foreign_key="variants.id")
    position: int
    note: str


class Profile(SQLModel, table=True):
    __tablename__ = "profiles"

    # The Supabase auth user id (a UUID string).
    user_id: str = Field(primary_key=True)
    email: str
    full_name: str = ""
    phone: str = ""
    address: str = ""
    area: str = ""
    state: str = ""
    updated_at: datetime = timestamp_field()


class BagItem(SQLModel, table=True):
    __tablename__ = "bag_items"
    __table_args__ = (
        UniqueConstraint("user_id", "variant_id", name="uq_bag_items_user_variant"),
        CheckConstraint("quantity >= 1 AND quantity <= 10", name="ck_bag_items_quantity"),
    )

    id: int | None = Field(default=None, primary_key=True)
    user_id: str = Field(index=True)
    variant_id: int = Field(foreign_key="variants.id")
    quantity: int
    updated_at: datetime = timestamp_field()


class Order(SQLModel, table=True):
    __tablename__ = "orders"

    id: int | None = Field(default=None, primary_key=True)
    # OJA-10482, set once the row has an id.
    number: str | None = Field(default=None, unique=True, index=True)
    user_id: str = Field(index=True)
    email: str
    # pending_payment, paid or cancelled
    status: str = "pending_payment"
    subtotal_kobo: int
    delivery_kobo: int
    total_kobo: int
    # standard or express
    delivery_speed: str
    full_name: str
    phone: str
    address: str
    area: str
    state: str
    # The latest attempt, e.g. OJA-10482-1.
    paystack_reference: str | None = Field(default=None, unique=True)
    payment_attempts: int = 0
    paid_at: datetime | None = timestamp_field(nullable=True)
    email_sent_at: datetime | None = timestamp_field(nullable=True)
    email_error: str | None = None
    # True when a paid order found less stock than it needed; handled by hand.
    stock_issue: bool = False
    created_at: datetime = timestamp_field()
    updated_at: datetime = timestamp_field()


class OrderItem(SQLModel, table=True):
    """Names and prices are copied at purchase time so catalogue edits never rewrite history."""

    __tablename__ = "order_items"

    id: int | None = Field(default=None, primary_key=True)
    order_id: int = Field(foreign_key="orders.id", index=True)
    product_id: int = Field(foreign_key="products.id")
    variant_id: int = Field(foreign_key="variants.id")
    brand_name: str
    product_name: str
    variant_label: str
    unit_price_kobo: int
    quantity: int
    line_total_kobo: int


class PaymentEvent(SQLModel, table=True):
    """Audit trail of every Paystack webhook we receive."""

    __tablename__ = "payment_events"

    id: int | None = Field(default=None, primary_key=True)
    reference: str = Field(index=True)
    event: str
    received_at: datetime = timestamp_field()
    raw: dict = Field(default_factory=dict, sa_column=Column(JSON, nullable=False))
