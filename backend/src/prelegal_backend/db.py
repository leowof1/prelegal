"""Temporary SQLite database, rebuilt from scratch every time the app starts."""

import sqlite3
from collections.abc import Iterator
from contextlib import closing, contextmanager
from pathlib import Path

NOW = "strftime('%Y-%m-%dT%H:%M:%fZ')"
"""SQL for the current UTC time as an ISO 8601 string with milliseconds."""

SCHEMA = f"""
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE sessions (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    document_id TEXT NOT NULL,
    values_json TEXT NOT NULL,
    messages_json TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT ({NOW}),
    updated_at TEXT NOT NULL DEFAULT ({NOW})
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
