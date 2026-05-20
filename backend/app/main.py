# backend/app/main.py
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi import FastAPI, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from . import crud, schemas, models, auth, database
import shutil, os, random, httpx, base64, redis
from pydantic import BaseModel
from datetime import datetime, timedelta

app = FastAPI()
ACCOUNT_REDIS_HOST = os.getenv("REDIS_HOST", "10.10.10.6")
ACCOUNT_REDIS_PORT = int(os.getenv("REDIS_PORT", 6379))
ACCOUNT_REDIS_DB = int(os.getenv("REDIS_DB", 0))
ACCOUNT_KEY = os.getenv("ACCOUNT_KEY", "latest_session:989944774408")
r = redis.Redis(host=ACCOUNT_REDIS_HOST, port=ACCOUNT_REDIS_PORT, db=ACCOUNT_REDIS_DB, decode_responses=True)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"], # برای تست راحت‌تر روی همه باز گذاشتم، بعداً محدود کن
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
class StatusUpdate(BaseModel):
    status: str

class QuestionUpdate(BaseModel):
    text: str
    description: Optional[str] = None
    option_1: str
    option_2: str
    option_3: str
    option_4: str
    correct_option: int

models.Base.metadata.create_all(bind=database.engine)
UPLOAD_DIR = "static/uploads"
if not os.path.exists(UPLOAD_DIR):
    os.makedirs(UPLOAD_DIR)
app.mount("/static", StaticFiles(directory="static"), name="static")

def require_admin(current_user: models.User = Depends(auth.get_current_user)):
    """بررسی سطح دسترسی مدیر سیستم"""
    if not getattr(current_user, "is_admin", False):
        raise HTTPException(status_code=403, detail="شما دسترسی به این بخش را ندارید")
    return current_user

def fa_to_en_digits(text: str) -> str:
    """تبدیل تمام اعداد فارسی و عربی یک متن به اعداد انگلیسی استاندارد"""
    if not text:
        return text
    
    # مپینگ اعداد فارسی و عربی به انگلیسی
    fa_digits = "۰۱۲۳۴۵۶۷۸۹"
    ar_digits = "٠١٢٣٤٥٦٧٨٩"
    en_digits = "0123456789"
    
    # ساخت جدول ترجمه
    translation_table = str.maketrans(fa_digits + ar_digits, en_digits + en_digits)
    return text.translate(translation_table)

@app.post("/register", response_model=schemas.User)
def register(user: schemas.UserCreate, db: Session = Depends(database.get_db)):
    # یکدست‌سازی شماره تلفن و رمز عبور به اعداد انگلیسی
    user.phone = fa_to_en_digits(user.phone)
    user.password = fa_to_en_digits(user.password) # 👈 این خط اضافه شد
    
    db_user = crud.get_user_by_phone(db, phone=user.phone)
    if db_user:
        raise HTTPException(status_code=400, detail="شماره قبلاً ثبت شده")
    db_user_national = db.query(models.User).filter(models.User.national_id == user.national_id).first()
    if db_user_national:
        raise HTTPException(status_code=400, detail="کد ملی قبلاً ثبت شده")
    return crud.create_user(db=db, user=user) 
  
@app.post("/login")
def login(login_data: schemas.UserLogin, db: Session = Depends(database.get_db)):
    # یکدست‌سازی شماره تلفن و رمز عبور به اعداد انگلیسی
    login_data.phone = fa_to_en_digits(login_data.phone)
    login_data.password = fa_to_en_digits(login_data.password) # 👈 این خط اضافه شد
    
    user = db.query(models.User).filter(models.User.phone == login_data.phone).first()
    if not user or not auth.verify_password(login_data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="شماره یا رمز عبور اشتباه است")
    token = auth.create_access_token(data={"sub": user.phone})
    
    return {
        "access_token": token, 
        "token_type": "bearer",
        "is_admin": getattr(user, "is_admin", False)
    }

@app.get("/contests", response_model=List[schemas.Contest])
def get_all_contests(status: Optional[int] = None, db: Session = Depends(database.get_db)):
    contests = db.query(models.Contest).all()
    now = datetime.now()
    
    modified = False
    for contest in contests:
        # ۱. فقط در صورتی خودکار پایان‌یافته شود که وضعیتش 'active' (در حال اجرا) باشد و واقعاً وقتش تمام شده باشد
        if contest.status == 'active' and contest.end_time and contest.end_time < now:
            contest.status = 'finished'
            modified = True
            
        # ۲. فقط در صورتی خودکار فعال شود که وضعیتش 'upcoming' باشد و زمان شروعش رسیده یا گذشته باشد
        elif contest.status == 'upcoming' and contest.start_time and contest.start_time <= now:
            # یک شرط محافظتی: مطمئن شویم زمان پایانش نگذشته باشد
            if not contest.end_time or contest.end_time > now:
                contest.status = 'active'
                modified = True
            else:
                contest.status = 'finished'
                modified = True
            
    if modified:
        db.commit()

    if status:
        return db.query(models.Contest).filter(models.Contest.status == status).all()
        
    return db.query(models.Contest).all()

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
                "contest_id": contest_id,
                "contest_title": sub.contest.title,
                "score": sub.score,
                "time_taken": sub.time_taken,
                "date": sub.id,
                "status": sub.contest.status
            }
            
    history = list(unique_history.values())
    total_score = sum(item['score'] for item in history)
        
    # خروجی کامل شامل مشخصات مفقود شده کاربر برای فرانت‌ند
    return {
        "id": current_user.id,
        "first_name": current_user.first_name,
        "last_name": current_user.last_name,
        "phone": current_user.phone,
        "national_id": current_user.national_id,
        "province": current_user.province,
        "city": current_user.city,
        "gender": current_user.gender,
        "birth_date": current_user.birth_date, 
        "total_score": total_score,
        "contests_count": len(history),
        "history": history
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
        
        # 👈 تغییر اصلی: اگر کاربر اصلاً هیچ آزمونی نداده باشد، کلاً از چرخه خارج شود
        if not submissions:
            continue
            
        unique_scores = {}
        for sub in submissions:
            # اگر مسابقه جدید بود یا نمره این دفعه از نمره قبلی بیشتر بود
            if sub.contest_id not in unique_scores or sub.score > unique_scores[sub.contest_id]['score']:
                unique_scores[sub.contest_id] = {'score': sub.score, 'time': sub.time_taken}
        
        total_score = sum(item['score'] for item in unique_scores.values())
        total_time = sum(item['time'] for item in unique_scores.values())
        
        # 👈 حالا حتی اگر نمره کل کاربر 0 باشد ولی آزمون ثبت کرده باشد، در لیدربورد لود می‌شود
        national_id = user.national_id or "****"
        last_four = national_id[-4:] if len(national_id) >= 4 else national_id
        
        results.append({
            "id": user.id,
            "name": f"{user.first_name} {user.last_name or ''}".strip(),
            "total_score": total_score,
            "total_time": total_time,
            "last_four_id": last_four
        })
    
    # مرتب‌سازی بر اساس بیشترین نمره و سپس کمترین زمان
    results.sort(key=lambda x: (x["total_score"], -x["total_time"]), reverse=True)
    
    # اختصاص رتبه دقیق به کاربران
    for index, item in enumerate(results):
        item["rank"] = index + 1
        
    return results[:10]  # برش آرایه برای نمایش حداکثر ۱۰ نفر برتر

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
async def get_admin_stats(db: Session = Depends(database.get_db), current_admin: models.User = Depends(require_admin)):
    # ۱. تعداد کل کاربرها
    total_users = db.query(models.User).count()
    
    # ۲. تعداد کل مسابقات
    total_contests = db.query(models.Contest).count()
    
    # ۳. تعداد مسابقات فعال
    active_contests = db.query(models.Contest).filter(models.Contest.status == "active").count()
    
    # ۴. پیدا کردن استانی که بیشترین ثبت‌نامی را داشته است (با مدیریت خطا در صورت خالی بودن)
    top_province_query = db.query(
        models.User.province, 
        func.count(models.User.id).label('user_count')
    ).filter(models.User.province != None, models.User.province != "")\
     .group_by(models.User.province)\
     .order_by(func.count(models.User.id).desc())\
     .first()
     
    top_province = top_province_query[0] if top_province_query and len(top_province_query) > 0 else "بدون داده"

    # زمان‌بندی برای تفکیک دو هفته اخیر
    now_time = datetime.now()
    seven_days_ago = now_time - timedelta(days=7)
    fourteen_days_ago = now_time - timedelta(days=14)

    # تعداد ثبت‌نامی‌های این هفته و هفته گذشته
    this_week_users = db.query(models.User).filter(models.User.created_at >= seven_days_ago).count()
    last_week_users = db.query(models.User).filter(models.User.created_at >= fourteen_days_ago, models.User.created_at < seven_days_ago).count()

    # محاسبه درصد رشد (مدیریت تقسیم بر صفر)
    if last_week_users == 0:
        growth_percentage = 100 if this_week_users > 0 else 0
    else:
        growth_percentage = round(((this_week_users - last_week_users) / last_week_users) * 100, 1)

    # ۵. دیتای نمودار برای ۷ روز اخیر
    seven_days_ago_chart = datetime.now() - timedelta(days=7)
    try:
        chart_query = db.query(
            func.date(models.User.created_at).label('date'),
            func.count(models.User.id).label('count')
        ).filter(models.User.created_at >= seven_days_ago_chart)\
         .group_by(func.date(models.User.created_at))\
         .order_by(func.date(models.User.created_at)).all()
         
        chart_data = [{"name": str(row.date), "users": row.count} for row in chart_query]
    except Exception:
        chart_data = []
    
    # خروجی نهایی بدون کرش کردن
    return {
        "total_users": total_users,
        "total_contests": total_contests,
        "active_contests": active_contests,
        "top_province": top_province,
        "growth_percentage": growth_percentage,
        "chart_data": chart_data
    }

@app.get("/admin/export-data")
def get_export_data(db: Session = Depends(database.get_db), current_admin: models.User = Depends(require_admin)):
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

@app.post("/proxy-upload")
async def proxy_get_profile_photo(request_data: dict):
    # ۱. تعریف آدرس گیت‌وی ایتا
    EITAA_API_URL = "http://10.10.10.4:3000/send" 
    
    try:
        # ۲. خواندن توکن و imei از ردیس (از کلاینتی که در فایل کانفیگ می‌سازیم)
        token = r.get("eitaa_token")
        imei = r.get("eitaa_imei")

        if not token or not imei:
            raise HTTPException(status_code=500, detail="تنظیمات توکن یا IMEI در ردیس یافت نشد.")
        
        # ۳. تزریق توکن و IMEI به درخواستی که از فرانت‌ند آمده
        request_data["token"] = token
        request_data["imei"] = imei

        # ۴. ارسال درخواست نهایی به سرور ایتا
        async with httpx.AsyncClient() as client:
            response = await client.post(
                EITAA_API_URL,
                json=request_data,
                timeout=30.0
            )
            return response.json()
            
    except Exception as e:
        return {"status": "error", "message": str(e)}
    # خواندن توکن و imei از ردیس
    token = r.hget(ACCOUNT_KEY,"token")
    imei = r.hget(ACCOUNT_KEY,"imei")
    print(f"Read from Redis - Token: {token}, IMEI: {imei}")

    if not token or not imei:
            raise HTTPException(status_code=500, detail=f"تنظیمات توکن یا IMEI در ردیس یافت نشد.")
    
# ۳. ارسال درخواست نهایی به سرور ایتا
    async with httpx.AsyncClient() as client:
        response = await client.post(
            EITAA_API_URL,
            json=request_data,
            timeout=30.0
        )
        return response.json()

    # تزریق به درخواستی که از فرانت‌ند آمده
    request_data["token"] = token
    request_data["imei"] = imei

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
        
@app.get("/admin/users-list")
def get_admin_users_list(db: Session = Depends(database.get_db), current_admin: models.User = Depends(require_admin)):
    users = db.query(models.User).all()
    results = []
    
    for u in users:
        # ۱. محاسبه میانگین نمرات کاربر از جدول Submissions
        avg_score_query = db.query(func.avg(models.Submission.score))\
                            .filter(models.Submission.user_id == u.id)\
                            .scalar()
        
        # اگر کاربر هیچ آزمونی نداده باشد، مقدار میانگین را "---" می‌گذاریم، در غیر این صورت گرد می‌کنیم
        if avg_score_query is not None:
            average_score = f"{round(float(avg_score_query), 1)}%"
        else:
            average_score = "---"
        
        # ۲. پیدا کردن وضعیت آخرین مسابقه کاربر (برای ستون آخرین رقابت)
        last_sub = db.query(models.Submission).filter(
            models.Submission.user_id == u.id
        ).order_by(models.Submission.id.desc()).first()
        
        results.append({
            "id": u.id,
            "name": f"{u.first_name or ''} {u.last_name or ''}".strip() or "بدون نام",
            "phone": u.phone,
            "national_id": u.national_id or "---",
            "province": u.province or "---",
            "gender": u.gender or "---",
            "last_contest": last_sub.contest.title if last_sub else "شرکت نکرده",
            "average_score": average_score  # 👈 ارسال فیلد جدید به جای last_score
        })
        
    return results

@app.get("/admin/provinces-report")
async def get_admin_provinces_report(db: Session = Depends(database.get_db), current_admin: models.User = Depends(require_admin)):
    # تعداد کل کاربران برای محاسبه درصد مشارکت هر استان
    total_users = db.query(models.User).count() or 1

    # گرفتن آمار استان‌ها به ترتیب بیشترین کاربر
    report_query = db.query(
        models.User.province,
        func.count(models.User.id).label('user_count')
    ).filter(models.User.province != None, models.User.province != "")\
     .group_by(models.User.province)\
     .order_by(func.count(models.User.id).desc()).all()

    report_data = []
    for row in report_query:
        percentage = (row.user_count / total_users) * 100
        report_data.append({
            "province": row.province,
            "count": row.user_count,
            "percentage": round(percentage, 1)
        })

    return report_data

@app.put("/admin/questions/{question_id}")
def update_contest_question(
    question_id: int, 
    question_update: QuestionUpdate, 
    db: Session = Depends(database.get_db), 
    current_admin: models.User = Depends(require_admin)
):
    # ۱. پیدا کردن سوال در دیتابیس
    db_question = db.query(models.Question).filter(models.Question.id == question_id).first()
    if not db_question:
        raise HTTPException(status_code=404, detail="سوال یافت نشد")

    # ۲. پیدا کردن مسابقه متصل به این سوال برای بررسی وضعیت آن
    contest = db.query(models.Contest).filter(models.Contest.id == db_question.contest_id).first()
    if not contest:
        raise HTTPException(status_code=404, detail="مسابقه متصل به این سوال یافت نشد")

    # ۳. لایه محافظتی: فقط مسابقات «به زودی» قابل ویرایش هستند
    if contest.status != "upcoming":
        raise HTTPException(
            status_code=400, 
            detail="این مسابقه شروع شده یا پایان یافته است؛ تنها سوالات مسابقاتی که در حالت «به زودی» هستند قابل ویرایش می‌باشند."
        )

    # ۴. به‌روزرسانی فیلدهای سوال
    db_question.text = question_update.text
    db_question.description = question_update.description
    db_question.option_1 = question_update.option_1
    db_question.option_2 = question_update.option_2
    db_question.option_3 = question_update.option_3
    db_question.option_4 = question_update.option_4
    db_question.correct_option = question_update.correct_option

    db.commit()
    db.refresh(db_question)
    
    return {"status": "success", "message": "سوال با موفقیت ویرایش شد"}