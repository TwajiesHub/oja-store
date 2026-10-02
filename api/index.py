"""FastAPI app and router registration. This is the Vercel entrypoint."""
from fastapi import Depends, FastAPI, Response
from sqlalchemy.exc import SQLAlchemyError
from sqlmodel import Session, func, select, text

from api import config
from api.bag import router as bag_router
from api.catalogue import router as catalogue_router
from api.checkout import router as checkout_router
from api.db import get_session
from api.me import router as me_router
from api.models import Brand
from api.orders import router as orders_router
from api.paystack import router as paystack_router


def health(response: Response, session: Session = Depends(get_session)) -> dict:
    try:
        session.exec(text("SELECT 1"))
    except SQLAlchemyError:
        response.status_code = 503
        return {"ok": False, "database": False, "brands": None}

    try:
        brands = session.exec(select(func.count()).select_from(Brand)).one()
    except SQLAlchemyError:
        # The database is up but the tables aren't created yet.
        session.rollback()
        brands = None
    return {"ok": True, "database": True, "brands": brands}


def create_app(public_docs: bool) -> FastAPI:
    """The API. `public_docs` turns FastAPI's interactive pages (/docs, /redoc, /openapi.json) on or off."""
    docs = {} if public_docs else {"docs_url": None, "redoc_url": None, "openapi_url": None}
    api = FastAPI(title="Ọjà API", **docs)
    api.include_router(catalogue_router)
    api.include_router(bag_router)
    api.include_router(me_router)
    api.include_router(checkout_router)
    api.include_router(orders_router)
    api.include_router(paystack_router)
    api.add_api_route("/api/health", health, methods=["GET"])
    return api


# The docs pages describe every route, so they stay off on Vercel and are on for local work.
app = create_app(public_docs=not config.ON_VERCEL)
