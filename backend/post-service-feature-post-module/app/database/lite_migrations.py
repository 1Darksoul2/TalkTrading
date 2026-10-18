"""Tiny additive migrations for tables created before a column existed.

The service creates tables with Base.metadata.create_all(), which never alters an
existing table, so columns added later are applied here (idempotent, additive only).
"""
import logging

from sqlalchemy import inspect, text

from app.core.security import derive_author_id

logger = logging.getLogger(__name__)

USER_COLUMNS = {
    "author_id": "INTEGER",
    "display_name": "VARCHAR(64)",
    "bio": "VARCHAR(160)",
    "avatar_url": "VARCHAR(500)",
}


def ensure_user_columns(engine) -> None:
    insp = inspect(engine)
    if "users" not in insp.get_table_names():
        return
    existing = {c["name"] for c in insp.get_columns("users")}
    with engine.begin() as conn:
        for name, ddl in USER_COLUMNS.items():
            if name not in existing:
                conn.execute(text(f"ALTER TABLE users ADD COLUMN {name} {ddl}"))
                logger.info("Added users.%s", name)
        rows = conn.execute(text("SELECT id FROM users WHERE author_id IS NULL")).fetchall()
        taken = {r[0] for r in conn.execute(text("SELECT author_id FROM users WHERE author_id IS NOT NULL")).fetchall()}
        for (uid,) in rows:
            aid = derive_author_id(uid)
            if aid in taken:
                logger.warning("author_id collision for user %s (%s); left unset", uid, aid)
                continue
            conn.execute(text("UPDATE users SET author_id = :a WHERE id = :i"), {"a": aid, "i": uid})
            taken.add(aid)
        conn.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS ix_users_author_id_unique ON users (author_id)"))
