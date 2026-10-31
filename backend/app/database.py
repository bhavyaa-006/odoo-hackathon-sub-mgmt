"""
SQLAlchemy database engine + session factory.
Uses psycopg2 (sync) driver with SQLAlchemy 2.x style.
"""
from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import get_settings

settings = get_settings()

engine = create_engine(
    settings.database_url,
    echo=settings.debug,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
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
