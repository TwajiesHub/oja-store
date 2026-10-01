"""The signed-in user's profile: contact details and the last delivery address."""
from fastapi import APIRouter, Depends
from sqlmodel import Session

from api.auth import AuthUser, current_user
from api.db import get_session
from api.models import Profile, utc_now
from api.schemas import ProfileIn, ProfileOut

router = APIRouter(prefix="/api/me")


@router.get("", response_model=ProfileOut)
def get_me(user: AuthUser = Depends(current_user), session: Session = Depends(get_session)) -> Profile:
    """The profile, created from the token the first time this user calls it."""
    profile = session.get(Profile, user.user_id)
    if profile is None:
        profile = Profile(user_id=user.user_id, email=user.email, full_name=user.full_name)
    elif profile.email != user.email:
        profile.email = user.email
        profile.updated_at = utc_now()
    session.add(profile)
    session.commit()
    session.refresh(profile)
    return profile


@router.put("", response_model=ProfileOut)
def update_me(body: ProfileIn, user: AuthUser = Depends(current_user), session: Session = Depends(get_session)) -> Profile:
    profile = session.get(Profile, user.user_id) or Profile(user_id=user.user_id, email=user.email)
    profile.email = user.email
    profile.full_name = body.full_name
    profile.phone = body.phone
    profile.address = body.address
    profile.area = body.area
    profile.state = body.state
    profile.updated_at = utc_now()
    session.add(profile)
    session.commit()
    session.refresh(profile)
    return profile
