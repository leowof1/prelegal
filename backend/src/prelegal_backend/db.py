"""Temporary SQLite database, rebuilt from scratch every time the app starts."""

import sqlite3
from collections.abc import Iterator
from contextlib import closing, contextmanager
from pathlib import Path

SCHEMA = """
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
"""


def reset_database(db_path: Path) -> None:
    """Delete any existing database file and create a fresh schema."""
    db_path.unlink(missing_ok=True)
    with connect(db_path) as conn:
        conn.executescript(SCHEMA)


@contextmanager
def connect(db_path: Path) -> Iterator[sqlite3.Connection]:
    """Open a connection, commit on success (roll back on error) and always close it."""
    with closing(sqlite3.connect(db_path)) as conn, conn:
        yield conn
