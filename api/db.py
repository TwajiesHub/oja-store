"""Database engine and sessions. SQLite locally and in tests, Postgres on Vercel."""
from collections.abc import Iterator

from sqlalchemy.engine import Engine
from sqlalchemy.pool import NullPool
from sqlmodel import Session, create_engine

from api import config


def normalise_url(url: str) -> str:
    """Make Postgres URLs use the psycopg 3 driver."""
    for prefix in ("postgres://", "postgresql://"):
        if url.startswith(prefix):
            return "postgresql+psycopg://" + url[len(prefix):]
    return url


def make_engine(url: str) -> Engine:
    url = normalise_url(url)
    if url.startswith("sqlite"):
        return create_engine(url, connect_args={"check_same_thread": False})
    return create_engine(
        url,
        # The transaction pooler (port 6543) does not support prepared statements.
        connect_args={"prepare_threshold": None},
        pool_pre_ping=True,
        # Each Vercel call opens and closes one pooled connection.
        poolclass=NullPool if config.ON_VERCEL else None,
    )


engine = make_engine(config.DATABASE_URL)


def get_session() -> Iterator[Session]:
    with Session(engine) as session:
        yield session
