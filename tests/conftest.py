"""Shared test setup. Tests use a temporary SQLite database and never touch Supabase."""
import os
import tempfile

# Set before the app is imported, so even a stray import can't see a real database.
os.environ["DATABASE_URL"] = f"sqlite:///{tempfile.mkdtemp()}/unused.db"
os.environ.pop("DATABASE_URL_SESSION", None)
os.environ["VITE_SUPABASE_URL"] = "https://test-project.supabase.co"
os.environ["SUPABASE_JWKS_URL"] = "https://test-project.supabase.co/auth/v1/.well-known/jwks.json"

import time

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import ec
from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel

from api.auth import signing_key_provider
from api.db import get_session, make_engine
from api.index import app

ISSUER = "https://test-project.supabase.co/auth/v1"
TEST_PRIVATE_KEY = ec.generate_private_key(ec.SECP256R1())
TEST_PUBLIC_KEY = TEST_PRIVATE_KEY.public_key()


@pytest.fixture
def engine(tmp_path):
    """A fresh, empty database with all tables created."""
    engine = make_engine(f"sqlite:///{tmp_path}/test.db")
    SQLModel.metadata.create_all(engine)
    yield engine
    engine.dispose()


@pytest.fixture
def session(engine):
    with Session(engine) as session:
        yield session


@pytest.fixture
def client(engine):
    def override_session():
        with Session(engine) as session:
            yield session

    app.dependency_overrides[get_session] = override_session
    # Check tokens against the test key instead of fetching Supabase's.
    app.dependency_overrides[signing_key_provider] = lambda: (lambda token: TEST_PUBLIC_KEY)
    yield TestClient(app)
    app.dependency_overrides.clear()


def make_token(user_id: str = "user-a", email: str = "amina@example.com", *, key=None, **overrides) -> str:
    """A Supabase-shaped access token, signed with the test key unless `key` says otherwise."""
    claims = {
        "sub": user_id, "email": email, "aud": "authenticated", "iss": ISSUER,
        "exp": int(time.time()) + 3600, "user_metadata": {"full_name": "Amina Bello"},
    }
    claims.update(overrides)
    claims = {name: value for name, value in claims.items() if value is not None}
    return jwt.encode(claims, key or TEST_PRIVATE_KEY, algorithm="ES256")


@pytest.fixture
def auth():
    """Headers for a signed-in user; pass a user id to be someone else."""
    def headers(user_id: str = "user-a", email: str = "amina@example.com", **overrides) -> dict:
        return {"Authorization": f"Bearer {make_token(user_id, email, **overrides)}"}

    return headers
