"""Request and response models. Money is always an integer number of kobo."""
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

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
