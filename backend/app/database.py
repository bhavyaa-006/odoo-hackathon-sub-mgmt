"""
SQLAlchemy database engine + session factory.
Uses psycopg2 (sync) driver with SQLAlchemy 2.x style.
"""
from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import get_settings

settings = get_settings()

_is_sqlite = settings.database_url.startswith("sqlite")
_engine_kwargs = {"echo": settings.debug, "pool_pre_ping": True}
if _is_sqlite:
    _engine_kwargs["connect_args"] = {"check_same_thread": False}
else:
    _engine_kwargs["pool_size"] = 10
    _engine_kwargs["max_overflow"] = 20

engine = create_engine(
    settings.database_url,
    **_engine_kwargs,
)

SessionLocal = sessionmaker(
    bind=engine,
    autocommit=False,
    autoflush=False,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    """Shared declarative base for all ORM models."""
    pass


def get_session() -> Generator[Session, None, None]:
    """Yield a database session and ensure it is closed after the request."""
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()
