# backend/app/schemas.py
from pydantic import BaseModel, field_validator, Field
from typing import List, Optional
from datetime import datetime, date, time
import jdatetime

# ==========================================
# City Schemas
# ==========================================
class CityBase(BaseModel):
    title: str
    parent_id: Optional[int] = None

class City(CityBase):
    id: int
    class Config:
        from_attributes = True

# ==========================================
# User Schemas
# ==========================================
class UserBase(BaseModel):
    first_name: str = Field(..., min_length=2, max_length=50, strip_whitespace=True)
    last_name: Optional[str] = Field(None, max_length=50, strip_whitespace=True)
    phone_number: str = Field(..., pattern=r"^09\d{9}$", strip_whitespace=True)
    national_id: str = Field(..., pattern=r"^\d{10}$", strip_whitespace=True)
    city_id: Optional[int] = None
    birth_date: Optional[date] = None
    gender: str = Field("male", max_length=10)
    @field_validator("birth_date")
    @classmethod
    def validate_min_age(cls, value):
        if value is None:
            return value
        today = date.today()
        age = today.year - value.year - ((today.month, today.day) < (value.month, value.day))
        if age < 10:
            raise ValueError("حداقل سن برای ثبت‌نام در مسابقات ۱۰ سال است.")
        return value


class UserCreate(UserBase):
    password: str = Field(..., min_length=8, max_length=128, strip_whitespace=True)

class User(UserBase):
    id: int
    is_active: int
    class Config:
        from_attributes = True

class UserLogin(BaseModel):
    phone_number: str = Field(..., pattern=r"^09\d{9}$", strip_whitespace=True)
    password: str = Field(..., min_length=8, max_length=128)

# ==========================================
# Admin Schemas (بروزرسانی شده بر اساس رابطه ۱ به ۱ جدید)
# ==========================================
class AdminBase(BaseModel):
    user_id: int
    is_active: int = 1

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

class ContestListItem(ContestBase):
    id: int

    class Config:
        from_attributes = True

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

# ==========================================
# Banner Schemas
# ==========================================
class BannerCreate(BaseModel):
    title: str
    link_url: Optional[str] = None
    image_url: str
    status: str = "active"

class BannerUserBase(BaseModel):
    banner_id: int
    user_id: int

