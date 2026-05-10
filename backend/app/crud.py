# backend/app/crud.py
from typing import Optional
from sqlalchemy.orm import Session
from . import models, schemas, auth

# عملیات مربوط به کاربر
def get_user_by_phone(db: Session, phone: str):
    return db.query(models.User).filter(models.User.phone == phone).first()

def create_user(db: Session, user: schemas.UserCreate):
    hashed_pwd = auth.get_password_hash(user.password)
    db_user = models.User(
        phone=user.phone,
        first_name=user.first_name,
        last_name=user.last_name,
        hashed_password=hashed_pwd
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

def create_contest(db: Session, contest: schemas.ContestCreate):
    # تبدیل اسکیما به مدل دیتابیس
    db_contest = models.Contest(**contest.model_dump())
    db.add(db_contest)
    db.commit()
    db.refresh(db_contest)
    return db_contest

def create_question(db: Session, question: schemas.QuestionCreate, contest_id: int):
    # اضافه کردن سوال با آیدی مسابقه مربوطه
    db_question = models.Question(**question.model_dump(), contest_id=contest_id)
    db.add(db_question)
    db.commit()
    db.refresh(db_question)
    return db_question

# عملیات مربوط به مسابقات
def get_contests(db: Session, status: Optional[str] = None):
    query = db.query(models.Contest)
    if status:
        query = query.filter(models.Contest.status == status)
    return query.all()

def get_contest(db: Session, contest_id: int):
    return db.query(models.Contest).filter(models.Contest.id == contest_id).first()

# ذخیره نتیجه آزمون
def create_submission(db: Session, user_id: int, contest_id: int, score: float, time_taken: int):
    db_sub = models.Submission(
        user_id=user_id,
        contest_id=contest_id,
        score=score,
        time_taken=time_taken
    )
    db.add(db_sub)
    db.commit()
    db.refresh(db_sub)
    return db_sub

