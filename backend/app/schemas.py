from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, date, time

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
# Admin Schemas
# ==========================================
class AdminBase(BaseModel):
    name: str
    username: str

class AdminCreate(AdminBase):
    password: str

class Admin(AdminBase):
    id: int
    is_active: int
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
# Randomized Question Schemas (برای محیط آزمون فرانت‌ند)
# ==========================================
class QuestionOption(BaseModel):
    id: int
    title: str # هماهنگ با فیلد title در مدل جدید Answer

    class Config:
        from_attributes = True

class RandomizedQuestion(BaseModel):
    id: int
    title: str # هماهنگ با فیلد title در مدل جدید Question
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
    start_time: Optional[date] = None
    end_time: Optional[date] = None
    status: str = "upcoming"
    is_active: int = 1

class ContestCreate(ContestBase):
    pass

class Contest(ContestBase):
    id: int
    questions: List[Question] = []
    attachments: List[Attachment] = []
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