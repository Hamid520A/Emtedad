# backend/migrate_wallet_balance.py
# Adds users.wallet_balance and creates the transactions table for Bale receipts.
# Safe to run more than once.
#
#   docker compose run --rm backend python migrate_wallet_balance.py
import os

try:
    from dotenv import load_dotenv
    load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))
    load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))
except ImportError:
    pass

from sqlalchemy import text

from app import models
from app.database import engine


def main() -> None:
    with engine.begin() as conn:
        conn.execute(
            text("ALTER TABLE users ADD COLUMN IF NOT EXISTS wallet_balance INTEGER NOT NULL DEFAULT 0")
        )

    models.Transaction.__table__.create(engine, checkfirst=True)

    with engine.connect() as conn:
        users = conn.execute(text("SELECT count(*) FROM users")).scalar()
        transactions = conn.execute(text("SELECT count(*) FROM transactions")).scalar()

    print(f"users.wallet_balance ready ({users} users)")
    print(f"transactions table ready ({transactions} rows)")


if __name__ == "__main__":
    main()
