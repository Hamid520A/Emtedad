# backend/app/main.py
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi import FastAPI, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from . import crud, schemas, models, auth, database
import shutil, os, random, httpx, base64
from pydantic import BaseModel
from datetime import datetime, timedelta

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
                "contest_id": contest_id, # این خط اضافه شد تا فرانت‌ند مسابقه رو پیدا کنه
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
        "history": history,
        "id": current_user.id
    }

# --- اضافه کردن اندپوینت ثبت نمره (با جلوگیری از تقلب و ثبت تکراری) ---
@app.post("/submissions")
def submit_exam(submission: schemas.SubmissionCreate, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    try:
        # ۱. بررسی اینکه آیا کاربر قبلاً در این مسابقه شرکت کرده است یا خیر
        existing_submission = db.query(models.Submission).filter(
            models.Submission.user_id == current_user.id,
            models.Submission.contest_id == submission.contest_id
        ).first()

        if existing_submission:
            # اگر قبلا شرکت کرده، ارور می‌دهیم و اجازه ثبت دوباره نمی‌دهیم
            raise HTTPException(status_code=400, detail="شما قبلاً در این آزمون شرکت کرده‌اید و نمره شما ثبت شده است!")

        # ۲. اگر اولین بار است، نتیجه را ثبت کن
        db_submission = models.Submission(
            user_id=current_user.id,
            contest_id=submission.contest_id,
            score=submission.score,
            time_taken=submission.time_taken,
            answers_map=submission.answers_map
        )
        db.add(db_submission)
        db.commit()
        db.refresh(db_submission)
        return {"status": "success", "id": db_submission.id}
        
    except HTTPException:
        # ارورهایی که خودمان raise کردیم را مستقیم برگردان (مثل ارور ۴۰۰ بالا)
        raise
    except Exception as e:
        db.rollback()
        print(f"Error saving submission: {e}")
        raise HTTPException(status_code=500, detail="خطا در ذخیره نمره در دیتابیس")
 
@app.get("/leaderboard/global")
def get_global_leaderboard(db: Session = Depends(database.get_db)):
    users = db.query(models.User).all()
    results = []
    
    for user in users:
        # پیدا کردن بهترین نمره و زمان هر مسابقه برای این کاربر
        submissions = db.query(models.Submission).filter(models.Submission.user_id == user.id).all()
        unique_scores = {}
        for sub in submissions:
            # اگر مسابقه جدید بود یا نمره این دفعه از نمره قبلی بیشتر بود
            if sub.contest_id not in unique_scores or sub.score > unique_scores[sub.contest_id]['score']:
                unique_scores[sub.contest_id] = {'score': sub.score, 'time': sub.time_taken}
        
        total_score = sum(item['score'] for item in unique_scores.values())
        total_time = sum(item['time'] for item in unique_scores.values())
        
        if total_score > 0:  # فقط کسانی که امتیازی کسب کرده‌اند
            national_id = user.national_id or "****"
            last_four = national_id[-4:] if len(national_id) >= 4 else national_id
            
            results.append({
                "id": user.id,
                "name": f"{user.first_name} {user.last_name}",
                "total_score": total_score,
                "total_time": total_time,
                "last_four_id": last_four
            })
    
    # مرتب‌سازی: اول بر اساس بیشترین نمره، بعد بر اساس کمترین زمان
    results.sort(key=lambda x: (x["total_score"], -x["total_time"]), reverse=True)
    
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

@app.get("/users/me/submissions/{contest_id}")
def get_user_submission(contest_id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    sub = db.query(models.Submission).filter(
        models.Submission.user_id == current_user.id, 
        models.Submission.contest_id == contest_id
    ).first()
    
    if not sub:
        raise HTTPException(status_code=404, detail="نتیجه‌ای یافت نشد")
        
    return {"answers_map": sub.answers_map or {}}

@app.get("/admin/stats")
async def get_admin_stats(db: Session = Depends(database.get_db)):
    # تعداد کل کاربرها
    total_users = db.query(models.User).count()
    # تعداد کل مسابقات
    total_contests = db.query(models.Contest).count()
    # تعداد مسابقات فعال
    active_contests = db.query(models.Contest).filter(models.Contest.status == "active").count()
    # ۲. دیتای نمودار برای ۷ روز اخیر
    seven_days_ago = datetime.now() - timedelta(days=7)
    # کوئری برای گروه‌بندی بر اساس تاریخ
    chart_query = db.query(
        func.date(models.User.created_at).label('date'),
        func.count(models.User.id).label('count')
    ).filter(models.User.created_at >= seven_days_ago)\
     .group_by(func.date(models.User.created_at))\
     .order_by(func.date(models.User.created_at)).all()
    # تبدیل فرمت برای فرانت‌ند
    chart_data = [{"name": str(row.date), "users": row.count} for row in chart_query]
    
    return {
        "total_users": total_users,
        "total_contests": total_contests,
        "active_contests": active_contests,
        "chart_data": chart_data
    }

@app.get("/admin/export-data")
def get_export_data(db: Session = Depends(database.get_db)):
    # ۱. گرفتن تمام کاربران
    users = db.query(models.User).all()
    
    report = []
    for u in users:
        # ۲. پیدا کردن نمره این کاربر خاص در جدول Submission
        # فرض می‌کنیم در مدل Submission فیلدی به نام user_id داری
        submission = db.query(models.Submission).filter(models.Submission.user_id == u.id).first()
        
        # ۳. پیدا کردن نام مسابقه (اگر شرکت کرده باشد)
        contest_title = "شرکت نکرده"
        if submission:
            contest = db.query(models.Contest).filter(models.Contest.id == submission.contest_id).first()
            if contest:
                contest_title = contest.title

        report.append({
            "نام": u.first_name or "---",
            "نام خانوادگی": u.last_name or "---",
            "شماره تماس": u.phone,
            "کد ملی": u.national_id or "---",
            "استان": u.province or "---",
            "جنسیت": u.gender or "---",
            "نام مسابقه": contest_title,
            "نمره": submission.score if submission else 0,
            "زمان (ثانیه)": submission.time_taken if submission else 0,
            "تاریخ ثبت‌نام": u.created_at.strftime("%Y/%m/%d") if u.created_at else "---"
        })
    
    return report
    # ۱. گرفتن تمام کاربران (حتی کسانی که هنوز شرکت نکرده‌اند)
    users = db.query(models.User).all()
    
    # اگر کلاً کاربری نبود
    if not users:
        return []

    report = []
    for u in users:
        # ۲. پیدا کردن آخرین شرکت در مسابقه برای این کاربر (اگر وجود داشته باشد)
        # فرض می‌کنیم رابطه submissions در مدل User تعریف شده است
        last_submission = db.query(models.Submission).filter(models.Submission.user_id == u.id).first()
        
        report.append({
            "نام": u.first_name or "---",
            "نام خانوادگی": u.last_name or "---",
            "شماره تماس": u.phone,
            "کد ملی": getattr(u, 'national_id', '---'), # اگر فیلد کد ملی نداری جاش خالی می‌مونه
            "نام مسابقه": last_submission.contest.title if last_submission else "شرکت نکرده",
            "نمره": last_submission.score if last_submission else 0,
            "زمان (ثانیه)": last_submission.time_taken if last_submission else 0,
            "تاریخ ثبت نام": str(u.created_at) if hasattr(u, 'created_at') else "---"
        })
    
    return report

@app.post("/proxy-upload")
async def proxy_get_profile_photo(request_data: dict):
    # آدرس API مقصد (ایتا)
    EITAA_API_URL = "http://10.10.10.4:3000/send" 
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(
                EITAA_API_URL,
                json=request_data,
                timeout=30.0
            )
            
            result = response.json()
            
            # اگر دیتا به صورت خام (bytes) بود، اینجا مطمئن می‌شویم که برای JSON معتبر است
            # معمولاً کلاینت‌های تلگرامی دیتای bytes را به صورت base64 برمی‌گردانند
            return result
            
        except Exception as e:
            return {"status": "error", "message": str(e)}