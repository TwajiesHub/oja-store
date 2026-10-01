"""FastAPI app and router registration. This is the Vercel entrypoint."""
from fastapi import Depends, FastAPI, Response
from sqlalchemy.exc import SQLAlchemyError
from sqlmodel import Session, func, select, text

from api.db import get_session
from api.models import Brand

app = FastAPI(title="Ọjà API")


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
