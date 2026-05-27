# backend/app/main.py
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi import FastAPI, APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional, Dict, Any
from . import crud, schemas, models, auth, database
import shutil, os, random, httpx, base64, redis, json, io, requests, textwrap
from pydantic import BaseModel
from datetime import datetime, timedelta
from PIL import Image, ImageDraw, ImageFont
from fastapi.responses import JSONResponse, StreamingResponse
from datetime import datetime, timedelta
from jose import JWTError, jwt
from .auth import require_admin

app = FastAPI()
ACCOUNT_REDIS_HOST = os.getenv("REDIS_HOST", "10.10.10.6")
ACCOUNT_REDIS_PORT = int(os.getenv("REDIS_PORT", 6379))
ACCOUNT_REDIS_DB = int(os.getenv("REDIS_DB", 0))
ACCOUNT_KEY = os.getenv("ACCOUNT_KEY", "latest_session:989371787445")
r = redis.Redis(host=ACCOUNT_REDIS_HOST, port=ACCOUNT_REDIS_PORT, db=ACCOUNT_REDIS_DB, decode_responses=True)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"], # برای تست راحت‌تر روی همه باز گذاشتم، بعداً محدود کن
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# کانفیگ‌های فرضی JWT
SECRET_KEY = "YOUR_SUPER_SECRET_KEY"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 15
REFRESH_TOKEN_EXPIRE_DAYS = 7

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

class BannerCreate(BaseModel):
    title: str
    link_url: Optional[str] = None
    image_url: str
    status: Optional[str] = "active"

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

def create_jwt_token(data: dict, expires_delta: timedelta):
    to_encode = data.copy()
    expire = datetime.utcnow() + expires_delta
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def safe_load_image(url_str):
    if not url_str:
        return None
    try:
        # 👈 اگر آدرس با / شروع شده بود، آدرس کامل سرور لوکال را به آن می‌چسبانیم
        if url_str.startswith("/"):
            url_str = f"http://127.0.0.1:8000{url_str}"
            
        response = requests.get(url_str, timeout=5)
        return Image.open(io.BytesIO(response.content)).convert("RGBA")
    except Exception as e:
        print(f"⚠️ خطا در بارگذاری تصویر ({url_str}): {e}")
        return None

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

def to_persian_digits(number_str):
    persian_labels = {
        '0': '۰', '1': '۱', '2': '۲', '3': '۳', '4': '۴',
        '5': '۵', '6': '۶', '7': '۷', '8': '۸', '9': '۹'
    }
    return "".join(persian_labels.get(char, char) for char in str(number_str))

def wrap_persian_text(text, max_chars=50):
    words = text.split()
    lines = []
    current_line = []
    current_length = 0
    for word in words:
        if current_length + len(word) <= max_chars:
            current_line.append(word)
            current_length += len(word) + 1
        else:
            lines.append(" ".join(current_line))
            current_line = [word]
            current_length = len(word)
    if current_line:
        lines.append(" ".join(current_line))
    return lines

def draw_centered_rtl_text(draw, center_x, y, text, font, fill):
    try:
        # محاسبه دقیق ابعاد متن رندر شده
        bbox = draw.textbbox((0, 0), text, font=font, direction="rtl")
        text_width = bbox[2] - bbox[0]
    except:
        text_width = len(text) * 13 # بک‌آپ محاسباتی در صورت لود نشدن کادر
        
    # تنظیم نقطه شروع بر اساس مرکز افقی هدف
    actual_x = center_x - (text_width // 2)
    safe_draw_text(draw, (actual_x, y), text, font, fill, direction="rtl")

def safe_draw_text(draw, position, text, font, fill, direction=None):
    try:
        if direction:
            draw.text(position, text, font=font, fill=fill, direction=direction)
        else:
            draw.text(position, text, font=font, fill=fill)
    except Exception as e:
        # اگر به خاطر فونت پیش‌فرض یا نبود libraqm خطای جهت‌نویسی داد، بدون جهت رسمش کن
        try:
            draw.text(position, text, font=font, fill=fill)
        except:
            pass

def draw_certificate_canvas(user, contest, submission):
    # ۱. بارگذاری هوشمند تصویر پس‌زمینه
    bg_url = getattr(contest, 'certificate_bg_url', None)
    img = safe_load_image(bg_url)
    if img:
        img = img.resize((1200, 800), Image.Resampling.LANCZOS)
    else:
        img = Image.new("RGBA", (1200, 800), color=(26, 46, 68))
        
    draw = ImageDraw.Draw(img)
    
    # بارگذاری آنلاین بایت‌های فونت وزیر
    try:
        url_bold = "https://raw.githubusercontent.com/rastikerdar/vazirmatn/v33.003/fonts/ttf/Vazirmatn-Bold.ttf"
        url_medium = "https://raw.githubusercontent.com/rastikerdar/vazirmatn/v33.003/fonts/ttf/Vazirmatn-Medium.ttf"
        res_bold = requests.get(url_bold, timeout=5)
        res_medium = requests.get(url_medium, timeout=5)
        font_bytes_bold = io.BytesIO(res_bold.content)
        font_sub = ImageFont.truetype(io.BytesIO(res_medium.content), 20)
    except Exception as e:
        print(f"⚠️ خطای بارگذاری فونت لوح: {e}")
        font_bytes_bold = None
        font_sub = ImageFont.load_default()

    # پردازش متغیرهای داینامیک متن لوح
    try: score_val = float(str(submission.score).replace("%", ""))
    except: score_val = 0

    rank_text = "عالی" if score_val >= 85 else "خیلی خوب" if score_val >= 70 else "خوب"
    user_full_name = f"{user.first_name or ''} {user.last_name or ''}".strip() or "شرکت‌کننده امتداد"
    template = getattr(contest, 'certificate_text_template', None) or "بدین‌وسیله گواهی می‌شود {{name}} در مسابقه شرکت نموده است."
    
    full_text = template.replace("{{name}}", user_full_name)\
                        .replace("{{national_id}}", user.national_id or "---")\
                        .replace("{{birth_date}}", user.birth_date or "---")\
                        .replace("{{rank}}", rank_text)

    # ۲. تراز دقیق راست‌چین شماره سریال و تاریخ کاملاً فارسی
    contest_id = getattr(contest, 'id', 1)
    user_id = getattr(user, 'id', 1)
    persian_serial = to_persian_digits(f"1405{contest_id:02d}{user_id:02d}")
    persian_date = to_persian_digits(datetime.now().strftime("%Y/%m/%d"))
    
    txt_serial = f"شماره: {persian_serial}"
    txt_date = f"تاریخ: {persian_date}"
    
    try:
        w_s = draw.textbbox((0, 0), txt_serial, font=font_sub, direction="rtl")[2] - draw.textbbox((0, 0), txt_serial, font=font_sub, direction="rtl")[0]
        w_d = draw.textbbox((0, 0), txt_date, font=font_sub, direction="rtl")[2] - draw.textbbox((0, 0), txt_date, font=font_sub, direction="rtl")[0]
    except:
        w_s, w_d = 160, 160
        
    safe_draw_text(draw, (1120 - w_s, 70), txt_serial, font_sub, "#FFFFFF", direction="rtl")
    safe_draw_text(draw, (1120 - w_d, 105), txt_date, font_sub, "#FFFFFF", direction="rtl")

    # ۳. موتور تنظیم سایز خودکار و رندر کاملاً متقارن متن اصلی لوح
    target_font_size = 32
    lines = []
    while target_font_size > 18:
        if font_bytes_bold:
            font_bytes_bold.seek(0)
            font_main = ImageFont.truetype(font_bytes_bold, target_font_size)
        else:
            font_main = ImageFont.load_default()
            
        max_chars = int(900 // (target_font_size * 0.55))
        lines = wrap_persian_text(full_text, max_chars=max_chars)
        total_height = len(lines) * (target_font_size + 16)
        if total_height <= 200:
            break
        target_font_size -= 2

    y_offset = 380 - ((len(lines) * (target_font_size + 16)) // 2)
    for line in lines:
        draw_centered_rtl_text(draw, 600, y_offset, line, font_main, "#FFFFFF")
        y_offset += target_font_size + 16

    # ۴. بارگذاری و پِیست کردن لوگوی بالا وسط
    logo_url = getattr(contest, 'certificate_logo_url', None)
    if logo_url:
        logo_img = safe_load_image(logo_url)
        if logo_img:
            logo_img = logo_img.resize((150, 150))
            img.paste(logo_img, (525, 40), logo_img)

    # ۵. موتور چیدمان داینامیک و متقارن امضاکنندگان و تصاویر امضا
    if font_bytes_bold:
        font_bytes_bold.seek(0)
        font_sign = ImageFont.truetype(font_bytes_bold, 24)
    else:
        font_sign = ImageFont.load_default()

    active_signers = []
    if getattr(contest, 'signer_name', None):
        active_signers.append(('signer_name', 'signer_title', 'signer_signature_url'))
    if getattr(contest, 'signer_2_name', None):
        active_signers.append(('signer_2_name', 'signer_2_title', 'signer_2_signature_url'))
    if getattr(contest, 'signer_3_name', None):
        active_signers.append(('signer_3_name', 'signer_3_title', 'signer_3_signature_url'))

    num_signers = len(active_signers)
    if num_signers == 1:
        anchors = [600]
    elif num_signers == 2:
        anchors = [380, 820]
    elif num_signers == 3:
        anchors = [250, 600, 950]
    else:
        anchors = []

    for idx, (name_key, title_key, sig_img_key) in enumerate(active_signers):
        center_anchor = anchors[idx]
        
        # بارگذاری و درج تصویر امضای شیشه‌ای (PNG)
        sig_file_url = getattr(contest, sig_img_key, None)
        if sig_file_url:
            sig_img = safe_load_image(sig_file_url)
            if sig_img:
                sig_img = sig_img.resize((140, 70), Image.Resampling.LANCZOS)
                img.paste(sig_img, (center_anchor - 70, 530), sig_img)

        # چاپ متقارن نام و سِمَت مدیران
        s_name = getattr(contest, name_key, None)
        draw_centered_rtl_text(draw, center_anchor, 620, s_name, font_sign, "#F3E5AB")
        
        s_title = getattr(contest, title_key, None)
        if s_title:
            draw_centered_rtl_text(draw, center_anchor, 660, s_title, font_sub, "#A7975B")

    img_byte_arr = io.BytesIO()
    img.save(img_byte_arr, format='PNG')
    img_byte_arr.seek(0)
    return img_byte_arr

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
def get_all_contests(status: Optional[str] = None, db: Session = Depends(database.get_db)): # 👈 تغییر int به str برای رفع ارور فیلتر وضعیت
    contests = db.query(models.Contest).all()
    now = datetime.now()
    
    modified = False
    for contest in contests:
        # ۱. فقط در صورتی خودکار پایان‌یافته شود که وضعیتش 'active' باشد و واقعاً وقتش تمام شده باشد
        if contest.status == 'active' and contest.end_time and contest.end_time < now:
            contest.status = 'finished'
            modified = True
            
        # ۲. فقط در صورتی خودکار فعال شود که وضعیتش 'upcoming' باشد و زمان شروعش رسیده یا گذشته باشد
        elif contest.status == 'upcoming' and contest.start_time and contest.start_time <= now:
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

@app.options("/users/me/contests/{contest_id}/certificate/download")
def options_download_certificate():
    from fastapi.responses import Response
    return Response(headers={
        "Access-Control-Allow-Origin": "http://localhost:3000",
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
    })

@app.get("/users/me/contests/{contest_id}/certificate/download")
def download_my_certificate(
    contest_id: int, 
    db: Session = Depends(database.get_db), 
    current_user: models.User = Depends(auth.get_current_user)
):
    cors_headers = {
        "Access-Control-Allow-Origin": "http://localhost:3000",
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
    }

    try:
        submission = db.query(models.Submission).filter(
            models.Submission.user_id == current_user.id,
            models.Submission.contest_id == contest_id
        ).first()
        
        if not submission:
            return JSONResponse(status_code=403, content={"detail": "شما هنوز در این مسابقه شرکت نکرده‌اید."}, headers=cors_headers)
            
        contest = db.query(models.Contest).filter(models.Contest.id == contest_id).first()
        if not contest:
            return JSONResponse(status_code=404, content={"detail": "مسابقه مورد نظر یافت نشد."}, headers=cors_headers)
            
        if contest.certificate_type == 'none':
            return JSONResponse(status_code=400, content={"detail": "این مسابقه فاقد امتیاز صدور گواهی نامه است."}, headers=cors_headers)

        try:
            user_score = float(str(submission.score).replace("%", ""))
        except:
            user_score = 0
            
        if user_score < 50:
            return JSONResponse(status_code=400, content={"detail": "امتیاز شما برای دریافت گواهی کافی نیست."}, headers=cors_headers)

        # اجرای ایمن موتور بوم گرافیکی
        try:
            canvas = draw_certificate_canvas(current_user, contest, submission)
        except Exception as canvas_err:
            print(f"❌ خطای داخلی در موتور گرافیکی: {canvas_err}")
            return JSONResponse(status_code=500, content={"detail": f"خطای ترسیم تصویر: {str(canvas_err)}"}, headers=cors_headers)

        response_headers = {
            **cors_headers, 
            "Content-Disposition": f"attachment; filename=certificate_{contest_id}.png"
        }
        return StreamingResponse(canvas, media_type="image/png", headers=response_headers)

    except Exception as global_err:
        print(f"❌ خطای سراسری اندپوینت: {global_err}")
        return JSONResponse(status_code=500, content={"detail": f"خطای سرور: {str(global_err)}"}, headers=cors_headers)
        
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
def get_export_data(
    contest_id: Optional[int] = None, # 👈 اضافه شدن پارامتر اختیاری فیلتر مسابقه
    db: Session = Depends(database.get_db), 
    current_admin: models.User = Depends(require_admin)
):
    # ۱. حالت اول: اگر مسابقه خاصی فیلتر شده باشد، فقط سابمیشن‌های همان مسابقه را خروجی می‌گیریم
    if contest_id:
        submissions = db.query(models.Submission).filter(models.Submission.contest_id == contest_id).all()
        report = []
        for sub in submissions:
            u = sub.user
            if not u:
                continue
            report.append({
                "نام": u.first_name or "---",
                "نام خانوادگی": u.last_name or "---",
                "شماره تماس": u.phone,
                "کد ملی": u.national_id or "---",
                "استان": u.province or "---",
                "جنسیت": u.gender or "---",
                "نام مسابقه": sub.contest.title if sub.contest else "---",
                "نمره": f"{sub.score}%",
                "زمان (ثانیه)": sub.time_taken,
                "تاریخ ثبت‌نام": u.created_at.strftime("%Y/%m/%d") if u.created_at else "---"
            })
        return report

    # ۲. حالت دوم: اگر مسابقه‌ای انتخاب نشده باشد، تمام کاربران سیستم (به همراه وضعیت مسابقه‌شان) خروجی گرفته می‌شوند
    users = db.query(models.User).all()
    report = []
    for u in users:
        submission = db.query(models.Submission).filter(models.Submission.user_id == u.id).first()
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
            "نمره": f"{submission.score}%" if submission else "0%",
            "زمان (ثانیه)": submission.time_taken if submission else 0,
            "تاریخ ثبت‌نام": u.created_at.strftime("%Y/%m/%d") if u.created_at else "---"
        })
    return report

@app.post("/proxy-upload")
async def proxy_get_profile_photo(request_data: dict):
    EITAA_API_URL = "http://10.10.10.4:3000/send" 
    
    try:
        # ۱. خواندن کل رشته متنی از ردیس (چون دیتات STRING است نه HASH)
        session_json_str = r.get(ACCOUNT_KEY)

        if not session_json_str:
            return {
                "status": "error", 
                "message": f"500: کلید سشن {ACCOUNT_KEY} در ردیس یافت نشد یا منقضی شده است."
            }
        
        # ۲. تبدیل متن JSON به دیکشنری پایتون
        session_data = json.loads(session_json_str)
        
        # ۳. استخراج مقادیر توکن و imei از داخل آبجکت
        token = session_data.get("token")
        imei = session_data.get("imei")

        # چاپ در ترمینال برای اطمینان از صحت استخراج داده‌ها
        print(f"Successfully Parsed - Token: {token}, IMEI: {imei}")

        if not token or not imei:
            return {
                "status": "error", 
                "message": "500: مقادیر token یا imei در دیتای داخل ردیس مفقود هستند."
            }
        
        # ۴. تزریق توکن و IMEI به بدنه درخواست فرانت‌ند
        request_data["token"] = token
        request_data["imei"] = imei

        # ۵. ارسال درخواست نهایی به سرور ایتا
        async with httpx.AsyncClient() as client:
            response = await client.post(
                EITAA_API_URL,
                json=request_data,
                timeout=30.0
            )
            return response.json()
            
    except json.JSONDecodeError:
        return {"status": "error", "message": "500: ساختار متنی موجود در ردیس فرمت JSON معتبری ندارد."}
    except Exception as e:
        return {"status": "error", "message": f"500: خطا در برقراری ارتباط: {str(e)}"}
        
@app.get("/admin/users-list")
def get_admin_users_list(db: Session = Depends(database.get_db), current_admin: models.User = Depends(require_admin)):
    users = db.query(models.User).all()
    results = []
    
    for u in users:
        # ۱. محاسبه میانگین نمرات
        avg_score_query = db.query(func.avg(models.Submission.score))\
                            .filter(models.Submission.user_id == u.id)\
                            .scalar()
        
        if avg_score_query is not None:
            average_score = f"{round(float(avg_score_query), 1)}%"
        else:
            average_score = "---"
        
        # ۲. پیدا کردن تمام مسابقاتی که کاربر تا به حال در آن‌ها شرکت کرده است
        all_subs = db.query(models.Submission).filter(models.Submission.user_id == u.id).all()
        participated_contests = [sub.contest.title for sub in all_subs if sub.contest]
        
        # ۳. پیدا کردن وضعیت آخرین مسابقه کاربر
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
            "all_contests": participated_contests,
            "average_score": average_score,
            "is_admin": u.is_admin
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

@app.get("/admin/users/{user_id}/detail")
def get_admin_user_detail(user_id: int, db: Session = Depends(database.get_db), current_admin: models.User = Depends(require_admin)):
    # ۱. پیدا کردن کاربر در دیتابیس
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="کاربر یافت نشد")
        
    # ۲. استخراج تمام نتایج و سابمیشن‌های این کاربر خاص
    all_submissions = db.query(models.Submission).filter(models.Submission.user_id == user.id).all()
    
    history = []
    for sub in all_submissions:
        history.append({
            "contest_id": sub.contest_id,
            "contest_title": sub.contest.title if sub.contest else "مسابقه حذف شده",
            "score": sub.score,
            "time_taken": sub.time_taken,
            "status": sub.contest.status if sub.contest else "unknown"
        })
        
    # ۳. بازگرداندن پکیج کامل اطلاعات کاربر برای ادمین
    return {
        "id": user.id,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "phone": user.phone,
        "national_id": user.national_id,
        "province": user.province,
        "city": user.city,
        "gender": user.gender,
        "birth_date": user.birth_date,
        "history": history
    }

@app.put("/admin/users/{user_id}/update")
def update_admin_user_profile(
    user_id: int, 
    payload: dict, 
    db: Session = Depends(database.get_db), 
    current_admin: models.User = Depends(require_admin)
):
    # ۱. پیدا کردن کاربر
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="کاربر یافت نشد")
        
    # ۲. اعمال تغییرات ارسالی از سمت ادمین
    user.first_name = payload.get("first_name", user.first_name)
    user.last_name = payload.get("last_name", user.last_name)
    user.phone = payload.get("phone", user.phone)
    user.national_id = payload.get("national_id", user.national_id)
    user.province = payload.get("province", user.province)
    user.city = payload.get("city", user.city)
    user.gender = payload.get("gender", user.gender)
    user.birth_date = payload.get("birth_date", user.birth_date)
    
    # ۳. ذخیره‌سازی نهایی در دیتابیس
    db.commit()
    return {"status": "success", "message": "اطلاعات کاربر با موفقیت ویرایش شد"}

@app.put("/admin/contests/{contest_id}/certificate-template")
def update_certificate_template(contest_id: int, data: dict, db: Session = Depends(database.get_db)):
    contest = db.query(models.Contest).filter(models.Contest.id == contest_id).first()
    if not contest:
        raise HTTPException(status_code=404, detail="مسابقه مورد نظر یافت نشد")
    
    # 👈 ذخیره سازی فیلدهای متنی و بک‌گراند
    contest.certificate_text_template = data.get("certificate_text_template")
    contest.certificate_bg_url = data.get("certificate_bg_url")
    contest.certificate_logo_url = data.get("certificate_logo_url")
    
    # 👈 ذخیره سازی اطلاعات امضای اول
    contest.signer_name = data.get("signer_name")
    contest.signer_title = data.get("signer_title")
    contest.signer_signature_url = data.get("signer_signature_url")
    
    # 👈 ذخیره سازی اطلاعات امضای دوم
    contest.signer_2_name = data.get("signer_2_name")
    contest.signer_2_title = data.get("signer_2_title")
    contest.signer_2_signature_url = data.get("signer_2_signature_url")
    
    # 👈 ذخیره سازی اطلاعات امضای سوم
    contest.signer_3_name = data.get("signer_3_name")
    contest.signer_3_title = data.get("signer_3_title")
    contest.signer_3_signature_url = data.get("signer_3_signature_url")
    
    db.commit()
    return {"status": "success", "message": "تنظیمات گواهی با موفقیت ذخیره شد"}
    
@app.get("/admin/users/{user_id}/contests/{contest_id}/certificate/download")
def generate_user_certificate_image(
    user_id: int,
    contest_id: int,
    db: Session = Depends(database.get_db),
    current_admin: models.User = Depends(require_admin)
):
    # ۱. واکشی اطلاعات کاربر، مسابقه و سابمیشن نمره
    user = db.query(models.User).filter(models.User.id == user_id).first()
    contest = db.query(models.Contest).filter(models.Contest.id == contest_id).first()
    submission = db.query(models.Submission).filter(
        models.Submission.user_id == user_id, 
        models.Submission.contest_id == contest_id
    ).first()
    
    if not user or not contest or not submission:
        raise HTTPException(status_code=404, detail="اطلاعات کاربر یا کارنامه یافت نشد")

    # ۲. لود کردن عکس پس‌زمینه گواهی (اگر نبود یک بک‌گراند سفید پیش‌فرض می‌سازد)
    bg_url = contest.certificate_bg_url
    try:
        response = requests.get(bg_url)
        img = Image.open(io.BytesIO(response.content)).convert("RGBA")
    except:
        img = Image.new("RGBA", (1200, 800), color=(250, 249, 246)) # ابعاد استاندارد گواهی دسکتاپ
        
    draw = ImageDraw.Draw(img)
    
    # ۳. لود فونت فارسی (باید فایل فونت مثلاً Vazir.ttf در پوشه پروژه شما باشد)
    try:
        font_main = ImageFont.truetype("assets/fonts/Vazir-Bold.ttf", 26)
        font_sub = ImageFont.truetype("assets/fonts/Vazir-Medium.ttf", 20)
    except:
        font_main = ImageFont.load_default()
        font_sub = ImageFont.load_default()

    # ۴. تعیین رتبه بر اساس نمره کاربر (عالی، خیلی خوب، خوب)
    rank_text = "خوب"
    if submission.score >= 85:
        rank_text = "عالی"
    elif submission.score >= 70:
        rank_text = "خیلی خوب"

    # ۵. جایگذاری متغیرهای داینامیک در متن قالب ادمین
    user_full_name = f"{user.first_name} {user.last_name or ''}".strip()
    template = contest.certificate_text_template or "بدین‌وسیله گواهی می‌شود {{name}} در مسابقه شرکت نموده است."
    
    full_text = template.replace("{{name}}", user_full_name)\
                        .replace("{{national_id}}", user.national_id)\
                        .replace("{{birth_date}}", user.birth_date or "---")\
                        .replace("{{rank}}", rank_text)

    # ۶. نوشتن متن‌ها روی بوم تصویر (مختصات x و y بر اساس ابعاد ۱۲۰۰ در ۸۰۰ فرضی)
    # شماره سریال و تاریخ در گوشه بالا
    serial_number = f"EMT-{contest_id}-{user_id}"
    today_date = datetime.now().strftime("%Y/%m/%d")
    draw.text((100, 80), f"شماره: {serial_number}", font=font_sub, fill="#1a2e44")
    draw.text((100, 110), f"تاریخ: {today_date}", font=font_sub, fill="#1a2e44")

    # متن اصلی گواهی (راست‌چین یا وسط‌چین فرضی)
    # Pillow در نسخه‌های جدید از direction="rtl" برای فونت‌های عربی/فارسی پشتیبانی می‌کند
    draw.text((1000, 350), full_text, font=font_main, fill="#1a2e44", direction="rtl")

    # مشخصات امضاکننده در پایین سمت چپ
    if contest.signer_name:
        draw.text((250, 600), contest.signer_name, font=font_main, fill="#1a2e44", direction="rtl")
    if contest.signer_title:
        draw.text((250, 640), contest.signer_title, font=font_sub, fill="#c5a059", direction="rtl")

    # ۷. خروجی گرفتن مستقیم به صورت Stream بدون ذخیره فایل روی هارد سرور (فوق‌العاده بهینه)
    img_byte_arr = io.BytesIO()
    img.save(img_byte_arr, format='PNG')
    img_byte_arr.seek(0)
    
    return StreamingResponse(img_byte_arr, media_type="image/png")

@app.post("/admin/banners")
def create_banner(banner_data: BannerCreate, db: Session = Depends(database.get_db)):
    db_banner = models.Banner(
        title=banner_data.title,
        link_url=banner_data.link_url,
        image_url=banner_data.image_url,
        status=banner_data.status
    )
    db.add(db_banner)
    db.commit()
    db.refresh(db_banner)
    return {"message": "بنر با موفقیت ذخیره شد", "banner_id": db_banner.id}

# ۳. اندپوینت دریافت بنرهای فعال برای دشبورد کاربر (GET)
@app.get("/banners")
def get_active_banners(db: Session = Depends(database.get_db)):
    # فقط بنرهایی که وضعیت آن‌ها active است را به فرانت‌ند می‌فرستد
    banners = db.query(models.Banner).filter(models.Banner.status == "active").all()
    return banners

@app.patch("/admin/contests/{contest_id}")
def update_contest(contest_id: int, contest_data: dict, db: Session = Depends(database.get_db)):
    db_contest = db.query(models.Contest).filter(models.Contest.id == contest_id).first()
    if not db_contest:
        raise HTTPException(status_code=404, detail="مسابقه یافت نشد")
    
    for key, value in contest_data.items():
        if hasattr(db_contest, key):
            setattr(db_contest, key, value)
            
    db.commit()
    db.refresh(db_contest)
    return {"message": "مسابقه با موفقیت به‌روزرسانی شد"}

@app.get("/admin/contests/{contest_id}/analytics")
def get_contest_analytics(
    contest_id: int, 
    db: Session = Depends(database.get_db), 
    current_admin: models.User = Depends(require_admin)
):
    # ۱. بررسی وجود مسابقه در دیتابیس
    contest = db.query(models.Contest).filter(models.Contest.id == contest_id).first()
    if not contest:
        raise HTTPException(status_code=404, detail="مسابقه یافت نشد")

    # ۲. دریافت تمام پاسخنامه‌های ثبت شده برای این مسابقه
    submissions = db.query(models.Submission).filter(models.Submission.contest_id == contest_id).all()

    # ۳. محاسبه توزیع فراوانی مدت زمان حضور در آزمون
    time_dist = {
        "زیر ۳ دقیقه": 0,
        "۳ تا ۶ دقیقه": 0,
        "۶ تا ۱۰ دقیقه": 0,
        "۱۰ تا ۱۵ دقیقه": 0,
        "بالای ۱۵ دقیقه": 0
    }

    for sub in submissions:
        time_taken = sub.time_taken or 0  # زمان به ثانیه
        if time_taken < 180:
            time_dist["زیر ۳ دقیقه"] += 1
        elif 180 <= time_taken < 360:
            time_dist["۳ تا ۶ دقیقه"] += 1
        elif 360 <= time_taken < 600:
            time_dist["۶ تا ۱۰ دقیقه"] += 1
        elif 600 <= time_taken < 900:
            time_dist["۱۰ تا ۱۵ دقیقه"] += 1
        else:
            time_dist["بالای ۱۵ دقیقه"] += 1

    time_distribution_payload = [
        {"name": key, "users": value} for key, value in time_dist.items()
    ]

    # ۴. استخراج سوالات مسابقه و آنالیز فیلد JSON یعنی answers_map
    questions = db.query(models.Question).filter(models.Question.contest_id == contest_id).order_by(models.Question.id.asc()).all()
    questions_stats_payload = []

    for index, q in enumerate(questions):
        correct_count = 0
        incorrect_count = 0

        for sub in submissions:
            # بررسی اینکه پاسخنامه حاوی اطلاعات نقشه پاسخ‌ها (JSON) باشد
            if sub.answers_map and isinstance(sub.answers_map, dict):
                # در اسناد JSON کلیدها همیشه رشته (String) هستند، پس آی‌دی سوال را به رشته تبدیل یا هر دو حالت را چک می‌کنیم
                user_choice = sub.answers_map.get(str(q.id)) or sub.answers_map.get(q.id)
                
                if user_choice is not None:
                    # هم‌سنگ‌سازی تایپ‌ها به عدد اینتجر جهت مقایسه بی‌نقص با correct_option دیتابیس
                    if int(user_choice) == q.correct_option:
                        correct_count += 1
                    else:
                        incorrect_count += 1

        # چسباندن گزینه‌ها در قالب آرایه برای نمایش پاپ‌آپ فرانت‌ند
        options_list = [q.option_1, q.option_2, q.option_3, q.option_4]

        questions_stats_payload.append({
            "question_index": index + 1,
            "correct": correct_count,
            "incorrect": incorrect_count,
            "title": q.text,                # 👈 هماهنگ با فیلد text در مدل شما
            "options": [opt for opt in options_list if opt],
            "correct_answer": q.correct_option  # 👈 هماهنگ با فیلد correct_option در مدل شما
        })

    # ۵. ارسال خروجی نهایی ساختاریافته به کلاینت
    return {
        "time_distribution": time_distribution_payload,
        "questions_stats": questions_stats_payload
    }

@app.post("/auth/refresh")
def refresh_access_token(payload: dict):
    refresh_token = payload.get("refresh_token")
    if not refresh_token:
        raise HTTPException(status_code=400, detail="ریفرش توکن ارسال نشده است")
        
    try:
        # تایید اصالت و انقضای ریفرش توکن
        decoded_data = jwt.decode(refresh_token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = decoded_data.get("sub")
        is_admin: bool = decoded_data.get("is_admin", False)
        
        if username is None:
            raise HTTPException(status_code=401, detail="توکن نامعتبر است")
            
        # 🌟 ساخت اکسس توکن جدید و تازه نفس
        access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        new_access_token = create_jwt_token(
            data={"sub": username, "is_admin": is_admin}, 
            expires_delta=access_token_expires
        )
        
        return {
            "access_token": new_access_token,
            "token_type": "bearer"
        }
        
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="ریفرش توکن منقضی یا نامعتبر شده است. لطفاً دوباره لاگین کنید"
        )