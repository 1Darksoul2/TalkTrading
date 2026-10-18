import os
import sys

# Ensure current directory is in sys.path
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
if CURRENT_DIR not in sys.path:
    sys.path.insert(0, CURRENT_DIR)

# Default to local SQLite post.db if no DATABASE_URL is set
if "DATABASE_URL" not in os.environ and "POSTGRES_HOST" not in os.environ:
    db_path = os.path.join(CURRENT_DIR, "post.db")
    os.environ["DATABASE_URL"] = f"sqlite:///{db_path}"

import uvicorn
from app.database.database import Base, engine
from app.main import app

def init_db():
    print("Initializing Post Service database tables...")
    Base.metadata.create_all(bind=engine)
    print("Post Service tables initialized successfully!")

if __name__ == "__main__":
    init_db()
    port = int(os.environ.get("PORT", 8004))
    print(f"Starting TalkTrading Post Microservice on http://127.0.0.1:{port}...")
    uvicorn.run("app.main:app", host="127.0.0.1", port=port, reload=False)
