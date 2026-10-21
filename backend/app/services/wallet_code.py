# backend/app/services/wallet_code.py
import secrets

from sqlalchemy.orm import Session

from app import models

WALLET_CODE_MIN = 100000
WALLET_CODE_MAX = 999999


def random_wallet_code() -> int:
    return WALLET_CODE_MIN + secrets.randbelow(WALLET_CODE_MAX - WALLET_CODE_MIN + 1)


def generate_unique_wallet_code(db: Session, max_attempts: int = 20) -> int:
    for _ in range(max_attempts):
        code = random_wallet_code()
        if not db.query(models.User.id).filter(models.User.wallet_code == code).first():
            return code
    raise RuntimeError("Could not allocate a unique wallet_code")
