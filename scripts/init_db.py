"""Create the tables and seed the catalogue. Safe to run twice.

    python -m scripts.init_db              local SQLite (or DATABASE_URL)
    python -m scripts.init_db --supabase   the session pooler in DATABASE_URL_SESSION

Existing rows are updated by slug or sku. Stock is only set when a variant is
first created, so reseeding never undoes real sales.
"""
import argparse
import os

from sqlmodel import Session, SQLModel, select

from api import config
from api.db import make_engine
from api.models import Brand, Category, Edit, EditItem, Product, Variant
from scripts.seed_data import BRANDS, CATEGORIES, EDITS, KOBO_PER_NAIRA, PRODUCTS, seed_stock, slugify


def load_dotenv_for_local_use() -> None:
    """Scripts run outside uvicorn, so read .env here. Dev only; production never calls this."""
    from dotenv import load_dotenv

    load_dotenv()


def upsert(session: Session, model, lookup: dict, values: dict):
    """Update the row matching `lookup`, or create it. Returns the row."""
    row = session.exec(select(model).filter_by(**lookup)).first()
    if row is None:
        row = model(**lookup, **values)
    else:
        for field, value in values.items():
            setattr(row, field, value)
    session.add(row)
    session.flush()
    return row


def seed_categories(session: Session) -> dict[str, Category]:
    rows = {}
    for order, (slug, name) in enumerate(CATEGORIES):
        rows[slug] = upsert(session, Category, {"slug": slug}, {"name": name, "sort_order": order})
    return rows


def seed_brands(session: Session) -> dict[str, Brand]:
    rows = {}
    for order, (slug, name, tagline, city, accent, accent_text, pairing, story) in enumerate(BRANDS):
        rows[slug] = upsert(session, Brand, {"slug": slug}, {
            "name": name, "tagline": tagline, "city": city, "accent": accent,
            "accent_text": accent_text, "type_pairing": pairing, "story": story,
            "sort_order": order,
        })
    return rows


def seed_products(session: Session, brands: dict, categories: dict) -> dict[tuple[str, str], list[Variant]]:
    """Returns each product's variants, keyed by (brand slug, product name)."""
    variants_by_product = {}
    for brand_slug, name, category_slug, description, details, variants, featured in PRODUCTS:
        slug = slugify(name)
        product = upsert(session, Product, {"slug": slug}, {
            "brand_id": brands[brand_slug].id, "category_id": categories[category_slug].id,
            "name": name, "description": description, "details": details, "is_featured": featured,
        })
        rows = []
        for order, (label, price_naira) in enumerate(variants):
            sku = f"{slug}-{slugify(label)}".upper()
            existing = session.exec(select(Variant).where(Variant.sku == sku)).first()
            values = {"product_id": product.id, "label": label, "sort_order": order,
                      "price_kobo": price_naira * KOBO_PER_NAIRA}
            if existing is None:
                values["stock"] = seed_stock(sku)
            rows.append(upsert(session, Variant, {"sku": sku}, values))
        variants_by_product[(brand_slug, name)] = rows
    return variants_by_product


def seed_edits(session: Session, variants_by_product: dict) -> None:
    for order, (slug, title, intro, accent, accent_text, items) in enumerate(EDITS):
        edit = upsert(session, Edit, {"slug": slug}, {
            "title": title, "intro": intro, "accent": accent, "accent_text": accent_text,
            "sort_order": order,
        })
        for position, (brand_slug, product_name, variant_label, note) in enumerate(items, start=1):
            variants = variants_by_product[(brand_slug, product_name)]
            variant = next((v for v in variants if v.label == variant_label), variants[0])
            upsert(session, EditItem, {"edit_id": edit.id, "position": position}, {
                "product_id": variant.product_id, "variant_id": variant.id, "note": note,
            })


def seed(session: Session) -> None:
    categories = seed_categories(session)
    brands = seed_brands(session)
    variants_by_product = seed_products(session, brands, categories)
    seed_edits(session, variants_by_product)
    session.commit()


def main() -> None:
    parser = argparse.ArgumentParser(description="Create tables and seed the catalogue.")
    parser.add_argument("--supabase", action="store_true",
                        help="use DATABASE_URL_SESSION (the Supabase session pooler)")
    args = parser.parse_args()

    load_dotenv_for_local_use()
    if args.supabase:
        url = os.environ.get("DATABASE_URL_SESSION")
        if not url:
            raise SystemExit("DATABASE_URL_SESSION is not set.")
        target = "Supabase"
    else:
        # Without --supabase, never touch a remote database by accident: only a
        # SQLite DATABASE_URL is honoured, anything else falls back to local SQLite.
        url = os.environ.get("DATABASE_URL") or ""
        if not url.startswith("sqlite"):
            url = config.DEFAULT_DATABASE_URL
        target = "local SQLite"

    engine = make_engine(url)
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        seed(session)
        brands = len(session.exec(select(Brand)).all())
        products = len(session.exec(select(Product)).all())
    print(f"Seeded {target}: {brands} brands, {products} products.")


if __name__ == "__main__":
    main()
