"""The /app-callback page hands the mobile app's sign-in code to the app. It must stay a small static page."""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PAGE = (ROOT / "public" / "app-callback.html").read_text(encoding="utf-8")


def test_the_route_is_served_by_the_static_page_before_the_catch_all():
    rewrites = json.loads((ROOT / "vercel.json").read_text(encoding="utf-8"))["rewrites"]
    sources = [rewrite["source"] for rewrite in rewrites]

    assert {"source": "/app-callback", "destination": "/app-callback.html"} in rewrites
    assert sources.index("/app-callback") < sources.index("/(.*)")


def test_the_response_is_not_cached_and_sends_no_referrer():
    headers = json.loads((ROOT / "vercel.json").read_text(encoding="utf-8"))["headers"]
    rules = {h["key"]: h["value"] for entry in headers if entry["source"] == "/app-callback" for h in entry["headers"]}

    assert rules == {"Cache-Control": "no-store", "Referrer-Policy": "no-referrer"}


def test_the_page_never_logs_stores_or_sends_the_code():
    script = re.search(r"<script>(.*)</script>", PAGE, re.S).group(1)

    for forbidden in ("console.", "localStorage", "sessionStorage", "indexedDB", "document.cookie", "fetch(", "XMLHttpRequest", "sendBeacon"):
        assert forbidden not in script


def test_the_page_loads_nothing_from_elsewhere():
    assert "<script src" not in PAGE
    assert not re.search(r"""(?:src|href)=["']https?://""", PAGE)


def test_the_page_only_forwards_to_the_installed_apps_address():
    script = re.search(r"<script>(.*)</script>", PAGE, re.S).group(1)

    assert "'oja://auth-callback'" in script
    # No other app scheme or address pattern is accepted: Expo Go (exp://) is not forwarded to.
    assert "exp:" not in script and r"exp\:" not in script
    assert "PRIVATE_HOST" not in script
    assert re.findall(r"[a-z][a-z0-9+.-]*://", script) == ["oja://"]
