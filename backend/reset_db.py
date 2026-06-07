from sqlalchemy import text
from app.database import engine, Base
# مطمئن شو مدل‌ها لود بشن تا سیستم اون‌ها رو بشناسه
from app import models 

print("resetting database...")

with engine.connect() as conn:
    with conn.begin():
        # ۱. کل اسکیمای عمومی رو با تمام وابستگی‌ها و جدول‌های مرده متحرک کلاً نابود کن
        conn.execute(text("DROP SCHEMA public CASCADE;"))
        # ۲. اسکیمای عمومی رو دوباره از نو تمیز و سفید بساز
        conn.execute(text("CREATE SCHEMA public;"))
        print("database schema dropped and recreated successfully.")

print("making new tables...")
# ۳. حالا با خیال راحت جداول خفن و جدید رو از روی مدل‌های جدید بساز
Base.metadata.create_all(bind=engine)

print("database reset successfully!")