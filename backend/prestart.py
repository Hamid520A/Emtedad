# backend/prestart.py
# یک‌بار قبل از بالا آمدن پروسس‌های Uvicorn اجرا می‌شود تا جداول دیتابیس ساخته شوند
import logging

from app import database, models

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("emtedad_prestart")


def main() -> None:
    logger.info("Ensuring database tables exist...")
    models.Base.metadata.create_all(bind=database.engine)
    database.engine.dispose()
    logger.info("Database tables ready.")


if __name__ == "__main__":
    main()
