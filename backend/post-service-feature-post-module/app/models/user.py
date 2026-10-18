import uuid
from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.sql import func

from app.database.database import Base


class User(Base):
    """
    Shared-identity users table. The `id` is a UUID string (not the service's
    usual integer PK style) so tokens issued here carry a `sub` claim that is
    also valid against other TalkTrading services expecting a UUID subject
    (e.g. the E2EE service). Post/Comment/Like `author_id`/`user_id` int
    columns are unaffected — get_current_user_id() deterministically derives
    a stable int from this UUID for those existing ownership checks.
    """
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    username = Column(String(64), unique=True, nullable=False, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    # Integer id derived from `id` (see core.security.derive_author_id); unique so two
    # users can never be mistaken for one another in the int-keyed post tables.
    author_id = Column(Integer, unique=True, index=True, nullable=True)
    display_name = Column(String(64), nullable=True)
    bio = Column(String(160), nullable=True)
    avatar_url = Column(String(500), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
