from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from typing import AsyncGenerator
from app.config import settings

# Engine kwargs
engine_kwargs = {
    "echo": settings.DEBUG,
    "future": True,
}
if settings.DATABASE_URL.startswith("sqlite"):
    engine_kwargs["connect_args"] = {"check_same_thread": False}

# Create asynchronous engine
engine = create_async_engine(
    settings.DATABASE_URL,
    **engine_kwargs
)

# Async session maker
async_session_maker = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Dependency injector to yield DB sessions and close them upon request completion."""
    async with async_session_maker() as session:
        try:
            yield session
        finally:
            await session.close()
