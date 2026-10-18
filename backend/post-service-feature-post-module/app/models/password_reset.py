from sqlalchemy import Column, DateTime, ForeignKey, Integer, String

from app.database.database import Base


class PasswordResetToken(Base):
    """A one-time password reset link. Only the SHA-256 of the token is stored."""
    __tablename__ = "password_reset_tokens"

    id = Column(Integer, primary_key=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    token_hash = Column(String(64), unique=True, nullable=False, index=True)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    used_at = Column(DateTime(timezone=True), nullable=True)
