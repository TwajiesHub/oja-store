"""FastAPI app and router registration. This is the Vercel entrypoint."""
from fastapi import Depends, FastAPI, Response
from sqlalchemy.exc import SQLAlchemyError
from sqlmodel import Session, func, select, text

from api.bag import router as bag_router
from api.catalogue import router as catalogue_router
from api.checkout import router as checkout_router
from api.db import get_session
from api.me import router as me_router
from api.orders import router as orders_router
from api.paystack import router as paystack_router
from api.models import Brand

app = FastAPI(title="Ọjà API")
app.include_router(catalogue_router)
app.include_router(bag_router)
app.include_router(me_router)
app.include_router(checkout_router)
app.include_router(orders_router)
app.include_router(paystack_router)


@app.get("/api/health")
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
