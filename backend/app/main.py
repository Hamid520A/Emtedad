# backend/app/main.py
import random
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi import FastAPI, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
from typing import List, Optional
from . import crud, schemas, models, auth, database
import shutil, os
from pydantic import BaseModel

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"], # برای تست راحت‌تر روی همه باز گذاشتم، بعداً محدود کن
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
class StatusUpdate(BaseModel):
    status: str

models.Base.metadata.create_all(bind=database.engine)
UPLOAD_DIR = "static/uploads"
if not os.path.exists(UPLOAD_DIR):
    os.makedirs(UPLOAD_DIR)
app.mount("/static", StaticFiles(directory="static"), name="static")

@app.post("/register", response_model=schemas.User)
def register(user: schemas.UserCreate, db: Session = Depends(database.get_db)):
    db_user = crud.get_user_by_phone(db, phone=user.phone)
    if db_user:
        raise HTTPException(status_code=400, detail="شماره قبلاً ثبت شده")
    db_user_national = db.query(models.User).filter(models.User.national_id == user.national_id).first()
    if db_user_national:
        raise HTTPException(status_code=400, detail="کد ملی قبلاً ثبت شده")
    return crud.create_user(db=db, user=user) 
  
@app.post("/login")
def login(login_data: schemas.UserLogin, db: Session = Depends(database.get_db)):
    user = db.query(models.User).filter(models.User.phone == login_data.phone).first()
    if not user or not auth.verify_password(login_data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="شماره یا رمز عبور اشتباه است")
    token = auth.create_access_token(data={"sub": user.phone})
    return {"access_token": token, "token_type": "bearer"}

@app.get("/contests", response_model=List[schemas.Contest])
def get_all_contests(status: Optional[str] = None, db: Session = Depends(database.get_db)):
    return crud.get_contests(db, status=status)

@app.get("/contests/{contest_id}", response_model=schemas.Contest)
def get_contest_detail(contest_id: int, db: Session = Depends(database.get_db)):
    contest = crud.get_contest(db, contest_id=contest_id)
    if not contest:
        raise HTTPException(status_code=404, detail="مسابقه یافت نشد")
    return contest

# --- اصلاح شده: دریافت سوالات ---
@app.get("/contests/{contest_id}/questions", response_model=List[schemas.RandomizedQuestion])
def get_questions_list(contest_id: int, db: Session = Depends(database.get_db)):
    # ۱. دریافت اطلاعات مسابقه برای دانستن محدودیت تعداد سوالات
    contest = db.query(models.Contest).filter(models.Contest.id == contest_id).first()
    if not contest:
        raise HTTPException(status_code=404, detail="مسابقه یافت نشد")
    # ۲. دریافت تمام سوالات موجود برای این مسابقه
    all_questions = db.query(models.Question).filter(models.Question.contest_id == contest_id).all()
    # ۳. انتخاب تصادفی سوالات بر اساس حد تعیین شده
    limit = contest.question_limit or 15
    selected_questions = random.sample(all_questions, min(len(all_questions), limit))
    processed_questions = []
    for q in selected_questions:
        # ۴. جابه‌جا کردن گزینه‌ها برای هر سوال
        options = [
            {"text": q.option_1, "id": 1},
            {"text": q.option_2, "id": 2},
            {"text": q.option_3, "id": 3},
            {"text": q.option_4, "id": 4},
        ]
        random.shuffle(options) # جابه‌جایی تصادفی لیست گزینه‌ها
        
        processed_questions.append({
            "id": q.id,
            "text": q.text,
            "description": q.description,
            "shuffled_options": options, # گزینه‌های جابه‌جا شده
            "correct_option": q.correct_option # برای بررسی نهایی در فرانت‌ند
        })
    return processed_questions

@app.post("/contests", response_model=schemas.Contest)
def create_new_contest(contest: schemas.ContestCreate, db: Session = Depends(database.get_db)):
    return crud.create_contest(db=db, contest=contest)

# --- اصلاح شده: اضافه کردن سوال (حتماً POST باشد) ---
@app.post("/contests/{contest_id}/questions", response_model=schemas.Question)
def add_question_to_contest(contest_id: int, question: schemas.QuestionCreate, db: Session = Depends(database.get_db)):
    """اضافه کردن سوال جدید (از طریق Swagger)"""
    contest = crud.get_contest(db, contest_id=contest_id)
    if not contest:
        raise HTTPException(status_code=404, detail="مسابقه یافت نشد")
    return crud.create_question(db=db, question=question, contest_id=contest_id)

@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    file_path = os.path.join(UPLOAD_DIR, file.filename)
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    return {"url": f"http://localhost:8000/static/uploads/{file.filename}"}

@app.get("/contests/{contest_id}/leaderboard")
def get_leaderboard(contest_id: int, db: Session = Depends(database.get_db)):
    # در SQLAlchemy از order_by استفاده می‌شود نه order_item
    submissions = db.query(models.Submission).filter(
        models.Submission.contest_id == contest_id
    ).order_by(models.Submission.score.desc(), models.Submission.time_taken.asc()).all()
    
    results = []
    for index, sub in enumerate(submissions):
        national_id = sub.user.national_id or "****"
        last_four_digits = national_id[-4:] if len(national_id) >= 4 else national_id
        results.append({
            "rank": index + 1,
            "user_id": sub.user_id,
            "name": f"{sub.user.first_name} {sub.user.last_name}",
            "score": sub.score,
            "time": sub.time_taken,
            "last_four_id": last_four_digits
        })
    return results

@app.get("/users/me/profile")
def get_user_profile(db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    all_submissions = db.query(models.Submission).filter(models.Submission.user_id == current_user.id).all()
    
    unique_history = {}
    for sub in all_submissions:
        contest_id = sub.contest_id
        if contest_id not in unique_history or sub.score > unique_history[contest_id]['score']:
            unique_history[contest_id] = {
                "contest_title": sub.contest.title,
                "score": sub.score,
                "time_taken": sub.time_taken,
                "date": sub.id,
                "status": sub.contest.status
            }
            
    history = list(unique_history.values())
    total_score = sum(item['score'] for item in history)
        
    return {
        "first_name": current_user.first_name,
        "last_name": current_user.last_name,
        "phone": current_user.phone,
        "total_score": total_score,
        "contests_count": len(history),
        "history": history
    }

# --- اضافه کردن اندپوینت ثبت نمره (مهم برای پایان آزمون) ---
@app.post("/submissions")
def submit_exam(submission: schemas.SubmissionCreate, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    try:
        db_submission = models.Submission(
            user_id=current_user.id,
            contest_id=submission.contest_id,
            score=submission.score,
            time_taken=submission.time_taken
        )
        db.add(db_submission)
        db.commit()
        db.refresh(db_submission)
        return {"status": "success", "id": db_submission.id}
    except Exception as e:
        db.rollback()
        print(f"Error saving submission: {e}")
        raise HTTPException(status_code=500, detail="خطا در ذخیره نمره در دیتابیس")
    
@app.get("/leaderboard/global")
def get_global_leaderboard(db: Session = Depends(database.get_db)):
    users = db.query(models.User).all()
    results = []
    
    for user in users:
        # پیدا کردن بهترین نمره هر مسابقه برای این کاربر
        submissions = db.query(models.Submission).filter(models.Submission.user_id == user.id).all()
        unique_scores = {}
        for sub in submissions:
            if sub.contest_id not in unique_scores or sub.score > unique_scores[sub.contest_id]:
                unique_scores[sub.contest_id] = sub.score
        
        total_score = sum(unique_scores.values())
        if total_score > 0:  # فقط کسانی که امتیازی کسب کرده‌اند
            results.append({
                "id": user.id,
                "name": f"{user.first_name} {user.last_name}",
                "total_score": total_score
            })
    
    # مرتب‌سازی از بیشترین به کمترین امتیاز
    results.sort(key=lambda x: x["total_score"], reverse=True)
    
    # اختصاص رتبه
    for index, item in enumerate(results):
        item["rank"] = index + 1
        
    return results[:10]  # نمایش ۱۰ نفر برتر

@app.patch("/contests/{contest_id}/status")
def update_contest_status(contest_id: str, status_update: StatusUpdate, db: Session = Depends(database.get_db)):
    contest = db.query(models.Contest).filter(models.Contest.id == contest_id).first()
    if not contest:
        raise HTTPException(status_code=404, detail="مسابقه یافت نشد")
    
    contest.status = status_update.status
    db.commit()
    db.refresh(contest)
    
    return {"message": "وضعیت با موفقیت تغییر کرد", "new_status": contest.status}

@app.delete("/contests/{contest_id}")
def delete_contest(contest_id: str, db: Session = Depends(database.get_db)):
    contest = db.query(models.Contest).filter(models.Contest.id == contest_id).first()
    if not contest:
        raise HTTPException(status_code=404, detail="مسابقه یافت نشد")
    
    # حذف مسابقه از دیتابیس
    db.delete(contest)
    db.commit()
    
    return {"message": "مسابقه با موفقیت حذف شد"}