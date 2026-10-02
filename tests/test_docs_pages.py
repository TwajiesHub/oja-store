import pytest
from fastapi.testclient import TestClient

from api.index import create_app


@pytest.mark.parametrize("path", ["/docs", "/redoc", "/openapi.json"])
def test_the_interactive_docs_are_off_in_production(path):
    client = TestClient(create_app(public_docs=False))

    assert client.get(path).status_code == 404


@pytest.mark.parametrize("path", ["/docs", "/redoc", "/openapi.json"])
def test_the_interactive_docs_are_on_for_local_work(path):
    client = TestClient(create_app(public_docs=True))

    assert client.get(path).status_code == 200


def test_the_api_itself_is_unaffected_when_the_docs_are_off(client):
    # `client` is the normal test app (docs on); the production app serves the same routes.
    production = TestClient(create_app(public_docs=False))

    assert production.get("/api/me").status_code == 401
    assert production.post("/api/paystack/webhook", content=b"{}", headers={"x-paystack-signature": "0"}).status_code == 401


def test_this_environment_is_not_treated_as_production():
    from api import config

    assert config.ON_VERCEL is False
