from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.user import User
from app.schemas.user import UserCreate
import uuid

from app.core.security import (
    derive_author_id,
    hash_password,
    verify_password,
    create_access_token,
)


def register_user(db: Session, user: UserCreate):
    email = user.email.strip().lower()
    username = user.username.strip()

    if db.query(User).filter(User.email == email).first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists. Try logging in instead.",
        )
    if db.query(User).filter(User.username == username).first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="That username is already taken. Please pick another one.",
        )

    # The int id derived from the UUID must be unique (collisions are possible in a
    # ~900k range), so re-roll the UUID until its derived id is free.
    for _ in range(50):
        new_id = str(uuid.uuid4())
        author_id = derive_author_id(new_id)
        if db.query(User.id).filter(User.author_id == author_id).first() is None:
            break
    else:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Could not allocate an account id, please retry")

    db_user = User(
        id=new_id,
        author_id=author_id,
        username=username,
        display_name=username,
        email=email,
        hashed_password=hash_password(user.password),
    )

    db.add(db_user)
    try:
        db.commit()
    except IntegrityError:
        # Two signups racing past the checks above still hit the DB unique constraints.
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="That email or username is already registered.",
        )
    db.refresh(db_user)

    return db_user


def authenticate_user(
    db: Session,
    email: str,
    password: str,
):
    user = (
        db.query(User)
        .filter(func.lower(User.email) == email.strip().lower())
        .first()
    )

    if not user:
        return None

    if not verify_password(
        password,
        user.hashed_password,
    ):
        return None

    return user