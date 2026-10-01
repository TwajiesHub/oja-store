"""Request and response models. Money is always an integer number of kobo."""
from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator

from api.nigeria import canonical_state, normalise_phone
from api.pricing import MAX_QUANTITY

MAX_BAG_LINES = 50


class BrandOut(BaseModel):
    id: int
    slug: str
    name: str
    tagline: str
    descriptor: str
    slogan: str
    story: str
    city: str
    accent: str
    accent_text: str
    type_pairing: str
    hero_image_url: str | None


class BrandKit(BaseModel):
    """Just what a brand chip needs."""

    slug: str
    name: str
    accent: str
    accent_text: str
    type_pairing: str


class CategoryOut(BaseModel):
    id: int
    slug: str
    name: str


class VariantOut(BaseModel):
    id: int
    label: str
    price_kobo: int
    stock: int


class ProductCard(BaseModel):
    id: int
    slug: str
    name: str
    brand: BrandKit
    category: CategoryOut
    from_price_kobo: int
    # True when variants have different prices, so the card shows "from".
    price_varies: bool
    image_url: str | None
    in_stock: bool
    variant_labels: list[str]
    created_at: datetime


class EditSummary(BaseModel):
    id: int
    slug: str
    title: str
    kicker: str
    intro: str
    accent: str
    accent_text: str
    piece_count: int


class EditTag(BaseModel):
    """An edit a product appears in, shown as a coloured link on the product page."""

    slug: str
    title: str
    accent: str
    accent_text: str


class ProductDetail(ProductCard):
    # True for clothing sizes: the shopper must choose one, so none is preselected.
    needs_size: bool
    description: str
    details: str
    image_urls: list[str]
    variants: list[VariantOut]
    brand_full: BrandOut
    edits: list[EditTag]


class BrandDetail(BrandOut):
    products: list[ProductCard]
    edits: list[EditTag]


class EditItemOut(BaseModel):
    position: int
    note: str
    product: ProductCard
    default_variant: VariantOut
    variants: list[VariantOut]
    # True for clothing sizes: the shopper must pick one, so "Add all" never guesses.
    needs_size: bool
    # A sized item is available while any size is in stock; others depend on the default variant.
    available: bool


class EditDetail(EditSummary):
    items: list[EditItemOut]
    # Only items whose default variant is in stock count towards these.
    available_count: int
    total_kobo: int


class BagItemIn(BaseModel):
    variant_id: int
    quantity: int = Field(ge=1, le=MAX_QUANTITY)


class BagQuoteRequest(BaseModel):
    # Only ids and quantities are read. Any price in the request body is ignored.
    items: list[BagItemIn] = Field(max_length=MAX_BAG_LINES)


class BagQuoteLine(BaseModel):
    variant_id: int
    product_slug: str
    product_name: str
    variant_label: str
    brand: BrandKit
    unit_price_kobo: int
    stock: int
    requested_quantity: int
    # What can be bought now: the request clamped to stock and the per-variant limit.
    quantity: int
    line_total_kobo: int
    # sold_out: nothing left. reduced: fewer left than requested.
    issue: Literal["sold_out", "reduced"] | None


class BagQuote(BaseModel):
    lines: list[BagQuoteLine]
    # Variants that are unknown or no longer sold; the browser drops them.
    removed_variant_ids: list[int]
    item_count: int
    subtotal_kobo: int
    free_delivery_remaining_kobo: int


class ProfileOut(BaseModel):
    user_id: str
    email: str
    full_name: str
    phone: str
    address: str
    area: str
    state: str


class ProfileIn(BaseModel):
    """Contact and delivery details. Trimmed and checked here, so every route gets clean values."""

    full_name: str = Field(min_length=2, max_length=100)
    phone: str
    address: str = Field(min_length=5, max_length=200)
    area: str = Field(min_length=2, max_length=100)
    state: str

    @field_validator("full_name", "address", "area", "phone", "state", mode="before")
    @classmethod
    def trim(cls, value):
        return value.strip() if isinstance(value, str) else value

    @field_validator("phone")
    @classmethod
    def valid_phone(cls, value: str) -> str:
        phone = normalise_phone(value)
        if phone is None:
            raise ValueError("Enter a Nigerian mobile number, like 0803 000 0000")
        return phone

    @field_validator("state")
    @classmethod
    def valid_state(cls, value: str) -> str:
        state = canonical_state(value)
        if state is None:
            raise ValueError("Choose a Nigerian state")
        return state


DeliverySpeed = Literal["standard", "express"]


class CheckoutQuoteIn(BaseModel):
    state: str
    delivery_speed: DeliverySpeed

    @field_validator("state", mode="before")
    @classmethod
    def trim_state(cls, value):
        return value.strip() if isinstance(value, str) else value

    @field_validator("state")
    @classmethod
    def valid_state(cls, value: str) -> str:
        state = canonical_state(value)
        if state is None:
            raise ValueError("Choose a Nigerian state")
        return state


class DeliveryOption(BaseModel):
    speed: DeliverySpeed
    # None when this speed is not offered for the chosen state.
    fee_kobo: int | None
    available: bool


class CheckoutQuote(BaseModel):
    bag: BagQuote
    delivery_speed: DeliverySpeed
    delivery_kobo: int
    total_kobo: int
    delivery_options: list[DeliveryOption]


class CheckoutIn(ProfileIn):
    """Delivery details are the profile's, plus how fast and whether to remember the address."""

    delivery_speed: DeliverySpeed
    save_address: bool = True


class CheckoutOut(BaseModel):
    order_number: str
    authorization_url: str
    reference: str


class PayOut(BaseModel):
    authorization_url: str
    reference: str


class VerifyIn(BaseModel):
    reference: str = Field(min_length=1, max_length=64)


class VerifyOut(BaseModel):
    status: Literal["paid", "pending", "failed"]
    order_number: str


class OrderItemOut(BaseModel):
    brand_name: str
    product_name: str
    variant_label: str
    unit_price_kobo: int
    quantity: int
    line_total_kobo: int


class OrderSummaryOut(BaseModel):
    number: str
    status: str
    paid_at: datetime | None
    total_kobo: int
    item_count: int


class OrderOut(BaseModel):
    number: str
    status: str
    email: str
    created_at: datetime
    paid_at: datetime | None
    delivery_speed: str
    subtotal_kobo: int
    delivery_kobo: int
    total_kobo: int
    full_name: str
    phone: str
    address: str
    area: str
    state: str
    # True once the confirmation email has really been sent.
    receipt_sent: bool
    # Only once the order is paid.
    arriving_from: date | None
    arriving_to: date | None
    items: list[OrderItemOut]
