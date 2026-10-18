from sqlalchemy import create_engine, inspect, text

from app import lite_migrations


def test_existing_story_tables_gain_the_new_columns_without_losing_rows(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path}/legacy.db")
    with engine.begin() as conn:  # the stories table exactly as the first version created it
        conn.execute(text(
            "CREATE TABLE stories (id CHAR(32) PRIMARY KEY, user_id CHAR(32) NOT NULL, media_url VARCHAR NOT NULL, "
            "media_type VARCHAR(5) NOT NULL, caption VARCHAR, created_at DATETIME NOT NULL, "
            "expires_at DATETIME NOT NULL, view_count INTEGER NOT NULL)"))
        conn.execute(text(
            "INSERT INTO stories VALUES ('a'*1, 'b', 'https://example.com/a.jpg', 'image', 'old', "
            "'2026-01-01 00:00:00', '2026-01-02 00:00:00', 3)".replace("'a'*1", "'" + "a" * 32 + "'")))
    lite_migrations.run(engine)
    lite_migrations.run(engine)  # idempotent

    columns = {c["name"] for c in inspect(engine).get_columns("stories")}
    assert {"audience", "overlays", "media_id", "width", "height", "duration", "link_clicks"} <= columns
    with engine.connect() as conn:
        row = conn.execute(text("SELECT caption, view_count, audience, link_clicks FROM stories")).one()
    assert tuple(row) == ("old", 3, "everyone", 0)
