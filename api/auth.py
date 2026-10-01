"""Verifies the Supabase access token the browser sends, and says who the user is."""
import logging
from collections.abc import Callable
from dataclasses import dataclass
from functools import lru_cache
from typing import Any

import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import PyJWKClient

from api import config

logger = logging.getLogger("oja.auth")

# Supabase signs with an asymmetric key (ES256 for this project). Never accept HS256 here:
# the public key would then be usable as a shared secret.
ALGORITHMS = ["ES256", "RS256"]
AUDIENCE = "authenticated"
JWKS_CACHE_SECONDS = 3600

bearer_scheme = HTTPBearer(auto_error=False)
SigningKeyProvider = Callable[[str], Any]


@dataclass(frozen=True)
class AuthUser:
    user_id: str
    email: str
    full_name: str


@lru_cache
def jwks_client() -> PyJWKClient:
    return PyJWKClient(config.SUPABASE_JWKS_URL, cache_keys=True, lifespan=JWKS_CACHE_SECONDS)


def signing_key_provider() -> SigningKeyProvider:
    """Looks up the key that signed a token. Tests replace this with their own key."""
    client = jwks_client()
    return lambda token: client.get_signing_key_from_jwt(token).key


def unauthorized(detail: str) -> HTTPException:
    return HTTPException(status_code=401, detail=detail, headers={"WWW-Authenticate": "Bearer"})


def verify_token(token: str, find_key: SigningKeyProvider) -> AuthUser:
    """Checks signature, expiry, audience and issuer. Raises 401 for a bad token, 503 if keys are unreachable."""
    try:
        key = find_key(token)
        claims = jwt.decode(
            token,
            key,
            algorithms=ALGORITHMS,
            audience=AUDIENCE,
            issuer=f"{config.SUPABASE_URL.rstrip('/')}/auth/v1",
            options={"require": ["exp", "sub", "aud", "iss"]},
        )
    except jwt.PyJWKClientConnectionError as error:
        logger.error("Could not fetch Supabase signing keys: %s", error)
        raise HTTPException(status_code=503, detail="Sign-in is unavailable right now. Try again shortly.") from error
    except jwt.ExpiredSignatureError as error:
        raise unauthorized("Your session has expired. Sign in again.") from error
    except jwt.PyJWTError as error:
        raise unauthorized("Sign in again to continue.") from error

    metadata = claims.get("user_metadata") or {}
    return AuthUser(
        user_id=claims["sub"],
        email=claims.get("email", ""),
        full_name=metadata.get("full_name") or metadata.get("name") or "",
    )


def current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    find_key: SigningKeyProvider = Depends(signing_key_provider),
) -> AuthUser:
    if credentials is None:
        raise unauthorized("Sign in to continue.")
    return verify_token(credentials.credentials, find_key)
