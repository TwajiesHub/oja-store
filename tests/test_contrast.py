"""Text must be readable: WCAG AA is 4.5:1 for normal text. Colours are read from the real styles,
so a change to a token is checked too."""
import re
from pathlib import Path

import pytest

from scripts.seed_data import BRANDS, EDITS

TOKENS = Path(__file__).resolve().parent.parent / "src" / "styles" / "tokens.css"
AA_NORMAL_TEXT = 4.5


def token(name: str) -> str:
    match = re.search(rf"--{name}:\s*(#[0-9a-fA-F]{{6}})", TOKENS.read_text(encoding="utf-8"))
    assert match, f"--{name} is missing from tokens.css"
    return match.group(1)


def channel(value: int) -> float:
    c = value / 255
    return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4


def luminance(hex_colour: str) -> float:
    n = int(hex_colour[1:], 16)
    return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255)


def contrast(a: str, b: str) -> float:
    lighter, darker = sorted((luminance(a), luminance(b)), reverse=True)
    return (lighter + 0.05) / (darker + 0.05)


# (text colour, background, where it is used)
STORE_PAIRS = [
    (token("ink"), token("paper"), "body text on the page"),
    (token("paper"), token("ink"), "announcement bar, buttons, footer"),
    (token("mute"), token("paper"), "secondary text and labels on the page"),
    (token("mute"), token("stone"), "labels in the bag and checkout summary panels"),
    (token("mute"), token("field"), "descriptions inside form options"),
    ("#3b3833", token("paper"), "body copy"),
    ("#3b3833", token("stone"), "copy inside stone boxes"),
    (token("ok"), token("paper"), "paid status and checkmarks"),
    (token("error"), token("paper"), "error messages"),
    (token("error"), token("stone"), "errors inside stone panels"),
    ("#5a554d", token("stone"), "product placeholder names"),
    ("#4a463f", token("stone-dark"), "cover story caption"),
    ("#9c968c", token("ink"), "footer links and notes"),
    ("#d9d4ca", "#111110", "brand story on the dark panel"),
    ("#b8b2a7", "#2a2926", "photo-to-come text on the dark panel"),
]

# BRANDS rows are (slug, name, tagline, city, accent, accent_text, ...), and EDITS rows are
# (slug, title, kicker, intro, accent, accent_text, items): the accent is at 4 and its text colour at 5.
EDIT_PAIRS = [(e[5], e[4], f"edit {e[0]}") for e in EDITS]
BRAND_PAIRS = [(b[5], b[4], f"brand {b[0]}") for b in BRANDS]


@pytest.mark.parametrize(("text", "background", "where"), STORE_PAIRS, ids=[p[2] for p in STORE_PAIRS])
def test_store_text_colours_meet_aa(text, background, where):
    assert contrast(text, background) >= AA_NORMAL_TEXT, f"{where}: {text} on {background}"


@pytest.mark.parametrize(("text", "accent", "where"), BRAND_PAIRS + EDIT_PAIRS, ids=[p[2] for p in BRAND_PAIRS + EDIT_PAIRS])
def test_brand_and_edit_colours_meet_aa(text, accent, where):
    assert contrast(text, accent) >= AA_NORMAL_TEXT, f"{where}: {text} on {accent}"


def test_the_flipped_chip_for_a_light_brand_is_readable():
    cream, brown = "#EFE4D2", "#241A13"  # kade's chip swaps its colours to stay visible on the stone placeholder

    assert contrast(cream, brown) >= AA_NORMAL_TEXT
    assert contrast(brown, token("stone")) >= AA_NORMAL_TEXT
