"""Public catalogue routes: brands, categories, products and edits."""
import re
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlmodel import Session, select

from api.db import get_session
from api.models import Brand, Category, Edit, EditItem, Product, Variant
from api.schemas import (
    BrandDetail, BrandKit, BrandOut, CategoryOut, EditDetail, EditItemOut, EditSummary, EditTag,
    ProductCard, ProductDetail, VariantOut,
)

router = APIRouter(prefix="/api")

# The catalogue changes rarely, so Vercel's edge can serve it for a minute. max-age=0 keeps
# browsers from holding on to it themselves, so stock shown on a page is never stale for long.
CACHE_CONTROL = "public, max-age=0, s-maxage=60, stale-while-revalidate=300"

SortOption = Literal["featured", "newest", "price_asc", "price_desc"]

# Clothing and shoe sizes. Colours, volumes and "One size" are not sizes the shopper must pick.
SIZE_LABEL = re.compile(r"^(XXS|XS|S|M|L|XL|XXL|\d+)$")


def cached(response: Response) -> None:
    response.headers["Cache-Control"] = CACHE_CONTROL


def brand_kit(brand: Brand) -> BrandKit:
    return BrandKit(slug=brand.slug, name=brand.name, accent=brand.accent,
                    accent_text=brand.accent_text, type_pairing=brand.type_pairing)


def variant_out(variant: Variant) -> VariantOut:
    return VariantOut(id=variant.id, label=variant.label, price_kobo=variant.price_kobo, stock=variant.stock)


def active_variants(session: Session, product_ids: list[int]) -> dict[int, list[Variant]]:
    """Active variants grouped by product, in display order."""
    rows = session.exec(
        select(Variant).where(Variant.product_id.in_(product_ids), Variant.is_active)
        .order_by(Variant.sort_order, Variant.id)
    ).all()
    grouped: dict[int, list[Variant]] = {}
    for variant in rows:
        grouped.setdefault(variant.product_id, []).append(variant)
    return grouped


def build_cards(session: Session, products: list[Product]) -> list[ProductCard]:
    """Turn products into cards. A product with no active variants can't be bought, so it is skipped."""
    if not products:
        return []
    brands = {b.id: b for b in session.exec(select(Brand)).all()}
    categories = {c.id: c for c in session.exec(select(Category)).all()}
    variants = active_variants(session, [p.id for p in products])

    cards = []
    for product in products:
        product_variants = variants.get(product.id)
        if not product_variants:
            continue
        prices = [v.price_kobo for v in product_variants]
        category = categories[product.category_id]
        cards.append(ProductCard(
            id=product.id, slug=product.slug, name=product.name,
            brand=brand_kit(brands[product.brand_id]),
            category=CategoryOut(id=category.id, slug=category.slug, name=category.name),
            from_price_kobo=min(prices), price_varies=len(set(prices)) > 1,
            image_url=product.image_urls[0] if product.image_urls else None,
            in_stock=any(v.stock > 0 for v in product_variants),
            variant_labels=[v.label for v in product_variants],
            created_at=product.created_at,
        ))
    return cards


def sort_cards(cards: list[ProductCard], sort: SortOption, featured_ids: set[int]) -> list[ProductCard]:
    if sort == "price_asc":
        return sorted(cards, key=lambda c: (c.from_price_kobo, c.id))
    if sort == "price_desc":
        return sorted(cards, key=lambda c: (-c.from_price_kobo, c.id))
    if sort == "newest":
        return sorted(cards, key=lambda c: (c.created_at, c.id), reverse=True)
    return sorted(cards, key=lambda c: (c.id not in featured_ids, c.id))


def active_products(session: Session, brand_slug: str | None = None, category_slug: str | None = None,
                    featured: bool | None = None) -> list[Product]:
    query = (select(Product).join(Brand, Brand.id == Product.brand_id)
             .join(Category, Category.id == Product.category_id)
             .where(Product.is_active, Brand.is_active))
    if brand_slug:
        query = query.where(Brand.slug == brand_slug)
    if category_slug:
        query = query.where(Category.slug == category_slug)
    if featured is not None:
        query = query.where(Product.is_featured == featured)
    return list(session.exec(query.order_by(Product.id)).all())


def needs_size(variants: list[Variant]) -> bool:
    return len(variants) > 1 and all(SIZE_LABEL.match(v.label) for v in variants)


def edit_tags_for_product(session: Session, product_id: int) -> list[EditTag]:
    edits = session.exec(
        select(Edit).join(EditItem, EditItem.edit_id == Edit.id)
        .where(EditItem.product_id == product_id, Edit.is_active)
        .order_by(Edit.sort_order).distinct()
    ).all()
    return [EditTag(slug=e.slug, title=e.title, accent=e.accent, accent_text=e.accent_text) for e in edits]


def edit_summary(session: Session, edit: Edit) -> EditSummary:
    count = len(session.exec(select(EditItem).where(EditItem.edit_id == edit.id)).all())
    return EditSummary(id=edit.id, slug=edit.slug, title=edit.title, kicker=edit.kicker,
                       intro=edit.intro, accent=edit.accent, accent_text=edit.accent_text, piece_count=count)


@router.get("/brands", response_model=list[BrandOut])
def list_brands(response: Response, session: Session = Depends(get_session)) -> list[Brand]:
    cached(response)
    return session.exec(select(Brand).where(Brand.is_active).order_by(Brand.sort_order)).all()


@router.get("/brands/{slug}", response_model=BrandDetail)
def get_brand(slug: str, response: Response, session: Session = Depends(get_session)) -> BrandDetail:
    brand = session.exec(select(Brand).where(Brand.slug == slug, Brand.is_active)).first()
    if brand is None:
        raise HTTPException(status_code=404, detail=f"Brand {slug} not found")
    cached(response)
    products = active_products(session, brand_slug=slug)
    featured_ids = {p.id for p in products if p.is_featured}
    cards = sort_cards(build_cards(session, products), "featured", featured_ids)
    tags = {t.slug: t for p in products for t in edit_tags_for_product(session, p.id)}
    return BrandDetail(**BrandOut.model_validate(brand, from_attributes=True).model_dump(),
                       products=cards, edits=list(tags.values()))


@router.get("/categories", response_model=list[CategoryOut])
def list_categories(response: Response, session: Session = Depends(get_session)) -> list[Category]:
    cached(response)
    return session.exec(select(Category).order_by(Category.sort_order)).all()


@router.get("/products", response_model=list[ProductCard])
def list_products(
    response: Response,
    category: str | None = None,
    brand: str | None = None,
    sort: SortOption = "featured",
    featured: bool | None = None,
    session: Session = Depends(get_session),
) -> list[ProductCard]:
    cached(response)
    products = active_products(session, brand_slug=brand, category_slug=category, featured=featured)
    featured_ids = {p.id for p in products if p.is_featured}
    return sort_cards(build_cards(session, products), sort, featured_ids)


@router.get("/products/{slug}", response_model=ProductDetail)
def get_product(slug: str, response: Response, session: Session = Depends(get_session)) -> ProductDetail:
    product = session.exec(
        select(Product).join(Brand, Brand.id == Product.brand_id)
        .where(Product.slug == slug, Product.is_active, Brand.is_active)
    ).first()
    cards = build_cards(session, [product]) if product else []
    if not cards:
        raise HTTPException(status_code=404, detail=f"Product {slug} not found")
    cached(response)
    variants = active_variants(session, [product.id])[product.id]
    brand = session.get(Brand, product.brand_id)
    return ProductDetail(
        **cards[0].model_dump(),
        description=product.description, details=product.details, image_urls=product.image_urls,
        variants=[variant_out(v) for v in variants],
        brand_full=BrandOut.model_validate(brand, from_attributes=True),
        edits=edit_tags_for_product(session, product.id),
    )


@router.get("/edits", response_model=list[EditSummary])
def list_edits(response: Response, session: Session = Depends(get_session)) -> list[EditSummary]:
    cached(response)
    edits = session.exec(select(Edit).where(Edit.is_active).order_by(Edit.sort_order)).all()
    return [edit_summary(session, e) for e in edits]


@router.get("/edits/{slug}", response_model=EditDetail)
def get_edit(slug: str, response: Response, session: Session = Depends(get_session)) -> EditDetail:
    edit = session.exec(select(Edit).where(Edit.slug == slug, Edit.is_active)).first()
    if edit is None:
        raise HTTPException(status_code=404, detail=f"Edit {slug} not found")
    cached(response)
    rows = session.exec(select(EditItem).where(EditItem.edit_id == edit.id).order_by(EditItem.position)).all()
    products = session.exec(select(Product).where(Product.id.in_([r.product_id for r in rows]))).all()
    cards = {c.id: c for c in build_cards(session, list(products))}
    variants_by_product = active_variants(session, [p.id for p in products])
    items = []
    for row in rows:
        variant = session.get(Variant, row.variant_id)
        if row.product_id in cards and variant is not None and variant.is_active:
            variants = variants_by_product[row.product_id]
            sized = needs_size(variants)
            available = any(v.stock > 0 for v in variants) if sized else variant.stock > 0
            items.append(EditItemOut(
                position=row.position, note=row.note, product=cards[row.product_id],
                default_variant=variant_out(variant), variants=[variant_out(v) for v in variants],
                needs_size=sized, available=available))
    in_stock = [i for i in items if i.available]
    return EditDetail(**edit_summary(session, edit).model_dump(), items=items,
                      available_count=len(in_stock),
                      total_kobo=sum(i.default_variant.price_kobo for i in in_stock))
