# backend/app/database.py
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.declarative import declarative_base

# 🌟 اصلاح نهایی: حذف کامل آدرس هاردکد شده زاپاس برای امنیت ۱۰۰٪ در داکر
SQLALCHEMY_DATABASE_URL = os.getenv("SQLALCHEMY_DATABASE_URL")

# سوپاپ اطمینان: اگر متغیر در فایل .env فراموش شده باشد، داکر فوراً ارور می‌دهد
if not SQLALCHEMY_DATABASE_URL:
    raise ValueError("⚠️ خطای حیاتی: متغیر SQLALCHEMY_DATABASE_URL در فایل .env یافت نشد!")

engine = create_engine(SQLALCHEMY_DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()