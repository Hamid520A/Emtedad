# backend/app/schemas.py
from pydantic import BaseModel, EmailStr
from typing import List, Optional
from datetime import datetime

# ==========================================
# User Schemas
# ==========================================
class UserBase(BaseModel):
    phone: str
    first_name: str
    last_name: Optional[str] = None
    national_id: str
    province: str
    city: str
    gender: str
    birth_date: str

class UserCreate(UserBase):
    password: str

class User(UserBase):
    id: int
    class Config:
        from_attributes = True

# ==========================================
# Token Schemas
# ==========================================
class Token(BaseModel):
    access_token: str
    token_type: str

# ==========================================
# Question Schemas (اضافه شده)
# ==========================================
class QuestionBase(BaseModel):
    text: str
    description: Optional[str] = None
    option_1: str
    option_2: str
    option_3: str
    option_4: str
    correct_option: int

class QuestionCreate(QuestionBase):
    pass

class Question(QuestionBase):
    id: int
    contest_id: int

    class Config:
        from_attributes = True

# ==========================================
# Contest Schemas (ویرایش جزئی)
# ==========================================
class ContestBase(BaseModel):
    title: str
    description: str
    image_url: str
    file_url: str
    start_time: datetime
    end_time: datetime
    status: str
    award: str

class ContestCreate(BaseModel):
    title: str
    description: Optional[str] = None 
    award: Optional[str] = None
    status: str = "upcoming"
    image_url: Optional[str] = None 
    file_url: Optional[str] = None   
    start_time: Optional[datetime] = None 
    end_time: Optional[datetime] = None
    time_limit: Optional[int] = 10
    
class Contest(ContestBase):
    id: int
    questions: List[Question] = []
    time_limit: Optional[int] = 10

    class Config:
        from_attributes = True

class UserLogin(BaseModel):
    phone: str
    password: str

# اضافه کردن به انتهای فایل schemas.py

class SubmissionBase(BaseModel):
    contest_id: int
    score: int
    time_taken: int

class SubmissionCreate(SubmissionBase):
    pass

class Submission(SubmissionBase):
    id: int
    user_id: int

    class Config:
        from_attributes = True

class TokenData(BaseModel):
    phone: Optional[str] = None