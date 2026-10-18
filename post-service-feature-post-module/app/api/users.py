from fastapi import APIRouter, Depends

from app.core.security import get_current_user
from app.models.user import User

router = APIRouter(
    prefix="/users",
    tags=["Users"],
)


@router.get("/me")
def read_current_user(
    current_user: User = Depends(get_current_user),
):
    return current_user