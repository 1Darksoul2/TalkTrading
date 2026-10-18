from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

from .config import settings

kwargs = {"pool_pre_ping": True}
if "sqlite" in settings.database_url:
    kwargs["connect_args"] = {"check_same_thread": False}
else:
    kwargs["pool_size"] = 10
    kwargs["max_overflow"] = 20

engine = create_engine(settings.database_url, **kwargs)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
