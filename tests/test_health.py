from fastapi.testclient import TestClient
from sqlmodel import Session

from api.db import get_session, make_engine
from api.index import app
from scripts.init_db import seed


def test_health_reports_brand_count(client, session):
    seed(session)

    response = client.get("/api/health")

    assert response.status_code == 200
    assert response.json() == {"ok": True, "database": True, "brands": 6}


def test_health_counts_zero_brands_in_empty_database(client):
    response = client.get("/api/health")

    assert response.status_code == 200
    assert response.json() == {"ok": True, "database": True, "brands": 0}


def test_health_returns_null_count_when_tables_are_missing(tmp_path):
    engine = make_engine(f"sqlite:///{tmp_path}/no_tables.db")

    def override_session():
        with Session(engine) as session:
            yield session

    app.dependency_overrides[get_session] = override_session
    try:
        response = TestClient(app).get("/api/health")
    finally:
        app.dependency_overrides.clear()
        engine.dispose()

    assert response.status_code == 200
    assert response.json() == {"ok": True, "database": True, "brands": None}


def test_health_returns_503_when_database_is_down(tmp_path):
    class BrokenSession:
        def exec(self, *args, **kwargs):
            from sqlalchemy.exc import OperationalError

            raise OperationalError("SELECT 1", {}, Exception("down"))

    app.dependency_overrides[get_session] = lambda: BrokenSession()
    try:
        response = TestClient(app).get("/api/health")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 503
    assert response.json() == {"ok": False, "database": False, "brands": None}
