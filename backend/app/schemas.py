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
    
class Contest(ContestBase):
    id: int
    questions: List[Question] = [] # <-- این تنها خطی است که به کلاس خودت اضافه شد

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