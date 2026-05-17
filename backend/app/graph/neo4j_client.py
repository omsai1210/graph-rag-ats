"""
Neo4j driver factory.
The driver is created lazily on first access so that importing this module
never fails at startup if the env vars contain placeholder values.
"""

from __future__ import annotations

from functools import lru_cache
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from neo4j import Driver, Session


@lru_cache(maxsize=1)
def _get_driver() -> "Driver":
    from neo4j import GraphDatabase
    from app.core.config import settings
    return GraphDatabase.driver(
        settings.neo4j_uri,
        auth=(settings.neo4j_username, settings.neo4j_password),
    )


def get_session() -> "Session":
    """Return a new session from the shared driver pool."""
    return _get_driver().session()


def close_driver() -> None:
    """Gracefully close the driver (call on app shutdown)."""
    _get_driver().close()
