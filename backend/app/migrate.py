"""Creates missing tables and applies small schema updates, so older databases keep working."""
from sqlalchemy import inspect, text

from . import models  # noqa: F401  (registers tables)
from .database import Base, engine


def migrate() -> None:
    Base.metadata.create_all(bind=engine)
    if "is_verified" not in {c["name"] for c in inspect(engine).get_columns("users")}:
        # Accounts created before email verification existed are treated as verified.
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE users ADD COLUMN is_verified BOOLEAN NOT NULL DEFAULT TRUE"))
