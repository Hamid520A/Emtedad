# backend/app/schemas.py
from pydantic import BaseModel, field_validator
from typing import List, Optional
from datetime import datetime, date, time
import jdatetime

# ==========================================
# City Schemas
# ==========================================
class CityBase(BaseModel):
    title: str
    parent_id: Optional[int] = None

class CityCreate(CityBase):
    pass

class City(CityBase):
    id: int
    class Config:
        from_attributes = True

# ==========================================
# User Schemas
# ==========================================
class UserBase(BaseModel):
    first_name: str
    last_name: Optional[str] = None
    phone_number: str
    national_id: str
    city_id: Optional[int] = None
    birth_date: Optional[date] = None
    gender: str = "male"
    @field_validator("birth_date")
    @classmethod
    def validate_min_age(cls, value):
        if value is None:
            return value
        
        # تبدیل تاریخ میلادی امروز به شمسی جهت محاسبه همگن و دقیق سن
        today_gregorian = date.today()
        today_jalali = jdatetime.date.fromgregorian(date=today_gregorian)
        
        # محاسبه دقیق سن با توجه به سال، ماه و روز در تقویم جلالی
        age = today_jalali.year - value.year - ((today_jalali.month, today_jalali.day) < (value.month, value.day))
        
        if age < 10:
            raise ValueError("حداقل سن برای ثبت‌نام در مسابقات ۱۰ سال است.")
        
        return value


class UserCreate(UserBase):
    password: str

class User(UserBase):
    id: int
    is_active: int
    class Config:
        from_attributes = True

class UserLogin(BaseModel):
    phone_number: str
    password: str

# ==========================================
# Admin Schemas (بروزرسانی شده بر اساس رابطه ۱ به ۱ جدید)
# ==========================================
class AdminBase(BaseModel):
    user_id: int
    is_active: int = 1

class AdminCreate(BaseModel):
    user_id: int

class Admin(AdminBase):
    id: int
    class Config:
        from_attributes = True

# ==========================================
# AdminLog Schemas
# ==========================================
class AdminLogBase(BaseModel):
    action: str
    target_model: Optional[str] = None
    target_id: Optional[int] = None
    description: Optional[str] = None

class AdminLogCreate(AdminLogBase):
    admin_id: int

class AdminLogOut(AdminLogBase):
    id: int
    admin_id: int
    created_at: datetime

    class Config:
        from_attributes = True

# ==========================================
# Answer Schemas
# ==========================================
class AnswerBase(BaseModel):
    title: str
    is_correct: int = 0

class AnswerCreate(AnswerBase):
    pass

class Answer(AnswerBase):
    id: int
    question_id: int
    class Config:
        from_attributes = True

# ==========================================
# Question Schemas
# ==========================================
class QuestionBase(BaseModel):
    title: str
    description: Optional[str] = None
    is_active: int = 1

class QuestionCreate(QuestionBase):
    answers: List[AnswerCreate]

class Question(QuestionBase):
    id: int
    contest_id: int
    answers: List[Answer] = []
    class Config:
        from_attributes = True

# ==========================================
# Randomized Question Schemas
# ==========================================
class QuestionOption(BaseModel):
    id: int
    title: str 

    class Config:
        from_attributes = True

class RandomizedQuestion(BaseModel):
    id: int
    title: str 
    description: Optional[str] = None
    shuffled_options: List[QuestionOption]
    
    class Config:
        from_attributes = True

# ==========================================
# Attachment Schemas
# ==========================================
class AttachmentBase(BaseModel):
    file_name: str
    file_subtitle: Optional[str] = None
    file_url: str
    file_type: str
    file_size: int

class Attachment(AttachmentBase):
    id: int
    contest_id: int
    class Config:
        from_attributes = True

# ==========================================
# Contest Schemas
# ==========================================
class ContestBase(BaseModel):
    title: str
    description: Optional[str] = None
    image_url: Optional[str] = None
    video_url: Optional[str] = None
    max_time: Optional[time] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    status: str = "upcoming"
    is_active: int = 1
    question_limit: Optional[int] = None

class ContestCreate(ContestBase):
    title: str
    description: Optional[str] = None
    status: str = "upcoming"
    image_url: Optional[str] = None
    file_url: Optional[str] = None
    video_url: Optional[str] = None
    time_limit: int
    question_limit: int
    certificate_type: str = "none"
    award: Optional[str] = None  
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None

class Contest(ContestBase):
    id: int
    questions: List[Question] = []
    attachments: List[Attachment] = []
    class Config:
        from_attributes = True

class AwardDetailOut(BaseModel):
    rank: int
    title: str
    class Config:
        from_attributes = True

class ContestDetailOut(BaseModel):
    id: int
    title: str
    description: Optional[str] = None
    image_url: Optional[str] = None
    video_url: Optional[str] = None
    status: str
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    question_limit: Optional[int] = None
    time_limit: int                         
    file_url: Optional[str] = None          
    awards: List[AwardDetailOut] = []       
    certificate_type: str                   

    class Config:
        from_attributes = True

# ==========================================
# Subscription Schemas
# ==========================================
class SubscriptionBase(BaseModel):
    contest_id: int
    time_left: Optional[time] = None
    score: int = 0
    is_left: int = 0
    started_at: Optional[datetime] = None

class SubscriptionCreate(SubscriptionBase):
    user_id: int

class Subscription(SubscriptionBase):
    id: int
    user_id: int
    class Config:
        from_attributes = True

# ==========================================
# Token Schemas
# ==========================================
class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    phone_number: Optional[str] = None

# ==========================================
# Banner Schemas
# ==========================================
class BannerCreate(BaseModel):
    title: str
    link_url: Optional[str] = None
    image_url: str
    status: str = "active"

class BannerOut(BannerCreate):
    id: int
    class Config:
        from_attributes = True

class BannerUserBase(BaseModel):
    banner_id: int
    user_id: int

class BannerUserCreate(BannerUserBase):
    pass

class BannerUser(BannerUserBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True