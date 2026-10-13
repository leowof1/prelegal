"""Sign-up, sign-in and cookie sessions, with scrypt password hashes."""

import hashlib
import hmac
import secrets
import sqlite3
from typing import Annotated

from fastapi import APIRouter, Cookie, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel, ConfigDict, Field

from prelegal_backend.db import connect

SESSION_COOKIE = "prelegal_session"
COOKIE_OPTIONS = {"httponly": True, "samesite": "lax"}

SessionToken = Annotated[str, Cookie(alias=SESSION_COOKIE)]

router = APIRouter(prefix="/api/auth")


class User(BaseModel):
    id: int
    name: str
    email: str


class SignInRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    email: str = Field(pattern=r"^[^@\s]+@[^@\s]+$")
    password: str = Field(min_length=1)


class SignUpRequest(SignInRequest):
    name: str = Field(min_length=1)
    password: str = Field(min_length=8)


def _scrypt(password: str, salt: bytes) -> bytes:
    return hashlib.scrypt(password.encode(), salt=salt, n=2**14, r=8, p=1)


def hash_password(password: str) -> str:
    """A salted scrypt hash, stored as "salt$hash" in hex."""
    salt = secrets.token_bytes(16)
    return f"{salt.hex()}${_scrypt(password, salt).hex()}"


def verify_password(password: str, stored: str) -> bool:
    """Whether the password matches a hash from hash_password."""
    salt, digest = stored.split("$")
    return hmac.compare_digest(_scrypt(password, bytes.fromhex(salt)).hex(), digest)


def start_session(conn: sqlite3.Connection, response: Response, user_id: int) -> None:
    """Create a session for the user and send its token as an httpOnly cookie."""
    token = secrets.token_urlsafe(32)
    conn.execute("INSERT INTO sessions (token, user_id) VALUES (?, ?)", (token, user_id))
    response.set_cookie(SESSION_COOKIE, token, **COOKIE_OPTIONS)


def session_user(request: Request, token: str) -> User | None:
    """The user with this session token, if any."""
    with connect(request.app.state.db_path) as conn:
        row = conn.execute(
            "SELECT users.id, users.name, users.email FROM sessions JOIN users ON users.id = sessions.user_id "
            "WHERE sessions.token = ?",
            (token,),
        ).fetchone()
    if row is None:
        return None
    user_id, name, email = row
    return User(id=user_id, name=name, email=email)


def current_user(request: Request, token: SessionToken = "") -> User:
    """The signed-in user; 401 if there is none."""
    user = session_user(request, token)
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not signed in")
    return user


CurrentUser = Annotated[User, Depends(current_user)]


@router.post("/signup", status_code=status.HTTP_201_CREATED)
def sign_up(body: SignUpRequest, request: Request, response: Response) -> User:
    """Register a new account and sign it in."""
    email = body.email.lower()
    with connect(request.app.state.db_path) as conn:
        try:
            cursor = conn.execute(
                "INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)",
                (body.name, email, hash_password(body.password)),
            )
        except sqlite3.IntegrityError:
            raise HTTPException(status.HTTP_409_CONFLICT, "An account with this email already exists")
        start_session(conn, response, cursor.lastrowid)
    return User(id=cursor.lastrowid, name=body.name, email=email)


@router.post("/signin")
def sign_in(body: SignInRequest, request: Request, response: Response) -> User:
    """Sign in with email and password."""
    with connect(request.app.state.db_path) as conn:
        row = conn.execute(
            "SELECT id, name, email, password_hash FROM users WHERE email = ?", (body.email.lower(),)
        ).fetchone()
        if row is None or not verify_password(body.password, row[3]):
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Incorrect email or password")
        user_id, name, email, _ = row
        start_session(conn, response, user_id)
    return User(id=user_id, name=name, email=email)


@router.post("/signout", status_code=status.HTTP_204_NO_CONTENT)
def sign_out(request: Request, response: Response, token: SessionToken = "") -> None:
    """End the current session, if any."""
    with connect(request.app.state.db_path) as conn:
        conn.execute("DELETE FROM sessions WHERE token = ?", (token,))
    response.delete_cookie(SESSION_COOKIE, **COOKIE_OPTIONS)


@router.get("/me")
def me(request: Request, token: SessionToken = "") -> User | None:
    """The signed-in user, or null when signed out (not an error: the frontend asks on every page)."""
    return session_user(request, token)
