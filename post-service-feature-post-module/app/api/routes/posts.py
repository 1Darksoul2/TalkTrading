from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from app.core.visibility import can_view
from sqlalchemy.orm import Session

from app.database.database import get_db
from app.core.security import get_current_user_id, get_optional_user_id
from app.schemas.post import (
    PostCreate,
    PostUpdate,
    PostResponse,
    PostDetailResponse,
)
from app.services.post_service import (
    create_post,
    get_post_by_id,
    get_all_posts,
    update_post,
    delete_post,
)
from app.services.engagement_service import get_post_engagement
from app.models.post import PostVisibility

router = APIRouter(
    prefix="/posts",
    tags=["Posts"],
)


@router.post("/", response_model=PostResponse, status_code=status.HTTP_201_CREATED)
def create_new_post(
    post: PostCreate,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id),
):
    """Create a new post. author_id is automatically derived from the authenticated token."""
    return create_post(db=db, post_data=post, author_id=current_user_id)


@router.get("/{post_id}", response_model=PostDetailResponse)
def read_post_detail(
    post_id: int,
    db: Session = Depends(get_db),
    current_user_id: Optional[int] = Depends(get_optional_user_id),
):
    """Retrieve post details by ID including engagement metrics."""
    post = get_post_by_id(db, post_id)
    if post is None or not can_view(post, current_user_id, db):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Post with ID {post_id} not found",
        )

    engagement = get_post_engagement(db, post_id, current_user_id=current_user_id)
    
    # Construct PostDetailResponse
    response_data = PostDetailResponse.model_validate(post)
    response_data.engagement = engagement
    return response_data


@router.get("/", response_model=List[PostResponse])
def list_posts(
    author_id: Optional[int] = Query(None, description="Filter by author ID"),
    search: str = Query("", description="Search caption"),
    visibility: Optional[PostVisibility] = Query(None, description="Filter by visibility"),
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user_id: Optional[int] = Depends(get_optional_user_id),
):
    """List posts with deterministic sorting, search, filtering, and pagination."""
    posts, _ = get_all_posts(
        db=db,
        author_id=author_id,
        search=search,
        visibility=visibility,
        page=page,
        limit=limit,
        viewer_id=current_user_id,
    )
    return posts


@router.put("/{post_id}", response_model=PostResponse)
def update_existing_post(
    post_id: int,
    post: PostUpdate,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id),
):
    """Update post caption or visibility. Restricted to post author."""
    result = update_post(db=db, post_id=post_id, post_data=post, current_user_id=current_user_id)

    if result is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Post with ID {post_id} not found",
        )

    if result == "forbidden":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to modify this post",
        )

    return result


@router.delete("/{post_id}")
def delete_existing_post(
    post_id: int,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id),
):
    """Delete a post. Restricted to post author."""
    result = delete_post(db=db, post_id=post_id, current_user_id=current_user_id)

    if result is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Post with ID {post_id} not found",
        )

    if result == "forbidden":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to delete this post",
        )

    return {"message": "Post deleted successfully"}
