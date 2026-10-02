"""The launch catalogue from PRD.md. Prices are written in naira here and stored in kobo."""
import re
import zlib

KOBO_PER_NAIRA = 100
MIN_SEED_STOCK = 8
MAX_SEED_STOCK = 25

# A couple of variants start sold out so the sold-out states can be seen.
SOLD_OUT_SKUS = {"CONDUCTOR-JACKET-XXL", "CORAL-DROP-EARRINGS-14-MM-AGED"}


def slugify(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


def seed_stock(sku: str) -> int:
    """A stable stock between 8 and 25 for each sku, so reseeding never changes it."""
    if sku in SOLD_OUT_SKUS:
        return 0
    spread = MAX_SEED_STOCK - MIN_SEED_STOCK + 1
    return MIN_SEED_STOCK + zlib.crc32(sku.encode()) % spread


def seed_skus() -> dict[str, int]:
    """Every catalogue variant's sku and its seed stock, for putting stock back after testing."""
    return {
        f"{slugify(name)}-{slugify(label)}".upper(): seed_stock(f"{slugify(name)}-{slugify(label)}".upper())
        for _, name, _, _, _, variants, _ in PRODUCTS
        for label, _ in variants
    }


# Product photos, by product slug, with what each one shows (the alt text). The files are
# public/images/products/<slug>.webp (800px, for cards) and <slug>-large.webp (the product page).
# The photos are AI-generated. A product that is not listed here keeps the brand-chip placeholder.
PHOTO_DIR = "/images/products"
PHOTOS = {
    "oshodi-hoodie": "Black pullover hoodie with two thin reflective stripes across the chest, laid flat on a yellow background.",
    "olokun-wrap-dress": "Long indigo wrap dress with three-quarter sleeves and a side tie, printed with white concentric-circle adire patterns, on a dress form against a warm plaster wall.",
    "aso-oke-gele": "Folded wine-red aso-oke cloth with fine gold stripes, one length draped over the stack, on a natural linen background.",
    "kano-leather-clutch": "Tan leather envelope clutch with a flap tooled in a geometric pattern of diamonds and triangles, against a terracotta background.",
    "coral-drop-earrings": "A pair of gold-tone stud earrings, each with a round coral-red bead hanging below, on black velvet.",
    "single-strand-coral-choker": "A single strand of round coral-red beads with a gold clasp, coiled on black velvet.",
    "shea-and-baobab-oil": "Amber glass dropper bottle with a drop of golden oil falling from the lifted dropper, beside a rounded grey-brown pod, on a warm peach background.",
    "shea-lip-balm": "Open round silver tin of pale cream balm with its lid resting against the side, on warm sand-coloured paper.",
    "whipped-shea-butter": "Amber glass jar of whipped shea butter with its cream lid leaning beside it, a wooden spoon holding a scoop and two shea nuts, on a warm tan background.",
}
# night-bus-windbreaker.webp is made but not linked: the photo shows a third-party brand logo and
# other garments. Add it above, with an alt text, once it is replaced or approved.

CATEGORIES = [
    ("clothing", "Clothing"),
    ("beauty", "Beauty"),
    ("jewellery", "Jewellery"),
    ("leather-home", "Leather & home"),
]

# slug, name, tagline, city, accent, accent_text, type_pairing, descriptor, slogan, story
# The slogan is the pull line on the brand page. Keep it evocative, never a checkable claim.
BRANDS = [
    ("danfo", "DANFO", "Streetwear built for Lagos", "Lagos", "#F2B705", "#111110", "condensed",
     "Streetwear", "Built for 34° and go-slow.",
     "DANFO takes its look from the yellow buses that cross Lagos all day. The pieces are made "
     "for the same life: long commutes, loud streets, and clothes that keep up. Bold, practical "
     "and cut to be worn hard."),
    ("elu", "Elú", "Modern hand-dyed adire", "Abeokuta", "#1E2B55", "#F4EFE4", "serif",
     "Adire", "Indigo that moves with you.",
     "Elú works with adire, the indigo resist-dyed cloth of Abeokuta, and cuts it into clean, "
     "modern shapes. The patterns are dyed by hand, so no two pieces come out exactly alike."),
    ("kade", "kade", "Raw shea, whipped soft", "Lagos", "#EFE4D2", "#241A13", "soft-serif",
     "Shea skincare", "Raw shea, whipped soft.",
     "kade makes skincare from raw shea butter, whipped until it spreads easily. It is made for "
     "dry skin, dry weather and daily use."),
    ("ivie", "IVIE", "Coral and brass from Benin City", "Benin City", "#0E0B09", "#C9A24A", "didone",
     "Coral & brass", "Worn like a crown, every day.",
     "IVIE draws on the coral beads and brasswork of Benin City. Each piece is made to be worn "
     "for ceremonies and for every day after."),
    ("kofa", "Kofa", "Hand-tooled Kano leather", "Kano", "#8A4B24", "#F6E9D8", "display-serif",
     "Leather", "Leather that learns you.",
     "Kofa works in the leather tradition of Kano. Hides are cut, tooled and stitched by hand "
     "into bags, shoes and small goods that soften with use."),
    ("oke", "oke", "Aso-oke, woven in Iseyin", "Iseyin", "#1F6F6B", "#F1F5EF", "grotesk",
     "Aso-oke", "Woven for gathering.",
     "oke is woven on narrow looms in Iseyin. Aso-oke is traditionally made for celebrations, "
     "and oke also shapes it into pieces for the home."),
]

# brand slug, name, category slug, description, details, [(variant label, price in naira)], featured
PRODUCTS = [
    ("danfo", "Conductor Jacket", "clothing",
     "A boxy work jacket in the colours of a danfo conductor's day. Heavy cotton, deep pockets, "
     "a collar that stands up.",
     "Heavy cotton twill. Relaxed fit, size up for layers. Machine wash cold.",
     [(s, 68000) for s in ("S", "M", "L", "XL", "XXL")], True),
    ("danfo", "Oshodi Hoodie", "clothing",
     "A thick, soft hoodie for traffic, generator hours and cold nights. Big front pocket, "
     "no fuss.",
     "Brushed cotton fleece. Relaxed fit. Wash inside out.",
     [(s, 42000) for s in ("S", "M", "L", "XL", "XXL")], False),
    ("danfo", "Third Mainland Tee", "clothing",
     "A heavy everyday tee with the bridge's long curve across the chest. Made to be worn "
     "every week.",
     "Heavyweight cotton jersey. True to size. Machine wash cold.",
     [(s, 18500) for s in ("S", "M", "L", "XL", "XXL")], True),
    ("danfo", "Night Bus Windbreaker", "clothing",
     "A light shell for late rides home. Packs into its own pocket and shrugs off wind and "
     "a bit of rain.",
     "Lightweight nylon shell. Drawstring hem. Not fully waterproof.",
     [(s, 55000) for s in ("S", "M", "L", "XL", "XXL")], False),
    ("danfo", "Molue Cap", "clothing",
     "A six-panel cap with an embroidered bus on the front. One size, with an adjustable strap.",
     "Cotton twill. Adjustable back strap.",
     [("One size", 12000)], False),
    ("danfo", "Okada Cargo Pants", "clothing",
     "Roomy cargo pants with deep side pockets and a drawcord hem. Made for carrying a lot "
     "and moving fast.",
     "Cotton twill. Relaxed fit. Waist sizes 28 to 38.",
     [(str(s), 38000) for s in range(28, 40, 2)], False),
    ("danfo", "Route Tote", "clothing",
     "A canvas tote printed with a bus route map, with straps long enough for the shoulder. "
     "Fits a laptop and lunch.",
     "Heavy canvas, one inside pocket.",
     [("One size", 15000)], False),
    ("danfo", "Bus Stop Socks, 3 pairs", "clothing",
     "Three pairs of cotton-blend socks in one pack. Ribbed, snug and a little loud.",
     "Cotton blend. Pack of three pairs, one size.",
     [("One size", 8000)], False),
    ("elu", "Olokun Wrap Dress", "clothing",
     "A long wrap dress in deep indigo adire, tied at the waist. It moves well and fits "
     "a range of shapes.",
     "Hand-dyed cotton. Wrap closure. Dry clean or hand wash cold; the first washes may "
     "release a little dye.",
     [(s, 95000) for s in ("XS", "S", "M", "L", "XL")], True),
    ("elu", "Eleko Shirt", "clothing",
     "A straight-cut shirt in hand-dyed adire, with a soft collar and a pattern that sits "
     "differently on every piece.",
     "Hand-dyed cotton. Regular fit. Hand wash cold.",
     [(s, 48000) for s in ("S", "M", "L", "XL")], False),
    ("elu", "Alabere Trousers", "clothing",
     "Wide, easy trousers with an elastic back waist, cut from adire cloth. Smart enough "
     "for work, loose enough for the heat.",
     "Hand-dyed cotton. Wide leg. Hand wash cold.",
     [(s, 56000) for s in ("XS", "S", "M", "L", "XL")], False),
    ("kade", "Whipped Shea Butter", "beauty",
     "Raw shea butter whipped light, so it spreads easily and sinks in. Use it on skin, "
     "hands or hair ends.",
     "Raw shea butter, whipped. Keep out of direct heat.",
     [("100 ml", 9500), ("250 ml", 18000)], True),
    ("kade", "Shea and Baobab Oil", "beauty",
     "A light oil for face, body and hair. Shea and baobab, and it absorbs without leaving "
     "a film.",
     "50 ml bottle. Use a few drops on damp skin.",
     [("50 ml", 12500)], False),
    ("kade", "Shea Lip Balm", "beauty",
     "A small tin of shea balm for dry lips. Slick, plain and long-lasting.",
     "15 g tin. Apply as often as needed.",
     [("15 g", 3500)], False),
    ("kade", "The Harmattan Kit", "beauty",
     "Whipped shea butter, shea and baobab oil and a lip balm in one box, put together for "
     "the dry season.",
     "Contains the whipped shea butter, the shea and baobab oil and the lip balm.",
     [("One kit", 22000)], False),
    ("ivie", "Single-strand coral choker", "jewellery",
     "One strand of polished coral beads, worn close at the neck. Simple and striking "
     "against a bare neckline.",
     "Polished coral beads on a strong cord with a brass clasp.",
     [("One size", 85000)], True),
    ("ivie", "Coral drop earrings", "jewellery",
     "A single coral bead hanging from a brass hook. Choose polished for shine or aged for "
     "a softer, warmer look.",
     "Coral and brass. Available in 10 mm and 14 mm, polished or aged.",
     [("10 mm polished", 38000), ("10 mm aged", 38000),
      ("14 mm polished", 52000), ("14 mm aged", 52000)], False),
    ("ivie", "Brass hoops, coral tip", "jewellery",
     "Slim brass hoops, each ending in a small coral bead. Light enough to wear all day.",
     "Brass and coral. Hook closure.",
     [("One size", 34000)], False),
    ("ivie", "Twisted brass cuff", "jewellery",
     "An open brass cuff twisted into a rope. It slips on and holds its shape.",
     "Solid brass. Open back, adjusts slightly to the wrist. It may darken with wear.",
     [("One size", 46000)], False),
    ("kofa", "Kano leather clutch", "leather-home",
     "A flat clutch in tooled Kano leather with a fold-over flap. Big enough for a phone, "
     "cards and a few notes.",
     "Hand-tooled leather, fabric lining. Magnetic flap.",
     [("Tan", 36000), ("Black", 36000)], True),
    ("kofa", "Leather slides", "leather-home",
     "Open slides with a wide leather strap and a flat, cushioned sole. Break in fast and "
     "get better with wear.",
     "Leather upper and sole. Sizes 38 to 45.",
     [(str(s), 28000) for s in range(38, 46)], False),
    ("kofa", "Tooled card wallet", "leather-home",
     "A slim card wallet with a hand-tooled pattern on the front. Three slots and a "
     "pocket for notes.",
     "Hand-tooled leather. Three card slots.",
     [("Tan", 14000)], False),
    ("oke", "Aso-oke gele", "clothing",
     "A length of hand-woven aso-oke for tying a gele. Stiff enough to hold a shape and "
     "light enough to wear for hours.",
     "Hand-woven aso-oke strip. Tie it the day you wear it.",
     [("Wine", 30000), ("Indigo", 30000), ("Gold", 30000)], False),
    ("oke", "Aso-oke cushion cover", "leather-home",
     "A cushion cover in woven aso-oke stripes. It brings the loom's pattern into the sitting room.",
     "Woven aso-oke with a hidden zip. Fits a 45 cm cushion. Insert not included.",
     [("Indigo", 24000), ("Rust", 24000)], False),
    ("oke", "Woven throw", "leather-home",
     "A heavy throw woven in strips and sewn together, for the end of a sofa or a bed.",
     "Woven aso-oke strips. Spot clean.",
     [("One size", 65000)], True),
]

# slug, title, kicker, intro, accent, accent_text, items
# Each item: brand slug, product name, default variant label (None = first variant), note.
EDITS = [
    ("owambe", "The Owambe Edit", "For the party season",
     "From the church to the reception: five pieces from five Nigerian brands that do the "
     "most, without trying too hard.",
     "#5E1630", "#F6EADC",
     [("ivie", "Single-strand coral choker", None,
       "The piece every aunty will ask about. Wear it high, with a bare neckline."),
      ("elu", "Olokun Wrap Dress", None,
       "Indigo reads formal without the heat of heavy lace. Wrap it tight for the reception."),
      ("oke", "Aso-oke gele", "Wine",
       "Woven on Iseyin looms. Ask your gele artist for the classic fan."),
      ("kofa", "Kano leather clutch", "Tan",
       "Holds your phone, a powder and the envelope for spraying."),
      ("kade", "Whipped Shea Butter", "250 ml",
       "For the glow at 6pm, when the hall lights come on.")]),
    ("harmattan", "The Harmattan Edit", "November to February",
     "Shea, oil, a light jacket and lip balm for the dry, dusty months.",
     "#D9A55B", "#2A1D0E",
     [("kade", "Whipped Shea Butter", "250 ml",
       "Twice a day from November. Your elbows will thank you."),
      ("kade", "Shea and Baobab Oil", None,
       "On damp skin straight after a bath, before the dust gets to it."),
      ("kade", "Shea Lip Balm", None, "One in every bag you own."),
      ("danfo", "Night Bus Windbreaker", "M",
       "For cold harmattan mornings that turn hot by noon.")]),
]
