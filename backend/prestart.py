# backend/prestart.py
# یک‌بار قبل از بالا آمدن پروسس‌های Uvicorn اجرا می‌شود تا جداول دیتابیس ساخته شوند
import logging

from sqlalchemy import text

from app import database, models

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("emtedad_prestart")


def upgrade_certificate_users() -> None:
    """create_all never alters existing tables; bring certificate_users up to the issuance schema."""
    with database.engine.begin() as conn:
        serial_type = conn.execute(text(
            "SELECT data_type FROM information_schema.columns "
            "WHERE table_name = 'certificate_users' AND column_name = 'serial_number'"
        )).scalar()
        if serial_type == "integer":
            logger.info("Widening certificate_users.serial_number to BIGINT...")
            conn.execute(text("ALTER TABLE certificate_users ALTER COLUMN serial_number TYPE BIGINT"))
        conn.execute(text(
            "CREATE UNIQUE INDEX IF NOT EXISTS uq_certificate_users_user_certificate "
            "ON certificate_users (user_id, certificate_id)"
        ))


def main() -> None:
    logger.info("Ensuring database tables exist...")
    models.Base.metadata.create_all(bind=database.engine)
    upgrade_certificate_users()
    database.engine.dispose()
    logger.info("Database tables ready.")


if __name__ == "__main__":
    main()
