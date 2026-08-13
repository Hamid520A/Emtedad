# backend/app/schemas.py
from pydantic import BaseModel, field_validator, Field
from typing import List, Optional
from datetime import datetime, date, time
import jdatetime
from uuid import UUID

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

    # 🌟 استفاده از mode="before" برای شکار دیتا قبل از پردازش اشتباهِ Pydantic
    @field_validator("birth_date", mode="before")
    @classmethod
    def validate_min_age(cls, value):
        if not value:
            return None
            
        # ۱. یکدست‌سازی اعداد فارسی به انگلیسی و کاراکتر جداکننده
        val_str = str(value)
        trans_table = str.maketrans("۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩", "01234567890123456789")
        val_str = val_str.translate(trans_table).replace("-", "/")
        
        # ۲. تبدیل هوشمند تاریخ شمسی به میلادی
        try:
            # تلاش برای درک فرمت شمسی ارسالی فرانت‌اند (مثلا 1395/05/20)
            parsed_jalali = jdatetime.datetime.strptime(val_str, '%Y/%m/%d')
            gregorian_date = parsed_jalali.togregorian().date()
        except ValueError:
            # سوپاپ اطمینان: اگر به هر دلیلی میلادی بود، آن را هم می‌فهمیم
            try:
                gregorian_date = date.fromisoformat(val_str.replace("/", "-"))
            except ValueError:
                raise ValueError("فرمت تاریخ تولد نامعتبر است (مثال صحیح: 1390/01/01)")

        # ۳. محاسبه دقیق سن بر اساس سال میلادی
        today = date.today()
        age = today.year - gregorian_date.year - ((today.month, today.day) < (gregorian_date.month, gregorian_date.day))
        
        if age < 10:
            raise ValueError("حداقل سن برای ثبت‌نام در مسابقات ۱۰ سال است.")
            
        # ۴. پاس دادن تاریخ استاندارد میلادی برای ذخیره صحیح در دیتابیس
        return gregorian_date


class UserCreate(UserBase):
    password: str = Field(..., min_length=8, max_length=128, strip_whitespace=True)

class User(UserBase):
    id: UUID
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
    user_id: UUID
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
    user_id: UUID

class Subscription(SubscriptionBase):
    id: int
    user_id: UUID
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
    user_id: UUID

