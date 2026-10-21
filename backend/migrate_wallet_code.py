# backend/migrate_wallet_code.py
# Adds users.wallet_code, gives every user without one a unique 6-digit code,
# and creates the unique index. Safe to run more than once.
#
#   docker compose run --rm backend python migrate_wallet_code.py
import os

try:
    from dotenv import load_dotenv
    load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))
    load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))
except ImportError:
    pass

from sqlalchemy import text

from app.database import engine
from app.services.wallet_code import WALLET_CODE_MAX, WALLET_CODE_MIN, random_wallet_code

BATCH_SIZE = 500


def main() -> None:
    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS wallet_code INTEGER"))

    with engine.connect() as conn:
        used = {
            row[0]
            for row in conn.execute(text("SELECT wallet_code FROM users WHERE wallet_code IS NOT NULL"))
        }
        user_ids = [
            str(row[0])
            for row in conn.execute(
                text("SELECT id FROM users WHERE wallet_code IS NULL ORDER BY created_at NULLS LAST")
            )
        ]

    capacity = WALLET_CODE_MAX - WALLET_CODE_MIN + 1
    if len(used) + len(user_ids) > capacity:
        raise SystemExit(f"Not enough 6-digit codes: need {len(used) + len(user_ids)}, have {capacity}")

    updated = 0
    for start in range(0, len(user_ids), BATCH_SIZE):
        rows = []
        for user_id in user_ids[start:start + BATCH_SIZE]:
            code = random_wallet_code()
            while code in used:
                code = random_wallet_code()
            used.add(code)
            rows.append({"id": user_id, "code": code})

        with engine.begin() as conn:
            conn.execute(
                text(
                    "UPDATE users SET wallet_code = :code "
                    "WHERE id = CAST(:id AS uuid) AND wallet_code IS NULL"
                ),
                rows,
            )
        updated += len(rows)
        print(f"Assigned wallet codes: {updated}/{len(user_ids)}")

    with engine.begin() as conn:
        conn.execute(
            text("CREATE UNIQUE INDEX IF NOT EXISTS ix_users_wallet_code ON users (wallet_code)")
        )

    with engine.connect() as conn:
        missing = conn.execute(text("SELECT count(*) FROM users WHERE wallet_code IS NULL")).scalar()
        duplicates = conn.execute(
            text(
                "SELECT count(*) FROM (SELECT wallet_code FROM users WHERE wallet_code IS NOT NULL "
                "GROUP BY wallet_code HAVING count(*) > 1) d"
            )
        ).scalar()

    print(f"Users updated this run: {updated}")
    print(f"Users still without a wallet code: {missing}")
    print(f"Duplicate wallet codes: {duplicates}")


if __name__ == "__main__":
    main()
