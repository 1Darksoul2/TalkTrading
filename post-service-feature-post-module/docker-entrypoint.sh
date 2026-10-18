#!/bin/sh
set -e

echo "Starting Social Content & Post Microservice..."

# Wait for database readiness
echo "Checking database connection..."
python -c '
import sys
import time
from app.core.config import settings
from sqlalchemy import create_engine, text

db_url = settings.get_database_url()
print(f"Target Database URL: {db_url}")

max_retries = 30
for i in range(max_retries):
    try:
        connect_args = {"check_same_thread": False} if db_url.startswith("sqlite") else {}
        engine = create_engine(db_url, connect_args=connect_args)
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        print("Database connection verified successfully!")
        sys.exit(0)
    except Exception as e:
        print(f"Database not ready yet ({i+1}/{max_retries}). Retry in 2s... Error: {e}")
        time.sleep(2)

print("Could not connect to database after retries.")
sys.exit(1)
'

# Run Alembic migrations
echo "Applying database migrations via Alembic..."
alembic upgrade head

# Start FastAPI application
PORT_NUM="${PORT:-8000}"
echo "Launching FastAPI Uvicorn server on 0.0.0.0:${PORT_NUM}..."
exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT_NUM}"
