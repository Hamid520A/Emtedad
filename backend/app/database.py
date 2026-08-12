# backend/app/database.py
import os
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.declarative import declarative_base
import time
import logging

logger = logging.getLogger("emtedad_backend")

# 🌟 اصلاح نهایی: حذف کامل آدرس هاردکد شده زاپاس برای امنیت ۱۰۰٪ در داکر
SQLALCHEMY_DATABASE_URL = os.getenv("SQLALCHEMY_DATABASE_URL")

# سوپاپ اطمینان: اگر متغیر در فایل .env فراموش شده باشد، داکر فوراً ارور می‌دهد
if not SQLALCHEMY_DATABASE_URL:
    raise ValueError("⚠️ خطای حیاتی: متغیر SQLALCHEMY_DATABASE_URL در فایل .env یافت نشد!")

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    pool_size=20,
    max_overflow=10,
    pool_timeout=30,
    pool_recycle=1800,
    pool_pre_ping=True
)

@event.listens_for(engine, "before_cursor_execute")
def before_cursor_execute(conn, cursor, statement, parameters, context, executemany):
    context._query_start_time = time.time()

@event.listens_for(engine, "after_cursor_execute")
def after_cursor_execute(conn, cursor, statement, parameters, context, executemany):
    elapsed = time.time() - getattr(context, "_query_start_time", time.time())
    if elapsed > 0.5:
        logger.warning(f"Slow Query Detected ({elapsed:.2f}s): {statement}")
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()