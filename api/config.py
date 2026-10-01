"""Reads environment variables once. Nothing else in the app touches os.environ.

Locally, uvicorn loads .env for us (--env-file .env). On Vercel the variables
are provided directly, so this module never imports dotenv.
"""
import os

DEFAULT_DATABASE_URL = "sqlite:///./oja.db"

# `or` (not a default argument) so an empty value in .env falls back too.
DATABASE_URL = os.environ.get("DATABASE_URL") or DEFAULT_DATABASE_URL

SUPABASE_URL = os.environ.get("VITE_SUPABASE_URL", "")
SUPABASE_JWKS_URL = os.environ.get("SUPABASE_JWKS_URL", "")

PAYSTACK_SECRET_KEY = os.environ.get("PAYSTACK_SECRET_KEY", "")

MAILGUN_API_KEY = os.environ.get("MAILGUN_API_KEY", "")
MAILGUN_DOMAIN = os.environ.get("MAILGUN_DOMAIN", "")
MAILGUN_API_BASE = os.environ.get("MAILGUN_API_BASE", "https://api.mailgun.net")
MAILGUN_FROM = os.environ.get("MAILGUN_FROM", "")

APP_URL = os.environ.get("APP_URL", "")

# Vercel sets VERCEL=1 for every deployment.
ON_VERCEL = bool(os.environ.get("VERCEL"))
