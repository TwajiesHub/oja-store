import time

import jwt
import pytest
from fastapi import HTTPException
from cryptography.hazmat.primitives.asymmetric import ec

from api.auth import signing_key_provider, verify_token
from api.index import app
from tests.conftest import ISSUER, TEST_PUBLIC_KEY, make_token


def get_me(client, token=None, scheme="Bearer"):
    headers = {"Authorization": f"{scheme} {token}"} if token is not None else {}
    return client.get("/api/me", headers=headers)


def test_valid_token_is_accepted(client):
    response = get_me(client, make_token())

    assert response.status_code == 200
    assert response.json()["email"] == "amina@example.com"


def test_missing_token_is_401(client):
    response = get_me(client)

    assert response.status_code == 401
    assert response.json() == {"detail": "Sign in to continue."}
    assert response.headers["www-authenticate"] == "Bearer"


def test_garbage_token_is_401(client):
    assert get_me(client, "not-a-token").status_code == 401


def test_token_signed_with_another_key_is_401(client):
    other_key = ec.generate_private_key(ec.SECP256R1())

    assert get_me(client, make_token(key=other_key)).status_code == 401


def test_expired_token_is_401_with_a_clear_message(client):
    response = get_me(client, make_token(exp=int(time.time()) - 10))

    assert response.status_code == 401
    assert "expired" in response.json()["detail"]


def test_token_for_the_wrong_audience_is_401(client):
    assert get_me(client, make_token(aud="anon")).status_code == 401


def test_token_from_another_issuer_is_401(client):
    assert get_me(client, make_token(iss="https://evil.example.com/auth/v1")).status_code == 401


def test_token_without_a_subject_is_401(client):
    assert get_me(client, make_token(sub=None)).status_code == 401


def test_token_without_an_expiry_is_401(client):
    assert get_me(client, make_token(exp=None)).status_code == 401


def test_unsigned_token_is_401(client):
    unsigned = jwt.encode({"sub": "user-a", "aud": "authenticated", "iss": ISSUER, "exp": int(time.time()) + 60},
                          key=None, algorithm="none")

    assert get_me(client, unsigned).status_code == 401


def test_shared_secret_algorithm_is_refused():
    # An attacker could sign with HS256 using the public key as the "secret". Only asymmetric algorithms pass.
    token = jwt.encode({"sub": "user-a", "aud": "authenticated", "iss": ISSUER, "exp": int(time.time()) + 60},
                       "a-shared-secret-of-sufficient-length-123", algorithm="HS256")

    with pytest.raises(HTTPException) as error:
        verify_token(token, lambda _: TEST_PUBLIC_KEY)

    assert error.value.status_code == 401


def test_wrong_scheme_is_401(client):
    assert get_me(client, make_token(), scheme="Basic").status_code == 401


def test_unreachable_signing_keys_are_503(client):
    def broken_provider():
        def find_key(token):
            raise jwt.PyJWKClientConnectionError("down")

        return find_key

    app.dependency_overrides[signing_key_provider] = broken_provider

    response = get_me(client, make_token())

    assert response.status_code == 503
    assert "unavailable" in response.json()["detail"]


def test_name_comes_from_the_token_metadata(client):
    response = get_me(client, make_token(user_metadata={"name": "Chidi Okafor"}))

    assert response.json()["full_name"] == "Chidi Okafor"
