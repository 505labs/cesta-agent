"""
SQLite database for RoadTrip Co-Pilot.

Tables:
- users: wallet-based user records
- trips: group trip metadata
- trip_members: members of each trip
- conversations: voice interaction history
"""

import os
import sqlite3
from contextlib import contextmanager
from pathlib import Path

DB_PATH = os.environ.get("DB_PATH", "./data/roadtrip.db")


def _ensure_dir():
    Path(DB_PATH).parent.mkdir(parents=True, exist_ok=True)


@contextmanager
def get_db():
    _ensure_dir()
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db():
    with get_db() as conn:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                wallet_address TEXT UNIQUE NOT NULL,
                display_name TEXT DEFAULT '',
                created_at REAL NOT NULL DEFAULT (unixepoch())
            );

            CREATE TABLE IF NOT EXISTS trips (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                organizer_wallet TEXT NOT NULL,
                contract_trip_id INTEGER,
                treasury_address TEXT,
                spend_limit_usd REAL DEFAULT 100.0,
                status TEXT NOT NULL DEFAULT 'active',
                created_at REAL NOT NULL DEFAULT (unixepoch())
            );

            CREATE TABLE IF NOT EXISTS trip_members (
                trip_id INTEGER NOT NULL REFERENCES trips(id),
                wallet_address TEXT NOT NULL,
                display_name TEXT DEFAULT '',
                joined_at REAL NOT NULL DEFAULT (unixepoch()),
                PRIMARY KEY (trip_id, wallet_address)
            );

            CREATE TABLE IF NOT EXISTS conversations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                trip_id INTEGER REFERENCES trips(id),
                wallet_address TEXT,
                user_transcript TEXT,
                assistant_response TEXT,
                duration_ms INTEGER,
                created_at REAL NOT NULL DEFAULT (unixepoch())
            );
        """)


def get_or_create_user(wallet_address: str) -> dict:
    wallet = wallet_address.lower()
    with get_db() as conn:
        row = conn.execute("SELECT * FROM users WHERE wallet_address = ?", (wallet,)).fetchone()
        if row:
            return dict(row)
        conn.execute("INSERT INTO users (wallet_address) VALUES (?)", (wallet,))
        row = conn.execute("SELECT * FROM users WHERE wallet_address = ?", (wallet,)).fetchone()
        return dict(row)


def create_trip(name: str, organizer_wallet: str, contract_trip_id: int = None,
                treasury_address: str = None, spend_limit_usd: float = 100.0) -> dict:
    with get_db() as conn:
        cursor = conn.execute(
            "INSERT INTO trips (name, organizer_wallet, contract_trip_id, treasury_address, spend_limit_usd) VALUES (?, ?, ?, ?, ?)",
            (name, organizer_wallet.lower(), contract_trip_id, treasury_address, spend_limit_usd),
        )
        trip_id = cursor.lastrowid
        # Add organizer as first member
        conn.execute(
            "INSERT INTO trip_members (trip_id, wallet_address) VALUES (?, ?)",
            (trip_id, organizer_wallet.lower()),
        )
        row = conn.execute("SELECT * FROM trips WHERE id = ?", (trip_id,)).fetchone()
        return dict(row)


def get_trip(trip_id: int) -> dict | None:
    with get_db() as conn:
        row = conn.execute("SELECT * FROM trips WHERE id = ?", (trip_id,)).fetchone()
        return dict(row) if row else None


def list_trips(wallet_address: str) -> list[dict]:
    wallet = wallet_address.lower()
    with get_db() as conn:
        rows = conn.execute(
            """SELECT t.* FROM trips t
               JOIN trip_members tm ON t.id = tm.trip_id
               WHERE tm.wallet_address = ?
               ORDER BY t.created_at DESC""",
            (wallet,),
        ).fetchall()
        return [dict(r) for r in rows]


def add_trip_member(trip_id: int, wallet_address: str, display_name: str = "") -> None:
    with get_db() as conn:
        conn.execute(
            "INSERT OR IGNORE INTO trip_members (trip_id, wallet_address, display_name) VALUES (?, ?, ?)",
            (trip_id, wallet_address.lower(), display_name),
        )


def get_trip_members(trip_id: int) -> list[dict]:
    with get_db() as conn:
        rows = conn.execute(
            "SELECT * FROM trip_members WHERE trip_id = ?", (trip_id,)
        ).fetchall()
        return [dict(r) for r in rows]


def log_conversation(trip_id: int, wallet_address: str, user_transcript: str,
                     assistant_response: str, duration_ms: int):
    with get_db() as conn:
        conn.execute(
            "INSERT INTO conversations (trip_id, wallet_address, user_transcript, assistant_response, duration_ms) VALUES (?, ?, ?, ?, ?)",
            (trip_id, wallet_address.lower(), user_transcript, assistant_response, duration_ms),
        )
