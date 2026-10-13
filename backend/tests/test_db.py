import sqlite3

import pytest

from prelegal_backend.db import connect, reset_database


def columns(db_path, table):
    with connect(db_path) as conn:
        return [row[1] for row in conn.execute(f"PRAGMA table_info({table})")]


def test_reset_creates_users_table(db_path):
    reset_database(db_path)
    assert columns(db_path, "users") == ["id", "name", "email", "password_hash", "created_at"]


def test_reset_creates_sessions_and_documents_tables(db_path):
    reset_database(db_path)
    assert columns(db_path, "sessions") == ["token", "user_id", "created_at"]
    assert columns(db_path, "documents") == [
        "id", "user_id", "document_id", "values_json", "messages_json", "created_at", "updated_at"
    ]


def test_reset_discards_existing_data(db_path):
    reset_database(db_path)
    with connect(db_path) as conn:
        conn.execute("INSERT INTO users (name, email, password_hash) VALUES ('A', 'a@x.com', 'h')")
    reset_database(db_path)
    with connect(db_path) as conn:
        assert conn.execute("SELECT COUNT(*) FROM users").fetchone() == (0,)


def test_email_is_unique(db_path):
    reset_database(db_path)
    insert = "INSERT INTO users (name, email, password_hash) VALUES (?, 'a@x.com', 'h')"
    with connect(db_path) as conn:
        conn.execute(insert, ("A",))
        with pytest.raises(sqlite3.IntegrityError):
            conn.execute(insert, ("B",))


def test_connect_closes_the_connection(db_path):
    reset_database(db_path)
    with connect(db_path) as conn:
        conn.execute("SELECT 1")
    with pytest.raises(sqlite3.ProgrammingError, match="closed"):
        conn.execute("SELECT 1")


def test_connect_commits_on_success(db_path):
    reset_database(db_path)
    with connect(db_path) as conn:
        conn.execute("INSERT INTO users (name, email, password_hash) VALUES ('A', 'a@x.com', 'h')")
    with connect(db_path) as conn:
        assert conn.execute("SELECT COUNT(*) FROM users").fetchone() == (1,)
