from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.declarative import declarative_base

# آدرس اتصال به دیتابیس جدید PostgreSQL
SQLALCHEMY_DATABASE_URL = "postgresql://yara_user:123456@127.0.0.1/yara_db"

engine = create_engine(SQLALCHEMY_DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# این تابعی بود که جا مونده بود!
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()