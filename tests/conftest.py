"""Shared test setup. Tests use a temporary SQLite database and never touch Supabase."""
import os
import tempfile

# Set before the app is imported, so even a stray import can't see a real database.
os.environ["DATABASE_URL"] = f"sqlite:///{tempfile.mkdtemp()}/unused.db"
os.environ.pop("DATABASE_URL_SESSION", None)

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel

from api.db import get_session, make_engine
from api.index import app


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
    yield TestClient(app)
    app.dependency_overrides.clear()
