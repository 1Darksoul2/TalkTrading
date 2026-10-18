import pytest
from app.services.like_service import like_post
from app.repositories.post_repository import PostRepository


def test_atomic_transaction_rollback(db_session, user1_headers):
    # Create a post in database
    post_repo = PostRepository(db_session)
    post = post_repo.create(
        post_data=type("PostData", (), {"caption": "Atomic Test", "visibility": "public"})(),
        author_id=101,
        commit=True,
    )
    post_id = post.id
    initial_likes = post.like_count

    # First like succeeded
    res1 = like_post(db_session, post_id=post_id, user_id=202)
    assert res1 is True

    # Re-query post to check count is 1
    post_after = post_repo.get_by_id(post_id)
    assert post_after.like_count == 1

    # Second duplicate like returns already_liked without modifying counter
    res2 = like_post(db_session, post_id=post_id, user_id=202)
    assert res2 == "already_liked"

    post_after2 = post_repo.get_by_id(post_id)
    assert post_after2.like_count == 1
