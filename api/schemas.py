"""Request and response models. Money is always an integer number of kobo."""
from datetime import datetime

from pydantic import BaseModel


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


class EditDetail(EditSummary):
    items: list[EditItemOut]
    # Only items whose default variant is in stock count towards these.
    available_count: int
    total_kobo: int
