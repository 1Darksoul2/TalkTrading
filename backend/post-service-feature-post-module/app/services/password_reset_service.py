import hashlib
import logging
import secrets
import smtplib
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import hash_password
from app.models.password_reset import PasswordResetToken
from app.models.user import User

logger = logging.getLogger(__name__)


def _hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _send_reset_email(to: str, link: str) -> None:
    if not settings.SMTP_HOST:
        # No mail server configured (local development): the link goes to the service log.
        logger.warning("Password reset link for %s: %s", to, link)
        return
    msg = EmailMessage()
    msg["Subject"] = "Reset your TalkTrading password"
    msg["From"] = settings.SMTP_FROM
    msg["To"] = to
    msg.set_content(
        f"Someone asked to reset the password for your TalkTrading account.\n\n"
        f"Open this link to choose a new one (it expires in {settings.PASSWORD_RESET_EXPIRE_MINUTES} minutes):\n"
        f"{link}\n\nIf it wasn't you, ignore this email; your password stays the same."
    )
    with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15) as smtp:
        smtp.starttls()
        if settings.SMTP_USER:
            smtp.login(settings.SMTP_USER, settings.SMTP_PASSWORD or "")
        smtp.send_message(msg)


def request_reset(db: Session, email: str) -> None:
    """Email a reset link if the account exists. Says nothing either way, so emails can't be probed."""
    user = db.query(User).filter(func.lower(User.email) == email.strip().lower()).first()
    if not user:
        return
    token = secrets.token_urlsafe(32)
    db.add(PasswordResetToken(
        user_id=user.id,
        token_hash=_hash(token),
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=settings.PASSWORD_RESET_EXPIRE_MINUTES),
    ))
    db.commit()
    link = f"{settings.PUBLIC_URL.rstrip('/')}/reset-password?token={token}"
    try:
        _send_reset_email(user.email, link)
    except Exception:
        logger.exception("Could not send the password reset email to %s", user.email)
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Could not send the email right now. Please try again shortly.")


def confirm_reset(db: Session, token: str, new_password: str) -> None:
    invalid = HTTPException(status.HTTP_400_BAD_REQUEST, "This reset link is invalid or has expired. Request a new one.")
    row = db.query(PasswordResetToken).filter(PasswordResetToken.token_hash == _hash(token)).first()
    if row is None or row.used_at is not None:
        raise invalid
    now = datetime.now(timezone.utc)
    # SQLite hands back naive datetimes; they were stored as UTC.
    expires_at = row.expires_at if row.expires_at.tzinfo else row.expires_at.replace(tzinfo=timezone.utc)
    user = db.get(User, row.user_id)
    if expires_at < now or user is None:
        raise invalid
    user.hashed_password = hash_password(new_password)
    row.used_at = now
    # Any other outstanding links for this account stop working too.
    db.query(PasswordResetToken).filter(
        PasswordResetToken.user_id == user.id, PasswordResetToken.used_at.is_(None)
    ).update({PasswordResetToken.used_at: now})
    db.commit()
