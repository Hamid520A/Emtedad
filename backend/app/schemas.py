# backend/app/schemas.py
import re

from pydantic import BaseModel, ConfigDict, field_validator, field_serializer, Field, model_validator
from typing import List, Literal, Optional
from datetime import datetime, date, time, timezone
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
MIN_REGISTRATION_AGE = 14

def is_valid_iranian_national_id(code: str) -> bool:
    if not re.match(r'^\d{10}$', code): 
        return False
    if len(set(code)) == 1: # جلوگیری از کدهای فیک مثل 1111111111
        return False
    check_digit = int(code[9])
    sum_digits = sum(int(code[i]) * (10 - i) for i in range(9)) % 11
    return check_digit == sum_digits if sum_digits < 2 else check_digit + sum_digits == 11

class UserBase(BaseModel):
    first_name: str = Field(..., min_length=2, max_length=50, strip_whitespace=True)
    last_name: str = Field(..., min_length=2, max_length=50, strip_whitespace=True)
    phone_number: str = Field(..., pattern=r"^09\d{9}$", strip_whitespace=True)
    national_id: str = Field(..., strip_whitespace=True) # پترن حذف شد تا در ولیدیتور کنترل شود
    is_iranian: bool = True  # 🌟 فلگ تشخیص ملیت (پیش‌فرض: ایرانی)
    city_id: int = Field(..., gt=0)
    birth_date: date
    gender: str = Field(..., pattern=r"^(male|female)$", max_length=10)

    @field_validator("phone_number", "national_id", mode="before")
    @classmethod
    def convert_persian_digits(cls, value):
        if not value: return value
        trans_table = str.maketrans("۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩", "01234567890123456789")
        return str(value).translate(trans_table)

    # 🌟 شاه‌کلید معماری: ولیدیشن داینامیک بر اساس ملیت
    @model_validator(mode="after")
    def validate_identity(self):
        nat_id = self.national_id
        if not nat_id:
            raise ValueError("کد هویتی نمی‌تواند خالی باشد")
        
        if self.is_iranian:
            # بررسی سخت‌گیرانه ریاضی برای ایرانی‌ها
            if not is_valid_iranian_national_id(nat_id):
                raise ValueError("کد ملی وارد شده نامعتبر یا جعلی است.")
        else:
            # بررسی انعطاف‌پذیر برای اتباع (فقط عدد بین ۹ تا ۱۶ رقم)
            if not re.match(r'^\d{9,16}$', nat_id):
                raise ValueError("شناسه اتباع باید فقط شامل اعداد و بین ۹ تا ۱۶ رقم باشد.")
                
        return self

    @field_validator("birth_date", mode="before")
    @classmethod
    def validate_min_age(cls, value):
        if value is None or (isinstance(value, str) and not str(value).strip()):
            raise ValueError("وارد کردن تاریخ تولد الزامی است.")
        if isinstance(value, date):
            gregorian_date = value.date() if hasattr(value, "date") else value
        else:
            val_str = str(value)
            trans_table = str.maketrans("۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩", "01234567890123456789")
            val_str = val_str.translate(trans_table).replace("-", "/")
            try:
                if val_str.startswith("13") or val_str.startswith("14"):
                    parsed_jalali = jdatetime.datetime.strptime(val_str, '%Y/%m/%d')
                    gregorian_date = parsed_jalali.togregorian().date()
                else:
                    gregorian_date = date.fromisoformat(val_str.replace("/", "-"))
            except ValueError:
                raise ValueError("فرمت تاریخ تولد نامعتبر است (مثال صحیح: 1390/01/01)")

        birth_jalali = jdatetime.date.fromgregorian(date=gregorian_date)
        today_jalali = jdatetime.date.today()
        earliest_allowed_birth = today_jalali.replace(year=today_jalali.year - MIN_REGISTRATION_AGE)

        if birth_jalali > earliest_allowed_birth:
            raise ValueError("حداقل سن برای ثبت‌نام ۱۴ سال است.")

        return gregorian_date

class UserCreate(UserBase):
    password: str = Field(..., min_length=8, max_length=128, strip_whitespace=True)

class UserProfileUpdate(BaseModel):
    first_name: str = Field(..., min_length=2, max_length=50, strip_whitespace=True)
    last_name: str = Field(..., min_length=2, max_length=50, strip_whitespace=True)
    birth_date: str = Field(..., min_length=8, strip_whitespace=True)
    # Prefer city_id so we never accidentally save a province row (parent_id IS NULL)
    city_id: int = Field(..., gt=0)
    # Optional legacy title fields (ignored for persistence when city_id is present)
    province: Optional[str] = Field(None, min_length=2, strip_whitespace=True)
    city: Optional[str] = Field(None, min_length=2, strip_whitespace=True)

    @field_validator("birth_date", mode="before")
    @classmethod
    def validate_profile_birth_date(cls, value):
        if value is None or not str(value).strip():
            raise ValueError("وارد کردن تاریخ تولد الزامی است.")
        val_str = str(value)
        trans_table = str.maketrans("۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩", "01234567890123456789")
        val_str = val_str.translate(trans_table).replace("-", "/")
        try:
            if val_str.startswith("13") or val_str.startswith("14"):
                parsed_jalali = jdatetime.datetime.strptime(val_str, '%Y/%m/%d')
                gregorian_date = parsed_jalali.togregorian().date()
            else:
                gregorian_date = date.fromisoformat(val_str.replace("/", "-"))
        except ValueError:
            raise ValueError("فرمت تاریخ تولد نامعتبر است (مثال صحیح: 1390/01/01)")

        birth_jalali = jdatetime.date.fromgregorian(date=gregorian_date)
        today_jalali = jdatetime.date.today()
        earliest_allowed_birth = today_jalali.replace(year=today_jalali.year - MIN_REGISTRATION_AGE)
        if birth_jalali > earliest_allowed_birth:
            raise ValueError("حداقل سن برای ثبت‌نام ۱۴ سال است.")
        return val_str

class User(UserBase):
    id: UUID
    is_active: int
    wallet_code: Optional[int] = None
    wallet_balance: int = 0
    class Config:
        from_attributes = True

class UserAdminListOut(BaseModel):
    id: UUID
    name: str
    phone: Optional[str] = None
    national_id: Optional[str] = None
    province: str
    city: str
    gender: Optional[str] = None
    is_admin: bool
    last_contest: Optional[str] = None
    average_score: Optional[float] = None

class PaginatedUsersResponse(BaseModel):
    items: List[UserAdminListOut]
    total_count: int

class UserLogin(BaseModel):
    phone_number: str = Field(..., pattern=r"^09\d{9}$", strip_whitespace=True)
    password: str = Field(..., min_length=8, max_length=128)

    @field_validator("phone_number", "password", mode="before")
    @classmethod
    def convert_login_digits(cls, value):
        if not value: return value
        trans_table = str.maketrans("۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩", "01234567890123456789")
        return str(value).translate(trans_table)

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
    poster_url: Optional[str] = None
    video_url: Optional[str] = None
    audio_url: Optional[str] = None
    max_time: Optional[time] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    status: str = "upcoming"
    is_active: int = 1
    question_limit: Optional[int] = None
    success_message: Optional[str] = None
    failure_message: Optional[str] = None

    # DB stores naive UTC; without "Z" browsers parse it as local time.
    @field_serializer("start_time", "end_time", when_used="json")
    def serialize_utc(self, value: Optional[datetime]) -> Optional[str]:
        if value is None:
            return None
        if value.tzinfo is not None:
            value = value.astimezone(timezone.utc).replace(tzinfo=None)
        return value.isoformat() + "Z"

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
    sms_message: Optional[str] = None

class ContestUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    image_url: Optional[str] = None
    poster_url: Optional[str] = None
    video_url: Optional[str] = None
    audio_url: Optional[str] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    status: Optional[str] = None
    is_active: Optional[int] = None
    question_limit: Optional[int] = None
    time_limit: Optional[int] = None
    file_url: Optional[str] = None
    certificate_type: Optional[str] = None
    award: Optional[str] = None
    success_message: Optional[str] = None
    failure_message: Optional[str] = None
    sms_message: Optional[str] = None

class ContestListItem(ContestBase):
    id: int
    # no sms_message — public list must not expose admin SMS templates

    class Config:
        from_attributes = True

class Contest(ContestBase):
    id: int
    sms_message: Optional[str] = None  # admin create/detail responses only
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

# ==========================================
# Wallet Transaction Schemas
# ==========================================
class TransactionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: UUID
    wallet_code: int
    amount: int
    status: Literal["pending", "success", "rejected"]
    receipt_image_url: Optional[str] = None
    created_at: Optional[datetime] = None
    processed_at: Optional[datetime] = None

class TransactionAdminOut(BaseModel):
    id: int
    user_id: UUID
    user_name: str
    phone_number: Optional[str] = None
    wallet_code: int
    amount: int
    status: Literal["pending", "success", "rejected"]
    has_receipt: bool
    created_at: Optional[datetime] = None
    processed_at: Optional[datetime] = None
    processed_by_bale_id: Optional[int] = None

    @field_serializer("created_at", "processed_at", when_used="json")
    def serialize_utc(self, value: Optional[datetime]) -> Optional[str]:
        if value is None:
            return None
        if value.tzinfo is not None:
            value = value.astimezone(timezone.utc).replace(tzinfo=None)
        return value.isoformat() + "Z"

class TransactionStatusCounts(BaseModel):
    pending: int = 0
    success: int = 0
    rejected: int = 0

class PaginatedTransactionsResponse(BaseModel):
    items: List[TransactionAdminOut]
    total_count: int
    status_counts: TransactionStatusCounts

class MyTransactionOut(BaseModel):
    id: int
    amount: int
    status: Literal["pending", "success", "rejected"]
    created_at: Optional[datetime] = None
    processed_at: Optional[datetime] = None

    @field_serializer("created_at", "processed_at", when_used="json")
    def serialize_utc(self, value: Optional[datetime]) -> Optional[str]:
        if value is None:
            return None
        if value.tzinfo is not None:
            value = value.astimezone(timezone.utc).replace(tzinfo=None)
        return value.isoformat() + "Z"

class MyTransactionsResponse(BaseModel):
    wallet_balance: int
    wallet_code: Optional[int] = None
    total_count: int
    items: List[MyTransactionOut]

# ==========================================
# Bale Bot Webhook Schemas (only the fields we use)
# ==========================================
class BaleUser(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: int

class BaleChat(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: int

class BalePhotoSize(BaseModel):
    model_config = ConfigDict(extra="ignore")

    file_id: str
    file_unique_id: str
    file_size: Optional[int] = None

class BaleMessage(BaseModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)

    message_id: int
    chat: BaleChat
    from_: Optional[BaleUser] = Field(default=None, alias="from")
    photo: Optional[List[BalePhotoSize]] = None
    caption: Optional[str] = None
    text: Optional[str] = None

class BaleCallbackQuery(BaseModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)

    id: str
    from_: BaleUser = Field(alias="from")
    message: Optional[BaleMessage] = None
    data: Optional[str] = None

class BaleUpdate(BaseModel):
    model_config = ConfigDict(extra="ignore")

    update_id: int
    message: Optional[BaleMessage] = None
    callback_query: Optional[BaleCallbackQuery] = None

