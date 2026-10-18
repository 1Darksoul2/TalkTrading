"""Additive migrations for databases created before a column existed.

`create_all` never alters an existing table, so columns added later are applied here
(idempotent, additive only, never drops or rewrites data).
"""
import logging

from sqlalchemy import inspect, text

logger = logging.getLogger(__name__)

STORY_COLUMNS = {
    "audience": "VARCHAR(16) NOT NULL DEFAULT 'everyone'",
    "overlays": "JSON",
    "media_id": "CHAR(32)",
    "width": "INTEGER",
    "height": "INTEGER",
    "duration": "FLOAT",
    "link_clicks": "INTEGER NOT NULL DEFAULT 0",
}


def ensure_columns(engine, table: str, columns: dict) -> None:
    insp = inspect(engine)
    if table not in insp.get_table_names():
        return
    existing = {c["name"] for c in insp.get_columns(table)}
    with engine.begin() as conn:
        for name, ddl in columns.items():
            if name not in existing:
                conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {name} {ddl}"))
                logger.info("Added %s.%s", table, name)


def run(engine) -> None:
    ensure_columns(engine, "stories", STORY_COLUMNS)
