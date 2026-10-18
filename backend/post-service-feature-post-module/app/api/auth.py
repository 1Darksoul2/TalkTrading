from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.database.database import get_db
from app.schemas.user import (
    PasswordResetConfirm,
    PasswordResetRequest,
    UserCreate,
    UserResponse,
)
from app.services import password_reset_service
from app.services.auth_service import (
    register_user,
    authenticate_user,
)
from app.core.security import create_access_token

router = APIRouter(
    prefix="/auth",
    tags=["Authentication"],
)


@router.post("/register", response_model=UserResponse)
def register(
    user: UserCreate,
    db: Session = Depends(get_db),
):
    return register_user(db, user)


@router.post("/login")
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    db_user = authenticate_user(
        db,
        form_data.username,   # email or username
        form_data.password,
    )

    if not db_user:
        raise HTTPException(
            status_code=401,
            detail="Incorrect email/username or password.",
        )

    access_token = create_access_token(
        data={
            "sub": str(db_user.id),
        }
    )

    # The profile rides along with the token so the frontend can restore the
    # real username after a logout/login (there is no /users/me endpoint yet).
    # OAuth2 clients only read access_token/token_type, so extra keys are safe.
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": str(db_user.id),
            "username": db_user.username,
            "email": db_user.email,
        },
    }


@router.post("/password-reset", status_code=202)
def request_password_reset(body: PasswordResetRequest, db: Session = Depends(get_db)):
    password_reset_service.request_reset(db, body.email)
    return {"detail": "If an account exists for that email, a reset link is on its way."}


@router.post("/password-reset/confirm")
def confirm_password_reset(body: PasswordResetConfirm, db: Session = Depends(get_db)):
    password_reset_service.confirm_reset(db, body.token, body.new_password)
    return {"detail": "Your password has been changed. You can sign in now."}
