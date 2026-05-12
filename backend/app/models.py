# backend/app/models.py
from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Boolean, JSON, Float, Text
from sqlalchemy.orm import relationship
from .database import Base
import datetime

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    phone = Column(String, unique=True, index=True)
    first_name = Column(String)
    last_name = Column(String, nullable=True)
    hashed_password = Column(String)
    national_id = Column(String, unique=True, index=True) # کد ملی یکتا
    province = Column(String) # استان
    city = Column(String)     # شهرستان
    gender = Column(String)   # جنسیت
    birth_date = Column(String) # تاریخ تولد
    is_active = Column(Boolean, default=True)

class Contest(Base):
    __tablename__ = "contests"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), index=True)
    description = Column(Text, nullable=True)
    image_url = Column(Text, nullable=True)
    file_url = Column(Text, nullable=True)
    start_time = Column(DateTime, nullable=True)
    end_time = Column(DateTime, nullable=True)
    status = Column(String, default="upcoming")
    award = Column(String)
    time_limit = Column(Integer, default=10) # زمان مجاز به دقیقه
    question_limit = Column(Integer, default=15) # تعداد سوالاتی که در هر آزمون نمایش داده می‌شود
    certificate_type = Column(String, nullable=True, default=None) # نوع گواهی‌نامه 
    
    questions = relationship("Question", back_populates="contest")

class Submission(Base):
    __tablename__ = "submissions"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    contest_id = Column(Integer, ForeignKey("contests.id"))
    score = Column(Float)
    time_taken = Column(Integer) # زمان صرف شده به ثانیه
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    user = relationship("User")
    contest = relationship("Contest")
    answers_map = Column(JSON, nullable=True)

class Question(Base):
    __tablename__ = "questions"

    id = Column(Integer, primary_key=True, index=True)
    contest_id = Column(Integer, ForeignKey("contests.id"))
    text = Column(String)
    description = Column(Text, nullable=True)
    
    # برای سادگی و جلوگیری از پیچیدگی دیتابیس، ۴ گزینه را همینجا ذخیره می‌کنیم
    option_1 = Column(String)
    option_2 = Column(String)
    option_3 = Column(String)
    option_4 = Column(String)
    
    # شماره گزینه صحیح (۱ تا ۴)
    correct_option = Column(Integer)

    # ارتباط با جدول مسابقه
    contest = relationship("Contest", back_populates="questions")