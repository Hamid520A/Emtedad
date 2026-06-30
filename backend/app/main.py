# =====================================================================
# بخش اول فایل main.py: ایمپورت‌ها، کانفیگ‌ها و موتورهای گرافیکی پروژه
# =====================================================================
import traceback

from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi import FastAPI, APIRouter, Depends, HTTPException, status, UploadFile, File, Request
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from typing import List, Optional, Dict, Any
from . import crud, schemas, models, auth, database
import shutil, os, random, httpx, base64, redis, json, io, requests, textwrap
from pydantic import BaseModel
from datetime import datetime, timedelta, date, time
from PIL import Image, ImageDraw, ImageFont
from fastapi.responses import JSONResponse, StreamingResponse
from jose import JWTError, jwt

app = FastAPI()

# ACCOUNT_REDIS_HOST = os.getenv("REDIS_HOST", "10.10.10.6")
ACCOUNT_REDIS_HOST = os.getenv("REDIS_HOST", "127.0.0.1")
ACCOUNT_REDIS_PORT = int(os.getenv("REDIS_PORT", 6379))
ACCOUNT_REDIS_DB = int(os.getenv("REDIS_DB", 0))
ACCOUNT_KEY = os.getenv("ACCOUNT_KEY", "latest_session:989371787445")
r = redis.Redis(host=ACCOUNT_REDIS_HOST, port=ACCOUNT_REDIS_PORT, db=ACCOUNT_REDIS_DB, decode_responses=True, socket_timeout=5)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# کانفیگ‌های امنیتی JWT
SECRET_KEY = "YOUR_SUPER_SECRET_KEY"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 15
REFRESH_TOKEN_EXPIRE_DAYS = 7
LIMIT_WINDOW = 60       # پنجره زمانی بر اساس ثانیه (۱ دقیقه)
MAX_REQUESTS = 60       # حداکثر تعداد درخواست مجاز در یک دقیقه برای صفحات عمومی
BLOCK_DURATION = 900    # زمان بلاک شدن IP در صورت اصرار بر تخلف (۱۵ دقیقه به ثانیه)

class StatusUpdate(BaseModel):
    status: str

# ساخت خودکار پوشه آپلودها در صورت عدم وجود
UPLOAD_DIR = "static/uploads"
if not os.path.exists(UPLOAD_DIR):
    os.makedirs(UPLOAD_DIR)
app.mount("/static", StaticFiles(directory="static"), name="static")

async def get_current_user_optional(request: Request, db: Session = Depends(database.get_db)):
    """تابع کمکی برای احراز هویت اختیاری؛ اگر کاربر توکن فرستاده بود هویتش مشخص می‌شود، در غیر این صورت None برمی‌گرداند"""
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        return None
        
    token = auth_header.split(" ")[1]
    try:
        # رمزگشایی توکن با کلیدهای امنیتی موجود در همین فایل
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        phone_number: str = payload.get("sub")
        if phone_number is None:
            return None
            
        user = db.query(models.User).filter(models.User.phone_number == phone_number).first()
        return user
    except JWTError:
        return None

def require_admin(current_user: models.User = Depends(auth.get_current_user), db: Session = Depends(database.get_db)):
    """بررسی سطح دسترسی مدیر در سنگر نهایی بک‌ند بر اساس جدول جدید admins"""
    if not current_user:
        raise HTTPException(status_code=401, detail="ابتدا وارد حساب کاربری خود شوید")
        
    if not getattr(current_user, "is_active", 1):
        raise HTTPException(status_code=403, detail="حساب کاربری شما غیرفعال است")
    
    # 🌟 سنگر نهایی تفکیک چند ادمینه: بررسی وجود رکورد متصل در جدول مستقل admins
    if not current_user.admin or current_user.admin.is_active == 0:
        raise HTTPException(
            status_code=403, 
            detail="خطای امنیتی: شما دسترسی لازم برای این بخش را ندارید!"
        )
        
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
    fa_digits = "۰۱۲۳۴۵۶۷۸۹"
    ar_digits = "٠١٢٣٤٥٦٧٨٩"
    en_digits = "0123456789"
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
        bbox = draw.textbbox((0, 0), text, font=font, direction="rtl")
        text_width = bbox[2] - bbox[0]
    except:
        text_width = len(text) * 13
    actual_x = center_x - (text_width // 2)
    safe_draw_text(draw, (actual_x, y), text, font, fill, direction="rtl")

def safe_draw_text(draw, position, text, font, fill, direction=None):
    try:
        if direction:
            draw.text(position, text, font=font, fill=fill, direction=direction)
        else:
            draw.text(position, text, font=font, fill=fill)
    except Exception:
        try:
            draw.text(position, text, font=font, fill=fill)
        except:
            pass

# 🌟 بازنویسی کامل موتور گرافیکی گواهی‌نامه‌ها منطبق بر معماری ۱ به N جداول جدید StarUML
def draw_certificate_canvas(user, contest, subscription):
    # ۱. واکشی اولین گواهی فعال مرتبط با این مسابقه از روی ریلیشن جدید
    cert = contest.certificates[0] if contest.certificates else None
    bg_url = cert.background_url if cert else None
    
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

    # پردازش متغیرهای نمره کاربر بر اساس ساختار مدل جدید Subscription (بزرگ شدن S)
    score_val = subscription.score or 0
    rank_text = "عالی" if score_val >= 85 else "خیلی خوب" if score_val >= 70 else "خوب"
    user_full_name = f"{user.first_name or ''} {user.last_name or ''}".strip() or "شرکت‌کننده امتداد"
    
    # 🌟 اصلاح هوشمند فیلد تاریخ تولد برای حل باگ برعکس شدن لایوت گرافیکی
    if user.birth_date:
        if hasattr(user.birth_date, "strftime"):
            raw_date = user.birth_date.strftime("%Y/%m/%d")
        else:
            parts = str(user.birth_date).split("-")
            raw_date = f"{parts[0]}/{parts[1]}/{parts[2]}" if len(parts) == 3 else str(user.birth_date)
        
        # استفاده از کاراکتر \u200e برای تثبیت جهت چپ به راست تاریخ در لایوت فارسی
        birth_date_str = f"\u200e{to_persian_digits(raw_date)}\u200e"
    else:
        birth_date_str = "---"

    # دریافت متن قالب گواهی از فیلد جدید cert.content
    template = cert.content if cert else "بدین‌وسیله گواهی می‌شود {{name}} در مسابقه شرکت نموده است."
    
    # اعمال جایگزینی‌ها همراه با فارسی‌سازی کدملی
    full_text = template.replace("{{name}}", user_full_name)\
                        .replace("{{national_id}}", to_persian_digits(user.national_id or "---"))\
                        .replace("{{birth_date}}", birth_date_str)\
                        .replace("{{rank}}", rank_text)

    # ۲. ثبت راست‌چین شماره سریال و تاریخ کاملاً فارسی
    persian_serial = to_persian_digits(f"1405{contest.id:02d}{user.id:02d}")
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

    # ۳. تنظیم سایز خودکار و رندر کاملاً متقارن متن اصلی لوح
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
        if (len(lines) * (target_font_size + 16)) <= 200:
            break
        target_font_size -= 2

    y_offset = 380 - ((len(lines) * (target_font_size + 16)) // 2)
    for line in lines:
        draw_centered_rtl_text(draw, 600, y_offset, line, font_main, "#FFFFFF")
        y_offset += target_font_size + 16

    # ۴. بارگذاری لوگوی اختصاصی گواهی نامه از فیلد جدید cert.logo_url
    logo_url = cert.logo_url if cert else None
    if logo_url:
        logo_img = safe_load_image(logo_url)
        if logo_img:
            logo_img = logo_img.resize((150, 150))
            img.paste(logo_img, (525, 40), logo_img)

    # ۵. 🌟 فوق‌العاده هوشمند: لوپ زدن روی جدول واسط و استخراج داینامیک امضاها تا سقف ۳ مدیر
    if font_bytes_bold:
        font_bytes_bold.seek(0)
        font_sign = ImageFont.truetype(font_bytes_bold, 24)
    else:
        font_sign = ImageFont.load_default()

    active_signers = []
    if cert and cert.certificate_signers:
        for cs in cert.certificate_signers[:3]: # برش لیست برای حداکثر ۳ امضا بر اساس لایوت
            if cs.signer:
                active_signers.append(cs.signer)

    num_signers = len(active_signers)
    if num_signers == 1:
        anchors = [600]
    elif num_signers == 2:
        anchors = [380, 820]
    elif num_signers == 3:
        anchors = [250, 600, 950]
    else:
        anchors = []

    for idx, signer in enumerate(active_signers):
        center_anchor = anchors[idx]
        
        # درج تصویر امضای شیشه‌ای (PNG) از جدول جدید Signers
        if signer.sign_url:
            sig_img = safe_load_image(signer.sign_url)
            if sig_img:
                sig_img = sig_img.resize((140, 70), Image.Resampling.LANCZOS)
                img.paste(sig_img, (center_anchor - 70, 530), sig_img)

        # چاپ مشخصات ادمین امضاکننده
        draw_centered_rtl_text(draw, center_anchor, 620, signer.name, font_sign, "#F3E5AB")
        if signer.title:
            draw_centered_rtl_text(draw, center_anchor, 660, signer.title, font_sub, "#A7975B")

    img_byte_arr = io.BytesIO()
    img.save(img_byte_arr, format='PNG')
    img_byte_arr.seek(0)
    return img_byte_arr

# =====================================================================
# سیستم پیشرفته Rate Limiting و بلاک موقت IP بر پایه ردیس پروژه
# =====================================================================

app.mount("/static", StaticFiles(directory="static"), name="static")
@app.middleware("http")
async def rate_limiter_and_ip_blocker(request: Request, call_next):
    client_ip = request.client.host if request.client else "unknown_ip"
    
    # ۱. یکسان‌سازی فوق‌سخت‌گیرانه و قطعی آی‌پی
    if "127.0.0.1" in client_ip or client_ip in ["::1", "localhost", "::ffff:127.0.0.1"]:
        client_ip = "127.0.0.1"
        
    # ۲. شاه‌کلید حل باگ CORS Preflight مرورگرها
    if request.method == "OPTIONS":
        return await call_next(request)

    # ۳. استثنا کردن فایل‌های استاتیک پروژه‌
    if request.url.path.startswith("/static"):
        return await call_next(request)

    cors_headers = {
        "Access-Control-Allow-Origin": "http://localhost:3000",
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Allow-Methods": "*",
        "Access-Control-Allow-Headers": "*",
    }

    try:
        # ۴. بررسی وضعیت بلاک IP در ردیس
        block_key = f"blocked_ip:{client_ip}"
        is_blocked = r.get(block_key)
        if is_blocked:
            ttl = r.ttl(block_key)
            minutes_left = max(1, ttl // 60)
            return JSONResponse(
                status_code=403,
                content={"detail": f"دسترسی شما موقتاً مسدود شده است. لطفا {minutes_left} دقیقه دیگر تلاش کنید."},
                headers=cors_headers
            )

        # 🌟 ۵. تفکیک کلید شمارنده ردیس بر اساس مسیر اختصاصی هر روت برای جلوگیری از تداخل ترافیک صفحات
        path_suffix = request.url.path.strip("/").replace("/", "_") or "root"
        rate_key = f"rate_limit:{client_ip}:{path_suffix}"
        current_requests = r.get(rate_key)

        route_max_limit = MAX_REQUESTS
        if request.url.path in ["/login", "/register", "/users/change-password"]:
            route_max_limit = 10  
        elif request.url.path.endswith("/submissions"):
            route_max_limit = 10
        elif request.url.path in ["/admin/login", "/admin/stats"]:
            route_max_limit = 20
        
        if current_requests and int(current_requests) >= route_max_limit:
            r.setex(block_key, BLOCK_DURATION, "true")
            r.delete(rate_key)
            return JSONResponse(
                status_code=429,
                content={"detail": "تعداد درخواست‌های شما بیش از حد مجاز است! دسترسی شما به مدت ۱۵ دقیقه مسدود شد."},
                headers=cors_headers
            )

        # ۶. افزایش یا ایجاد شمارنده زمان‌دار در رم ردیس
        if not current_requests:
            r.setex(rate_key, LIMIT_WINDOW, 1)
        else:
            r.incr(rate_key)

    except redis.exceptions.ConnectionError as e:
        print(f"⚠️ هشدار امنیتی: سرور ردیس در دسترس نیست. سیستم ریت‌لیمیت موقتاً بای‌پاس شد.")

    response = await call_next(request)
    return response

# =====================================================================
# بخش دوم فایل main.py: روت‌های احراز هویت، مسابقات، سوالات و کارنامه
# =====================================================================
# 🌟 اندپوینت مفقود شده برای لود داینامیک استان‌ها و شهرها از دیتابیس جدید
@app.get("/cities", response_model=List[schemas.City])
def get_cities(
    parents_only: Optional[bool] = False, 
    parent_id: Optional[int] = None, 
    db: Session = Depends(database.get_db)
):
    query = db.query(models.City)
    
    # اگر فرانت‌ند فقط استان‌ها را بخواهد
    if parents_only:
        query = query.filter(models.City.parent_id == None)
    # اگر فرانت‌ند شهرهای یک استان خاص را بخواهد
    elif parent_id:
        query = query.filter(models.City.parent_id == parent_id)
        
    return query.all()

@app.post("/register", response_model=schemas.User)
def register(user: schemas.UserCreate, db: Session = Depends(database.get_db)):
    # یکدست‌سازی شماره تلفن و رمز عبور به اعداد انگلیسی
    user.phone_number = fa_to_en_digits(user.phone_number)
    user.password = fa_to_en_digits(user.password)

    if len(user.password) < 6:
        raise HTTPException(
            status_code=400, 
            detail="خطای امنیتی: رمز عبور انتخاب شده بسیار کوتاه است. حداقل طول مجاز ۶ کاراکتر می‌باشد."
        )
    
    db_user = db.query(models.User).filter(models.User.phone_number == user.phone_number).first()
    if db_user:
        raise HTTPException(status_code=400, detail="شماره قبلاً ثبت شده")
        
    db_user_national = db.query(models.User).filter(models.User.national_id == user.national_id).first()
    if db_user_national:
        raise HTTPException(status_code=400, detail="کد ملی قبلاً ثبت شده")
        
    # هش کردن رمز عبور و ساخت کاربر بر اساس فیلدهای جدید (حذف جنسیت و استان متنی)
    hashed_pwd = auth.get_password_hash(user.password)
    db_model_user = models.User(
        first_name=user.first_name,
        last_name=user.last_name,
        phone_number=user.phone_number,
        password=hashed_pwd,
        national_id=user.national_id,
        city_id=user.city_id,
        birth_date=user.birth_date,
        gender=user.gender
    )
    db.add(db_model_user)
    db.commit()
    db.refresh(db_model_user)
    return db_model_user

@app.post("/login")
def login(login_data: schemas.UserLogin, db: Session = Depends(database.get_db)):
    login_data.phone_number = fa_to_en_digits(login_data.phone_number)
    login_data.password = fa_to_en_digits(login_data.password)
    
    # ۱. پیدا کردن کاربر از روی شماره تلفن
    user = db.query(models.User).filter(models.User.phone_number == login_data.phone_number).first()
    if not user or not auth.verify_password(login_data.password, user.password):
        raise HTTPException(status_code=401, detail="شماره یا رمز عبور اشتباه است")
        
    # 🔒 ۲. سنگر تفکیک نقش‌ها (برطرف کردن باگ):
    # اگر این کاربر در جدول مستقل admins رکوردی فعال دارد، اجازه ورود از درگاه عادی را به او نده
    if user.admin and user.admin.is_active == 1:
        raise HTTPException(
            status_code=403, 
            detail="خطای دسترسی: حساب شما سطح دسترسی مدیریت دارد. لطفا از درگاه اختصاصی ادمین وارد شوید!"
        )
        
    # ۳. صدور توکن استاندارد برای کاربر عادی (is_admin همیشه False پلمپ می‌شود)
    token = auth.create_access_token(data={
        "sub": user.phone_number,
        "is_admin": False
    })
    
    return {
        "access_token": token, 
        "token_type": "bearer"
    }

@app.get("/contests", response_model=List[schemas.Contest])
def get_all_contests(status: Optional[str] = None, db: Session = Depends(database.get_db)):
    """دریافت لیست مسابقات - فیلتر کامل و قطعی مسابقات حذف شده (Soft Deleted)"""
    # 🌟 فیکس: فیلتر سخت‌گیرانه برای عدم نمایش مسابقات حذف شده
    contests = db.query(models.Contest).filter(models.Contest.deleted_at == None).all()
    now = datetime.now() # 🌟 اصلاح شد: استفاده مستقیم از کلاس datetime
    
    modified = False
    for contest in contests:
        if contest.status == 'upcoming' and contest.start_time and contest.start_time <= now:
            contest.status = 'active'
            modified = True
            
    if modified:
        db.commit()

    # اگر فرانت‌ند فیلتر استاتوس فرستاده بود
    if status:
        return db.query(models.Contest).filter(
            models.Contest.status == status,
            models.Contest.deleted_at == None # 🌟 فیلتر همزمان حذف نرم
        ).all()
        
    return contests

@app.get("/contests/{contest_id}")
def get_contest_detail(
    contest_id: int, 
    db: Session = Depends(database.get_db), 
    current_user: Optional[models.User] = Depends(get_current_user_optional) # 🌟 متصل به دپندنسی محلی جدید
):
    cors_headers = {
        "Access-Control-Allow-Origin": "http://localhost:3000",
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
    }
    
    contest = db.query(models.Contest).filter(models.Contest.id == contest_id).first()
    if not contest:
        return JSONResponse(status_code=404, content={"detail": "مسابقه یافت نشد"}, headers=cors_headers)
    
    time_limit_minutes = 10
    if contest.max_time:
        time_limit_minutes = contest.max_time.hour * 60 + contest.max_time.minute
        
    attachments = db.query(models.Attachment).filter(models.Attachment.contest_id == contest_id).all()
    file_url = ""
    for attach in attachments:
        if attach.file_type == "pdf":
            file_url = attach.file_url
            break
            
    db_awards = db.query(models.AwardContest).filter(models.AwardContest.contest_id == contest_id).all()
    awards_data = []
    for ac in db_awards:
        if ac.award:
            awards_data.append({"rank": ac.number, "title": ac.award.title})
        
    certificate_type = "none"
    cert_payload = None
    
    if contest.certificates:
        cert = contest.certificates[0]
        if "عالی" in cert.title: certificate_type = "excellent"
        elif "خیلی خوب" in cert.title: certificate_type = "very_good"
        elif "خوب" in cert.title: certificate_type = "good"
        
        # 🔒 لایه امنیت: جزئیات امضاها و تصاویر گواهی فقط برای ادمین معتبر لود می‌شود
        if current_user and current_user.admin and current_user.admin.is_active == 1:
            cert_payload = {
                "content": cert.content or "",
                "background_url": cert.background_url or "",
                "logo_url": cert.logo_url or "",
                "signers": [
                    {
                        "name": cs.signer.name if cs.signer else "",
                        "title": cs.signer.title if cs.signer else "",
                        "sign_url": cs.signer.sign_url if cs.signer else ""
                    } for cs in cert.certificate_signers[:3]
                ]
            }
        
    return JSONResponse(status_code=200, headers=cors_headers, content={
        "id": contest.id,
        "title": contest.title,
        "description": contest.description,
        "image_url": contest.image_url,
        "video_url": contest.video_url,
        "status": contest.status,
        "start_time": contest.start_time.isoformat() if contest.start_time else None,
        "end_time": contest.end_time.isoformat() if contest.end_time else None,
        "server_now": datetime.now().isoformat(),
        "question_limit": contest.question_limit,
        "time_limit": time_limit_minutes,
        "file_url": file_url,
        "awards": awards_data,
        "certificate_type": certificate_type,
        "certificate_details": cert_payload
    })

@app.get("/contests/{contest_id}/questions", response_model=List[schemas.RandomizedQuestion])
def get_questions_list(
    contest_id: int, 
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user) # 🌟 تزریق یوزر جاری برای بررسی هویت
):
    contest = db.query(models.Contest).filter(models.Contest.id == contest_id).first()
    if not contest:
        raise HTTPException(status_code=404, detail="مسابقه یافت نشد")
        
    # 🌟 سنگر اول فرانت‌ند: بررسی سخت‌گیرانه در دیتابیس قبل از تحویل سوالات
    existing_subscription = db.query(models.Subscription).filter(
        models.Subscription.user_id == current_user.id,
        models.Subscription.contest_id == contest_id
    ).first()

    if existing_subscription:
        raise HTTPException(
            status_code=403, 
            detail="شما قبلاً در این آزمون شرکت کرده‌اید و مجاز به ورود مجدد نیستید!"
        )
        
    # واکشی سوالات حذف نشده مسابقه
    all_questions = db.query(models.Question).filter(
        models.Question.contest_id == contest_id, 
        models.Question.is_active == 1,
        models.Question.deleted_at == None
    ).all()
    
    selected_questions = random.sample(all_questions, min(len(all_questions), 15))
    processed_questions = []
    
    for q in selected_questions:
        options = [{"id": ans.id, "title": ans.title} for ans in q.answers if ans.deleted_at == None]
        random.shuffle(options)
        
        processed_questions.append({
            "id": q.id,
            "title": q.title,
            "description": q.description,
            "shuffled_options": options
        })
    return processed_questions

@app.post("/contests", response_model=schemas.Contest)
def create_new_contest(contest: schemas.ContestCreate, db: Session = Depends(database.get_db)):
    minutes = contest.time_limit or 10
    max_time_obj = time(hour=minutes // 60, minute=minutes % 60)

    db_contest = models.Contest(
        title=contest.title,
        description=contest.description,
        image_url=contest.image_url,
        video_url=contest.video_url,
        max_time=max_time_obj,
        start_time=contest.start_time,
        end_time=contest.end_time,
        status=contest.status,
        question_limit=contest.question_limit
    )
    db.add(db_contest)
    db.commit()
    db.refresh(db_contest)

    # 🌟 مدیریت رابطه‌ای جوایز بر اساس جدول مستقل Awards و ستون number
    if contest.award:
        try:
            awards_list = json.loads(contest.award)
            for aw in awards_list:
                rank_num = int(aw.get('rank', 1))
                award_title = aw.get('title', '').strip()
                if not award_title: continue
                
                # الف) چک کردن یا ساختن عنوان جایزه در جدول اصلی awards
                db_award = db.query(models.Award).filter(models.Award.title == award_title).first()
                if not db_award:
                    db_award = models.Award(title=award_title)
                    db.add(db_award)
                    db.commit()
                    db.refresh(db_award)
                
                # ب) چفت کردن جایزه به مسابقه در جدول واسط با ستون اختصاصی number
                db_award_contest = models.AwardContest(
                    contest_id=db_contest.id,
                    award_id=db_award.id,
                    number=rank_num
                )
                db.add(db_award_contest)
        except Exception as e:
            print(f"⚠️ خطا در ساخت اولیه جوایز: {e}")

    if contest.file_url:
        db_attachment = models.Attachment(contest_id=db_contest.id, file_name="جزوه راهنمای دوره", file_url=contest.file_url, file_type="pdf", file_size=0)
        db.add(db_attachment)

    if contest.certificate_type and contest.certificate_type != 'none':
        type_labels = {"excellent": "عالی", "very_good": "خیلی خوب", "good": "خوب"}
        label = type_labels.get(contest.certificate_type, "عمومی")
        db_certificate = models.Certificate(contest_id=db_contest.id, title=f"گواهی {label} - دوره {contest.title}", content="بدین‌وسیله گواهی می‌شود...", is_active=1)
        db.add(db_certificate)

    db.commit()
    db.refresh(db_contest)
    return db_contest

@app.post("/contests/{contest_id}/questions", response_model=schemas.Question)
def add_question_to_contest(
    contest_id: int, 
    payload: dict, # 🌟 ورودی منعطف برای هضم فرمت فرانت‌ند و شکستن قفل ۴۲۲
    db: Session = Depends(database.get_db)
):
    contest = db.query(models.Contest).filter(models.Contest.id == contest_id).first()
    if not contest:
        raise HTTPException(status_code=404, detail="مسابقه یافت نشد")
        
    # ۱. استخراج عنوان و توضیحات سوال از دکشنری
    question_title = payload.get("title", payload.get("text", "")).strip()
    if not question_title:
        raise HTTPException(status_code=400, detail="متن صورت سوال نمی‌تواند خالی باشد")
        
    question_desc = payload.get("description", "")
    
    # ۲. ایجاد و ثبت صورت سوال
    db_question = models.Question(
        title=question_title,
        description=question_desc,
        contest_id=contest_id
    )
    db.add(db_question)
    db.commit()
    db.refresh(db_question)
    
    # ۳. پردازش و چسباندن گزینه‌ها بر اساس دیتای دریافتی
    if "answers" in payload and isinstance(payload["answers"], list):
        for ans in payload["answers"]:
            db_answer = models.Answer(
                question_id=db_question.id,
                title=ans.get("title", ""),
                is_correct=int(ans.get("is_correct", 0))
            )
            db.add(db_answer)
    else:
        # هندل کردن فرمت گزینه‌های تخت فرانت‌ند (۱ تا ۴)
        correct_opt = int(payload.get("correct_option", 1))
        options_list = [
            payload.get("option_1"),
            payload.get("option_2"),
            payload.get("option_3"),
            payload.get("option_4")
        ]
        for idx, opt_text in enumerate(options_list):
            if opt_text is not None:
                db_ans = models.Answer(
                    question_id=db_question.id,
                    title=str(opt_text).strip(),
                    is_correct=1 if (idx + 1) == correct_opt else 0
                )
                db.add(db_ans)
    
    db.commit()
    db.refresh(db_question) # 🌟 لود شدن خودکار تمام گزینه‌های جدید در شیء اصلی
    
    # ۴. 🌟 بازگرداندن مدل استاندارد دیتابیس که کاملاً توسط response_model معتبرسازی می‌شود
    return db_question

@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    file_path = os.path.join(UPLOAD_DIR, file.filename)
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    return {"url": f"http://localhost:8000/static/uploads/{file.filename}"}

@app.get("/contests/{contest_id}/leaderboard")
def get_leaderboard(contest_id: int, db: Session = Depends(database.get_db)):
    cors_headers = {
        "Access-Control-Allow-Origin": "http://localhost:3000",
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
    }
    
    try:
        # دریافت لیست شرکت‌کنندگان
        subscriptions = db.query(models.Subscription).filter(
            models.Subscription.contest_id == contest_id,
            models.Subscription.deleted_at == None
        ).all()
        
        results = []
        for index, sub in enumerate(subscriptions):
            if not sub.user:
                continue

            # 🌟 اصلاح شد: استخراج مستقیم زمان مصرف شده از دیتابیس بدون تفریق معکوس
            time_taken_seconds = 0
            if sub.time_left:
                try:
                    if hasattr(sub.time_left, "hour"): 
                        time_taken_seconds = (sub.time_left.hour * 3600) + (sub.time_left.minute * 60) + sub.time_left.second
                    elif hasattr(sub.time_left, "total_seconds"): 
                        time_left_seconds = int(sub.time_left.total_seconds())
                    else: 
                        time_taken_seconds = int(sub.time_left)
                except Exception as t_err:
                    print(f"⚠️ خطای جزیی تایمر: {t_err}")
                    time_taken_seconds = 0

            national_id = sub.user.national_id or "****"
            last_four_digits = national_id[-4:] if len(national_id) >= 4 else national_id
            score_val = sub.score if sub.score is not None else 0
            
            results.append({
                "rank": index + 1,
                "user_id": sub.user_id,
                "name": f"{sub.user.first_name} {sub.user.last_name or ''}".strip(),
                "score": score_val,
                "time": time_taken_seconds,        
                "time_taken": time_taken_seconds,  
                "last_four_id": last_four_digits
            })
            
        # مرتب‌سازی نهایی (نمره بیشتر اول، زمان کمتر اول)
        results.sort(key=lambda x: (-x["score"], x["time_taken"]))
        
        for idx, item in enumerate(results):
            item["rank"] = idx + 1
            
        return JSONResponse(status_code=200, content=results, headers=cors_headers)

    except Exception as global_err:
        print("\n❌❌❌ [خطای بحرانی اندپوینت لیدربرد] ❌❌❌")
        traceback.print_exc()
        print("--------------------------------------------------\n")
        
        return JSONResponse(
            status_code=500, 
            content={"detail": f"Internal Server Error: {str(global_err)}"}, 
            headers=cors_headers
        )

@app.put("/users/me")
def update_my_profile(
    payload: dict,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    user = db.query(models.User).filter(models.User.id == current_user.id).first()
    if not user:
        raise HTTPException(status_code=404, detail="کاربر یافت نشد")
        
    # ۱. آپدیت فیلدهای متنی ساده
    user.first_name = payload.get("first_name", user.first_name)
    user.last_name = payload.get("last_name", user.last_name)
    user.birth_date = payload.get("birth_date", user.birth_date)
    
    # ۲. 🌟 تبدیل نام متنی شهر فرانت‌ند به city_id معتبر در دیتابیس
    city_name = payload.get("city")
    if city_name:
        db_city = db.query(models.City).filter(models.City.title == city_name).first()
        if db_city:
            user.city_id = db_city.id
            
    db.commit()
    return {"message": "اطلاعات پروفایل با موفقیت به‌روزرسانی شد"}

@app.get("/users/me/profile")
def get_my_complete_profile(
    db: Session = Depends(database.get_db), 
    current_user: models.User = Depends(auth.get_current_user)
):
    # ۱. بارگذاری کاربر به همراه اطلاعات کامل شهر و استان والد
    user_data = db.query(models.User)\
                  .filter(models.User.id == current_user.id)\
                  .options(joinedload(models.User.city).joinedload(models.City.parent))\
                  .first()
                  
    # ۲. استخراج هوشمند نام شهر و استان از جدول رابطه‌ای
    city_title = user_data.city.title if user_data.city else "---"
    province_title = user_data.city.parent.title if (user_data.city and user_data.city.parent) else "---"
    
    # ۳. واکشی تاریخچه مسابقات کاربر از جدول subscriptions
    history_records = []
    
    # 🌟 اصلاح شد: اضافه شدن join و فیلتر مسابقات حذف شده (deleted_at == None) در سطح دیتابیس
    subs = db.query(models.Subscription)\
             .join(models.Contest, models.Subscription.contest_id == models.Contest.id)\
             .filter(
                 models.Subscription.user_id == current_user.id,
                 models.Contest.deleted_at == None
             ).all()
             
    for s in subs:
        if s.contest:
            total_seconds = 0
            if s.time_left:
                total_seconds = (s.time_left.hour * 3600) + (s.time_left.minute * 60) + s.time_left.second
                
            history_records.append({
                "contest_id": s.contest.id,
                "contest_title": s.contest.title,
                "score": f"{s.score}%",
                "time_taken": total_seconds,
                "status": s.contest.status
            })

    return {
        "id": user_data.id,
        "first_name": user_data.first_name,
        "last_name": user_data.last_name,
        "phone_number": user_data.phone_number,
        "national_id": user_data.national_id,
        "birth_date": str(user_data.birth_date) if user_data.birth_date else "---",
        "city_title": city_title,
        "province_title": province_title,
        "history": history_records
    }

@app.get("/users/me/contests/{contest_id}/answers")
def get_my_own_contest_answers(contest_id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    try:
        contest = db.query(models.Contest).filter(models.Contest.id == contest_id).first()
        if not contest:
            raise HTTPException(status_code=404, detail="مسابقه یافت نشد")
            
        sub = db.query(models.Subscription).filter(
            models.Subscription.user_id == current_user.id,
            models.Subscription.contest_id == contest_id
        ).first()
        if not sub:
            raise HTTPException(status_code=404, detail="پاسخنامه‌ای برای شما یافت نشد")
        
        questions = db.query(models.Question).filter(models.Question.contest_id == contest_id).all()
        
        user_answers = db.query(models.SubscriptionAnswer)\
                             .join(models.SubscriptionQuestions, models.SubscriptionAnswer.subscription_question_id == models.SubscriptionQuestions.id)\
                             .filter(models.SubscriptionQuestions.subscription_id == sub.id)\
                             .all()
        
        chosen_answer_ids = {ans.answer_id for ans in user_answers if ans.is_chosen == 1}
        if not chosen_answer_ids:
            chosen_answer_ids = {ans.answer_id for ans in user_answers}

        results = []
        for idx, q in enumerate(questions):
            q_answers = sorted(q.answers, key=lambda x: x.id)
            opts = [ans.title for ans in q_answers]
            
            # پیدا کردن موقعیت عددی گزینه انتخابی کاربر (۱ تا ۴)
            selected_option_index = None
            for i, ans in enumerate(q_answers):
                if ans.id in chosen_answer_ids:
                    selected_option_index = i + 1
                    break
            
            # 🌟 فیکس هوشمند لایه امنیت: اگر مسابقه تمام شده بود کلید را بفرست، در غیر این صورت کلید مکتوم و None می‌ماند
            correct_answer_index = None
            if contest.status == "finished":
                for i, ans in enumerate(q_answers):
                    if ans.is_correct == 1:
                        correct_answer_index = i + 1
                        break
            
            results.append({
                "question_index": idx + 1,
                "title": q.title,
                "options": opts,
                "selected_option": selected_option_index, # گزینه خود کاربر با موفقیت ارسال می‌شود
                "correct_answer": correct_answer_index    # برای مسابقات در حال برگزاری کاملا مخفی (None) است
            })
            
        return results

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"خطا در پردازش پاسخنامه: {str(e)}")

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
        subscription = db.query(models.Subscription).filter(
            models.Subscription.user_id == current_user.id,
            models.Subscription.contest_id == contest_id
        ).first()
        
        if not subscription:
            return JSONResponse(status_code=403, content={"detail": "شما هنوز در این مسابقه شرکت نکرده‌اید."}, headers=cors_headers)
            
        contest = db.query(models.Contest).filter(models.Contest.id == contest_id).first()
        if not contest:
            return JSONResponse(status_code=404, content={"detail": "مسابقه مورد نظر یافت نشد."}, headers=cors_headers)
            
        # بررسی وجود گواهی در سیستم جدید
        cert = contest.certificates[0] if contest.certificates else None
        if not cert or cert.is_active == 0:
            return JSONResponse(status_code=400, content={"detail": "این مسابقه فاقد امتیاز صدور گواهی نامه است."}, headers=cors_headers)

        if (subscription.score or 0) < 50:
            return JSONResponse(status_code=400, content={"detail": "امتیاز شما برای دریافت گواهی کافی نیست."}, headers=cors_headers)

        try:
            canvas = draw_certificate_canvas(current_user, contest, subscription)
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
       
@app.get("/users/me/submissions/{contest_id}")
def get_user_submission_review(
    contest_id: int,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    sub = db.query(models.Subscription).filter(
        models.Subscription.user_id == current_user.id,
        models.Subscription.contest_id == contest_id,
        models.Subscription.deleted_at == None
    ).first()
    
    if not sub:
        raise HTTPException(status_code=404, detail="پاسخنامه‌ای برای این مسابقه یافت نشد")
        
    contest = db.query(models.Contest).filter(models.Contest.id == contest_id).first()
    
    questions = db.query(models.Question).filter(
        models.Question.contest_id == contest_id,
        models.Question.is_active == 1,
        models.Question.deleted_at == None
    ).all()
    
    dynamic_answers_map = {}
    for sq in sub.subscription_questions:
        chosen_ans = db.query(models.SubscriptionAnswer).filter(
            models.SubscriptionAnswer.subscription_question_id == sq.id
        ).filter(
            (models.SubscriptionAnswer.is_chosen == 1) | (models.SubscriptionAnswer.is_chosen == None)
        ).first()
        if chosen_ans:
            dynamic_answers_map[str(sq.question_id)] = chosen_ans.answer_id
    
    questions_data = []
    for q in questions:
        options_list = []
        correct_option_id = None
        
        for ans in q.answers:
            if ans.deleted_at == None:
                options_list.append({
                    "id": ans.id,
                    "title": ans.title
                })
                if ans.is_correct == 1:
                    correct_option_id = ans.id
                    
        # سنگر امنیت: اگر مسابقه تمام نشده بود، پاسخ صحیح لو نمی‌رود
        if contest and contest.status != "finished":
            correct_option_id = None
            
        # 🌟 فیکس باگ عدم نمایش گزینه انتخابی: دیتای انتخاب کاربر را مستقیم درون خود شیء سوال تزریق می‌کنیم
        user_selected_ans_id = dynamic_answers_map.get(str(q.id)) or dynamic_answers_map.get(q.id)
            
        questions_data.append({
            "id": q.id,
            "title": q.title,
            "description": q.description,
            "shuffled_options": options_list,
            "correct_option": correct_option_id,
            "user_option": user_selected_ans_id,      # فرمت اول برای استیت کامپوننت آزمون
            "selected_option": user_selected_ans_id  # فرمت دوم جهت اطمینان از رندر رادیوباتن‌ها
        })
        
    total_seconds = 0
    if sub.time_left:
        total_seconds = (sub.time_left.hour * 3600) + (sub.time_left.minute * 60) + sub.time_left.second

    return {
        "contest_id": contest_id,
        "contest_status": contest.status if contest else "active",
        "score": sub.score,
        "time_taken": total_seconds,
        "questions": questions_data,
        "answers_map": dynamic_answers_map 
    }

@app.post("/users/change-password")
def change_my_password(
    payload: dict,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    old_password = payload.get("old_password")
    new_password = payload.get("new_password")
    
    if not old_password or not new_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail="وارد کردن رمز عبور فعلی و رمز عبور جدید الزامی است"
        )
    
    if len(str(new_password)) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail="رمز عبور جدید باید حداقل ۶ کاراکتر باشد."
        )
        
    # 🌟 اصلاح شد: استفاده از current_user.password به جای hashed_password قدیمی
    if not auth.verify_password(old_password, current_user.password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail="رمز عبور فعلی وارد شده اشتباه است"
        )
        
    # 🌟 اصلاح شد: سِت کردن و هش کردن پسورد جدید روی ستون password
    current_user.password = auth.get_password_hash(new_password)
    
    db.commit()
    return {"message": "رمز عبور شما با موفقیت تغییر یافت 🎉"}

# =====================================================================
# بخش سوم فایل main.py: مدیریت ثبت آزمون، لیدربرد سراسری و ابزارهای ادمین
# =====================================================================

@app.post("/subscriptions")
def submit_exam(subscription: schemas.SubscriptionCreate, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    try:
        # ۱. بررسی ثبت‌نام تکراری بر اساس مدل جدید Subscription
        existing_subscription = db.query(models.Subscription).filter(
            models.Subscription.user_id == current_user.id,
            models.Subscription.contest_id == subscription.contest_id
        ).first()

        if existing_subscription:
            raise HTTPException(status_code=400, detail="شما قبلاً در این آزمون شرکت کرده‌اید و نمره شما ثبت شده است!")

        # ۲. ایجاد رکورد اصلی شرکت در مسابقه
        db_subscription = models.Subscription(
            user_id=current_user.id,
            contest_id=subscription.contest_id,
            score=subscription.score,
            started_at=datetime.utcnow()
        )
        db.add(db_subscription)
        db.commit()
        db.refresh(db_subscription)
        
        # ۳. 🌟 مهندسی معکوس و نرمال‌سازی نقشه پاسخ‌ها به جداول تفکیک‌شده جدید
        answers_map = getattr(subscription, "answers_map", None)
        if answers_map and isinstance(answers_map, dict):
            for q_id, a_id in answers_map.items():
                # ایجاد رکورد سوال پاسخ داده شده
                db_sub_q = models.SubscriptionQuestions(
                    subscription_id=db_subscription.id,
                    question_id=int(q_id)
                )
                db.add(db_sub_q)
                db.commit()
                db.refresh(db_sub_q)

                # ایجاد رکورد گزینه‌ انتخاب شده توسط کاربر
                db_sub_a = models.SubscriptionAnswer(
                    subscription_question_id=db_sub_q.id,
                    answer_id=int(a_id),
                    is_chosen=1
                )
                db.add(db_sub_a)
            db.commit()

        return {"status": "success", "id": db_subscription.id}
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(f"Error saving subscription: {e}")
        raise HTTPException(status_code=500, detail="خطا در ذخیره نمره در دیتابیس")
 

@app.patch("/contests/{contest_id}/status")
def update_contest_status(contest_id: str, status_update: StatusUpdate, db: Session = Depends(database.get_db)):
    contest = db.query(models.Contest).filter(models.Contest.id == contest_id).first()
    if not contest:
        raise HTTPException(status_code=404, detail="مسابقه یافت نشد")
    
    contest.status = status_update.status
    db.commit()
    db.refresh(contest)
    return {"message": "وضعیت با موفقیت تغییر کرد", "new_status": contest.status}

@app.post("/admin/login")
def admin_login(login_data: schemas.UserLogin, db: Session = Depends(database.get_db)):
    login_data.phone_number = fa_to_en_digits(login_data.phone_number)
    login_data.password = fa_to_en_digits(login_data.password)
    
    # ۱. پیدا کردن کاربر از روی شماره موبایل در جدول اصلی کاربران
    user = db.query(models.User).filter(models.User.phone_number == login_data.phone_number).first()
    if not user or not auth.verify_password(login_data.password, user.password):
        raise HTTPException(status_code=401, detail="شماره یا رمز عبور اشتباه است")
        
    # 🌟 ۲. سنگر اصلی بررسی هویت ادمین: چک کردن وجود رکورد متصل در جدول مستقل admins
    if not user.admin or user.admin.is_active == 0:
        raise HTTPException(
            status_code=403, 
            detail="خطای امنیتی: شما اجازه ورود از درگاه مدیریت را ندارید!"
        )
        
    # ۳. صدور توکن مدیریت
    token = auth.create_access_token(data={"sub": user.phone_number, "is_admin": True})
    return {"access_token": token, "token_type": "bearer", "is_admin": True}

@app.delete("/admin/contests/{contest_id}")
@app.delete("/admin/contest/{contest_id}")
def delete_contest(
    contest_id: int, 
    db: Session = Depends(database.get_db), 
    current_admin: models.User = Depends(require_admin)
):
    """نسخه اصلاح شده حذف مسابقه بدون باگ کرش تایم"""
    db_contest = db.query(models.Contest).filter(models.Contest.id == contest_id).first()
    
    if not db_contest:
        raise HTTPException(status_code=404, detail="مسابقه یافت نشد")
        
    if db_contest.deleted_at is not None:
        return {"message": "این مسابقه قبلاً حذف شده است", "status": "already_deleted"}
    
    now = datetime.now() # 🌟 فیکس اصلی: اصلاح از datetime.datetime.now به datetime.now
    
    db_contest.deleted_at = now
    db_contest.is_active = 0
    
    db.query(models.Question).filter(models.Question.contest_id == contest_id).update({"deleted_at": now, "is_active": 0}, synchronize_session=False)
    db.query(models.Attachment).filter(models.Attachment.contest_id == contest_id).update({"deleted_at": now, "is_active": 0}, synchronize_session=False)
    
    db.commit()
    return {"message": "مسابقه با موفقیت حذف شد"}

@app.delete("/admin/questions/{question_id}")
def delete_question(
    question_id: int, 
    db: Session = Depends(database.get_db), 
    current_admin: models.User = Depends(require_admin)
):
    # فقط سوالاتی رو پیدا کن که قبلاً حذف نرم نشدن (deleted_at اونها None هست)
    db_question = db.query(models.Question).filter(
        models.Question.id == question_id, 
        models.Question.deleted_at == None
    ).first()
    
    if not db_question:
        raise HTTPException(status_code=404, detail="سوال یافت نشد")
    
    # 🌟 شاه‌کلید: پر کردن فیلد زمان حذف به جای پاک کردن رکورد
    current_time = func.now()
    db_question.deleted_at = current_time
    
    # حذف نرم خودکارِ تمام گزینه‌های متصل به این سوال
    for ans in db_question.answers:
        ans.deleted_at = current_time
        
    db.commit()
    return {"message": "سوال با موفقیت (به صورت نرم) حذف شد"}

@app.get("/admin/contests", response_model=List[schemas.Contest])
def get_admin_contests_list(
    db: Session = Depends(database.get_db), 
    current_admin: models.User = Depends(require_admin)
):
    """روت اختصاصی پنل ادمین برای لود لیست مسابقات بدون نمایش موارد حذف شده"""
    contests = db.query(models.Contest).filter(
        models.Contest.deleted_at == None
    ).order_by(models.Contest.id.desc()).all()
    return contests

@app.get("/admin/stats")
async def get_admin_stats(db: Session = Depends(database.get_db), current_admin: models.User = Depends(require_admin)):
    total_users = db.query(models.User).count()
    total_contests = db.query(models.Contest).filter(models.Contest.deleted_at == None).count()
    active_contests = db.query(models.Contest).filter(
        models.Contest.status == "active", 
        models.Contest.deleted_at == None
    ).count()

    # 🌟 واکشی هوشمند نام استان پیشتاز با جوین و سلف‌جوین در ساختار جدید درختی Cities
    from sqlalchemy.orm import aliased
    CityParent = aliased(models.City)
    
    top_province_query = db.query(
        CityParent.title, 
        func.count(models.User.id).label('user_count')
    ).join(models.City, models.User.city_id == models.City.id)\
     .join(CityParent, models.City.parent_id == CityParent.id)\
     .group_by(CityParent.title)\
     .order_by(func.count(models.User.id).desc())\
     .first()
     
    top_province = top_province_query[0] if top_province_query else "بدون داده"

    now_time = datetime.now()
    seven_days_ago = now_time - timedelta(days=7)
    fourteen_days_ago = now_time - timedelta(days=14)

    this_week_users = db.query(models.User).filter(models.User.created_at >= seven_days_ago).count()
    last_week_users = db.query(models.User).filter(models.User.created_at >= fourteen_days_ago, models.User.created_at < seven_days_ago).count()

    if last_week_users == 0:
        growth_percentage = 100 if this_week_users > 0 else 0
    else:
        growth_percentage = round(((this_week_users - last_week_users) / last_week_users) * 100, 1)

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
    
    return {
        "total_users": total_users,
        "total_contests": total_contests,
        "active_contests": active_contests,
        "top_province": top_province,
        "growth_percentage": growth_percentage,
        "chart_data": chart_data
    }

# =====================================================================
# بخش چهارم فایل main.py: ابزارهای پیشرفته مدیریت، خروجی اکسل و مپینگ گواهی‌ها
# =====================================================================

@app.post("/proxy-upload")
def proxy_get_profile_photo(
    request_data: dict, 
    db: Session = Depends(database.get_db), 
    current_user: models.User = Depends(auth.get_current_user) # 🌟 اضافه شدن تاثیری امنیت و دسترسی به کاربر جاری
):
    EITAA_API_URL = "http://10.10.10.4:3000/send" 
    try:
        session_json_str = r.get(ACCOUNT_KEY)
        if not session_json_str:
            return {"status": "error", "message": f"500: کلید سشن {ACCOUNT_KEY} در ردیس یافت نشد."}
        
        session_data = json.loads(session_json_str)
        token = session_data.get("token")
        imei = session_data.get("imei")

        if not token or not imei:
            return {"status": "error", "message": "500: مقادیر token یا imei در ردیس مفقود هستند."}
        
        request_data["token"] = token
        request_data["imei"] = imei

        # ارسال درخواست همزمان به سرور آپ‌استریم ایتا
        response = requests.post(EITAA_API_URL, json=request_data, timeout=25.0)
        response_data = response.json()

        # 🌟 لایه هوشمند کش دیتای هویت‌سنجی ایتا در دیتابیس پروژه
        if request_data.get("method") == "contacts.importContacts" and response.status_code == 200:
            eitaa_users = response_data.get("users", [])
            
            if eitaa_users and len(eitaa_users) > 0:
                eitaa_user = eitaa_users[0]
                
                # استخراج مقادیر و تبدیل قطعی به عددی برای سازگاری با int8 / BigInteger
                fetched_eitaa_id = int(eitaa_user.get("id"))
                fetched_access_hash = int(eitaa_user.get("access_hash"))
                
                # ۱. بررسی سخت‌گیرانه یکتا بودن آیدی ایتا (Uniqueness Check)
                is_unique = db.query(models.User).filter(
                    models.User.eitaa_user_id == fetched_eitaa_id,
                    models.User.id != current_user.id # مطمئن می‌شویم متعلق به خود این کاربر در دیتابیس نباشد
                ).first()
                
                if not is_unique:
                    # ۲. اگر آیدی منحصر به فرد بود و کاربر خودش هنوز ذخیره نکرده بود، آپدیت کن
                    if current_user.eitaa_user_id != fetched_eitaa_id:
                        current_user.eitaa_user_id = fetched_eitaa_id
                        current_user.eitaa_access_hash = fetched_access_hash
                        db.commit()
                        db.refresh(current_user)
                        print(f"✅ اطلاعات ایتا برای کاربر {current_user.id} با موفقیت کش شد.")
                else:
                    print(f"⚠️ خطای یکتایی: آیدی ایتای {fetched_eitaa_id} قبلاً توسط حساب دیگری تصاحب شده است.")

        return response_data
            
    except json.JSONDecodeError:
        return {"status": "error", "message": "500: ساختار متنی ردیس فرمت JSON معتبری ندارد."}
    except Exception as e:
        return {"status": "error", "message": f"500: خطا در برقراری ارتباط: {str(e)}"}
    
@app.get("/admin/users", response_model=List[Dict[str, Any]])
@app.get("/admin/users-list", response_model=List[Dict[str, Any]])
def get_admin_users_list(
    db: Session = Depends(database.get_db), 
    current_admin: models.User = Depends(require_admin)
):
    """واکشی بهینه‌شده و فوق‌سریع لیست کاربران برای پنل ادمین بدون مشکل N+1 Query"""
    
    # بارگذاری پیش‌دستانه (Eager Loading) شهرها و استان‌ها برای جلوگیری از کوئری‌های تکراری در حلقه
    users = db.query(models.User)\
              .options(joinedload(models.User.city).joinedload(models.City.parent))\
              .all()
              
    results = []
    for u in users:
        # ۱. محاسبه بهینه میانگین نمرات کاربر
        avg_score_query = db.query(func.avg(models.Subscription.score))\
                            .filter(models.Subscription.user_id == u.id)\
                            .scalar()
        average_score = f"{round(float(avg_score_query), 1)}%" if avg_score_query is not None else "---"

        # ۲. واکشی یکجای رکوردهای ثبت‌نام کاربر مسابقات حذف نشده
        all_subs = db.query(models.Subscription)\
                     .join(models.Contest, models.Subscription.contest_id == models.Contest.id)\
                     .filter(models.Subscription.user_id == u.id, models.Contest.deleted_at == None)\
                     .options(joinedload(models.Subscription.contest))\
                     .all()
                     
        participated_contests = [sub.contest.title for sub in all_subs if sub.contest]

        # پیدا کردن آخرین مسابقه شرکت کرده
        last_sub = all_subs[-1] if all_subs else None
        
        # ۳. استخراج سریع نام شهر و استان از روی کش ریلیشن‌ها (بدون زدن کوئری مجدد به دیتابیس)
        province_title = "---"
        city_title = "---"
        if u.city:
            city_title = u.city.title
            if u.city.parent:
                province_title = u.city.parent.title
            else:
                province_title = u.city.title

        results.append({
            "id": u.id,
            "name": f"{u.first_name or ''} {u.last_name or ''}".strip() or "بدون نام",
            "phone": u.phone_number,  
            "national_id": u.national_id or "---",
            "province": province_title,
            "city": city_title,
            "gender": "---", 
            "last_contest": last_sub.contest.title if last_sub and last_sub.contest else "شرکت نکرده",
            "all_contests": participated_contests,
            "average_score": average_score,
            "is_admin": True if u.id == 1 else False
        })
        
    return results

@app.get("/admin/provinces-report")
async def get_admin_provinces_report(db: Session = Depends(database.get_db), current_admin: models.User = Depends(require_admin)):
    total_users = db.query(models.User).count() or 1

    # واکشی آمار استان‌ها با جوین درختی جدول جدید مکانی Cities
    from sqlalchemy.orm import aliased
    CityParent = aliased(models.City)
    
    report_query = db.query(
        CityParent.title.label("province_title"),
        func.count(models.User.id).label('user_count')
    ).join(models.City, models.User.city_id == models.City.id)\
     .join(CityParent, models.City.parent_id == CityParent.id)\
     .group_by(CityParent.title)\
     .order_by(func.count(models.User.id).desc()).all()

    report_data = []
    for row in report_query:
        percentage = (row.user_count / total_users) * 100
        report_data.append({
            "province": row.province_title,
            "count": row.user_count,
            "percentage": round(percentage, 1)
        })

    return report_data

@app.put("/admin/questions/{question_id}")
def update_contest_question(
    question_id: int, 
    question_update: Dict[str, Any], # استفاده از دیکشنری برای مپ کردن فیلدهای قدیمی فرانت‌ند
    db: Session = Depends(database.get_db), 
    current_admin: models.User = Depends(require_admin)
):
    db_question = db.query(models.Question).filter(models.Question.id == question_id).first()
    if not db_question:
        raise HTTPException(status_code=404, detail="سوال یافت نشد")

    contest = db.query(models.Contest).filter(models.Contest.id == db_question.contest_id).first()
    if not contest:
        raise HTTPException(status_code=404, detail="مسابقه متصل به این سوال یافت نشد")

    if contest.status != "upcoming":
        raise HTTPException(
            status_code=400, 
            detail="این مسابقه شروع شده یا پایان یافته است؛ تنها سوالات مسابقاتی که در حالت «به زودی» هستند قابل ویرایش می‌باشند."
        )

    # مپینگ فیلد متنی قدیمی به فیلد title جدید
    db_question.title = question_update.get("text", db_question.title)
    db_question.description = question_update.get("description", db_question.description)
    db.commit()

    # 🌟 مپینگ فوق‌العاده هوشمند: اگر فرانت‌ند سیستم گزینه‌های سنتی ۱ تا ۴ را فرستاد، آن‌ها را در جدول جدید ریلیشن‌ها سینک کن
    if "option_1" in question_update:
        # حذف گزینه‌های قدیمی سوال
        db.query(models.Answer).filter(models.Answer.question_id == question_id).delete()
        
        correct_opt = int(question_update.get("correct_option", 1))
        options_list = [
            question_update.get("option_1"),
            question_update.get("option_2"),
            question_update.get("option_3"),
            question_update.get("option_4")
        ]
        
        for idx, opt_text in enumerate(options_list):
            if opt_text:
                db_ans = models.Answer(
                    question_id=question_id,
                    title=opt_text,
                    is_correct=1 if (idx + 1) == correct_opt else 0
                )
                db.add(db_ans)
        db.commit()
    
    db.refresh(db_question)
    return {"status": "success", "message": "سوال با موفقیت ویرایش شد"}

@app.get("/admin/users/{user_id}/detail")
def get_user_detail(user_id: int, db: Session = Depends(database.get_db), current_admin: models.User = Depends(require_admin)):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="کاربر یافت نشد")
        
    history_records = []
    
    # فیلتر مسابقات حذف نشده از پرونده ادمین
    subs = db.query(models.Subscription)\
             .join(models.Contest, models.Subscription.contest_id == models.Contest.id)\
             .filter(
                 models.Subscription.user_id == user_id,
                 models.Contest.deleted_at == None
             ).all()
             
    for s in subs:
        if s.contest:
            # 🌟 فیکس نهایی: فیلد time_left شما زمان مصرف شده را مستقیم دارد؛ پس بدون تفریق آن را به ثانیه تبدیل می‌کنیم
            time_taken = 0
            if s.time_left:
                time_taken = (s.time_left.hour * 3600) + (s.time_left.minute * 60) + s.time_left.second

            history_records.append({
                "contest_id": s.contest.id,
                "contest_title": s.contest.title,
                "score": s.score or 0,
                "time_taken": time_taken # ارسال مستقیم زمان واقعی مصرف شده به فرانت‌ند
            })
            
    return {
        "id": user.id,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "phone": user.phone_number,
        "national_id": user.national_id,
        "province": user.city.parent.title if (user.city and user.city.parent) else "---",
        "city": user.city.title if user.city else "---",
        "gender": user.gender,
        "birth_date": str(user.birth_date) if user.birth_date else "---",
        "history": history_records
    }

@app.put("/admin/users/{user_id}/update")
def update_admin_user_profile(user_id: int, payload: dict, db: Session = Depends(database.get_db), current_admin: models.User = Depends(require_admin)):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="کاربر یافت نشد")
        
    user.first_name = payload.get("first_name", user.first_name)
    user.last_name = payload.get("last_name", user.last_name)
    user.phone_number = payload.get("phone", payload.get("phone_number", user.phone_number))
    user.national_id = payload.get("national_id", user.national_id)
    
    if "city_id" in payload:
        user.city_id = payload.get("city_id")
        
    if "birth_date" in payload and payload.get("birth_date"):
        try:
            user.birth_date = datetime.strptime(payload.get("birth_date"), "%Y-%m-%d").date()
        except Exception:
            pass
    
    db.commit()
    return {"status": "success", "message": "اطلاعات کاربر با موفقیت ویرایش شد"}

@app.get("/admin/users/{user_id}/contests/{contest_id}/answers")
def get_admin_user_answers(
    user_id: int,
    contest_id: int,
    db: Session = Depends(database.get_db),
    current_admin: models.User = Depends(require_admin)
):
    """واکشی کارنامه تشریحی بر اساس ساختار ریلیشنال دیتابیس امتداد امام و فیلد is_chosen"""
    
    # ۱. پیدا کردن سابسکریپشن آزمون کاربر
    subscription = db.query(models.Subscription).filter(
        models.Subscription.user_id == user_id,
        models.Subscription.contest_id == contest_id
    ).first()
    
    if not subscription:
        raise HTTPException(status_code=404, detail="پاسخنامه‌ای برای این کاربر یافت نشد")
        
    # ۲. پیدا کردن تمام سوالات این مسابقه خاص به ترتیب ورود
    questions = db.query(models.Question).filter(
        models.Question.contest_id == contest_id,
        models.Question.is_active == 1,
        models.Question.deleted_at == None
    ).order_by(models.Question.id.asc()).all()
    
    results = []
    for idx, q in enumerate(questions):
        # واکشی گزینه‌های سوال با چیدمان ثابت صعودی (گزینه ۱ تا ۴)
        options_data = db.query(models.Answer).filter(
            models.Answer.question_id == q.id,
            models.Answer.deleted_at == None
        ).order_by(models.Answer.id.asc()).all()
        
        options_text_list = [opt.title for opt in options_data]
        
        # ۳. پیدا کردن ردیف گزینه صحیح (عدد ۱ تا ۴) بر اساس فیلد is_correct
        correct_idx = 1
        for o_idx, opt in enumerate(options_data):
            if opt.is_correct == 1:
                correct_idx = o_idx + 1
                break
                
        # 🌟 ۴. شاه‌کلید فیکس: استخراج گزینه انتخابی کاربر از جداول رابطه‌ای دیتابیس شما
        selected_option_idx = None
        
        # پیدا کردن سطر سوال در این سابسکریپشن
        sub_question = db.query(models.SubscriptionQuestions).filter(
            models.SubscriptionQuestions.subscription_id == subscription.id,
            models.SubscriptionQuestions.question_id == q.id
        ).first()
        
        if sub_question:
            # پیدا کردن پاسخی که کاربر علامت زده است (is_chosen == 1)
            chosen_answer_record = db.query(models.SubscriptionAnswer).filter(
                models.SubscriptionAnswer.subscription_question_id == sub_question.id,
                models.SubscriptionAnswer.is_chosen == 1
            ).first()
            
            if chosen_answer_record:
                # تبدیل آیدی دیتابیس به ردیف گزینه‌های ۱ تا ۴ جهت انطباق با فرانت‌ند
                for o_idx, opt in enumerate(options_data):
                    if opt.id == chosen_answer_record.answer_id:
                        selected_option_idx = o_idx + 1
                        break
                        
        results.append({
            "question_index": idx + 1,
            "title": q.title,
            "options": options_text_list,
            "selected_option": selected_option_idx,  # عدد ۱ تا ۴ انتخابی کاربر (یا None اگر جواب نداده)
            "correct_answer": correct_idx          # عدد ۱ تا ۴ کلید صحیح
        })
        
    return results

@app.put("/admin/contests/{contest_id}/certificate-template")
def update_certificate_template(contest_id: int, data: dict, db: Session = Depends(database.get_db)):
    contest = db.query(models.Contest).filter(models.Contest.id == contest_id).first()
    if not contest:
        raise HTTPException(status_code=404, detail="مسابقه مورد نظر یافت نشد")
    
    # 🌟 مپینگ ریلیشن‌های لوح تقدیر: بررسی وجود یا ساخت رکورد در جدول جدید Certificate
    cert = db.query(models.Certificate).filter(models.Certificate.contest_id == contest_id).first()
    if not cert:
        cert = models.Certificate(contest_id=contest_id, title=f"گواهی {contest.title}")
        db.add(cert)
        db.commit()
        db.refresh(cert)

    cert.content = data.get("certificate_text_template", cert.content)
    cert.background_url = data.get("certificate_bg_url", cert.background_url)
    cert.logo_url = data.get("certificate_logo_url", cert.logo_url)
    db.commit()
    
    # پاک‌سازی لینک امضاهای قبلی این گواهی برای جلوگیری از انباشتگی رکوردهای تکراری
    db.query(models.CertificateSigners).filter(models.CertificateSigners.certificate_id == cert.id).delete()
    db.commit()

    # تابع کمکی داخلی برای چفت کردن داینامیک مشخصات امضاکنندگان در جداول مستقل Signer و CertificateSigners
    def link_signer(name, title, sig_url):
        if name:
            signer = db.query(models.Signer).filter(models.Signer.name == name, models.Signer.title == title).first()
            if not signer:
                signer = models.Signer(name=name, title=title, sign_url=sig_url)
                db.add(signer)
                db.commit()
                db.refresh(signer)
            
            link = models.CertificateSigners(certificate_id=cert.id, signer_id=signer.id)
            db.add(link)
            db.commit()

    link_signer(data.get("signer_name"), data.get("signer_title"), data.get("signer_signature_url"))
    link_signer(data.get("signer_2_name"), data.get("signer_2_title"), data.get("signer_2_signature_url"))
    link_signer(data.get("signer_3_name"), data.get("signer_3_title"), data.get("signer_3_signature_url"))
    
    return {"status": "success", "message": "تنظیمات گواهی با موفقیت ذخیره شد"}

@app.get("/admin/export-data")
def get_export_data(contest_id: Optional[int] = None, db: Session = Depends(database.get_db), current_admin: models.User = Depends(require_admin)):
    if contest_id:
        subscriptions = db.query(models.Subscription).filter(models.Subscription.contest_id == contest_id).all()
        report = []
        for sub in subscriptions:
            u = sub.user
            if not u: continue
                
            prov_title = "---"
            if u.city and u.city.parent_id:
                parent_city = db.query(models.City).filter(models.City.id == u.city.parent_id).first()
                if parent_city: prov_title = parent_city.title
                    
            report.append({
                "نام": u.first_name or "---",
                "نام خانوادگی": u.last_name or "---",
                "شماره تماس": u.phone_number,
                "کد ملی": u.national_id or "---",
                "استان": prov_title,
                "نام مسابقه": sub.contest.title if sub.contest else "---",
                "نمره": f"{sub.score}%",
                "زمان (ثانیه)": 0,
                "تاریخ ثبت‌نام": u.created_at.strftime("%Y/%m/%d") if u.created_at else "---"
            })
        return report

    users = db.query(models.User).all()
    report = []
    for u in users:
        subscription = db.query(models.Subscription).filter(models.Subscription.user_id == u.id).first()
        contest_title = "شرکت نکرده"
        if subscription and subscription.contest:
            contest_title = subscription.contest.title

        prov_title = "---"
        if u.city and u.city.parent_id:
            parent_city = db.query(models.City).filter(models.City.id == u.city.parent_id).first()
            if parent_city: prov_title = parent_city.title

        report.append({
            "نام": u.first_name or "---",
            "نام خانوادگی": u.last_name or "---",
            "شماره تماس": u.phone_number,
            "کد ملی": u.national_id or "---",
            "استان": prov_title,
            "نام مسابقه": contest_title,
            "نمره": f"{subscription.score}%" if subscription else "0%",
            "زمان (ثانیه)": 0,
            "تاریخ ثبت‌نام": u.created_at.strftime("%Y/%m/%d") if u.created_at else "---"
        })
    return report
    
# =====================================================================
# بخش پنجم و پایانی فایل main.py: صدور گواهی مدیریت، بنرها و آنالیز دیتابیس
# =====================================================================

@app.get("/admin/users/{user_id}/contests/{contest_id}/certificate/download")
def generate_user_certificate_image(
    user_id: int,
    contest_id: int,
    db: Session = Depends(database.get_db),
    current_admin: models.User = Depends(require_admin)
):
    # ۱. واکشی اطلاعات از دیتابیس جدید با مدل Subscription
    user = db.query(models.User).filter(models.User.id == user_id).first()
    contest = db.query(models.Contest).filter(models.Contest.id == contest_id).first()
    subscription = db.query(models.Subscription).filter(
        models.Subscription.user_id == user_id, 
        models.Subscription.contest_id == contest_id
    ).first()
    
    if not user or not contest or not subscription:
        raise HTTPException(status_code=404, detail="اطلاعات کاربر، مسابقه یا کارنامه یافت نشد")

    # ۲. 🚀 استفاده هوشمندانه از موتور گرافیکی متمرکزی که در تکه اول توسعه دادیم
    try:
        canvas = draw_certificate_canvas(user, contest, subscription)
    except Exception as canvas_err:
        print(f"❌ خطای ترسیم در پنل ادمین: {canvas_err}")
        raise HTTPException(status_code=500, detail="خطا در رندر تصویر گواهی‌نامه")

    response_headers = {
        "Content-Disposition": f"attachment; filename=admin_user_{user_id}_cert.png"
    }
    return StreamingResponse(canvas, media_type="image/png", headers=response_headers)

@app.post("/admin/banners")
def create_banner(banner_data: schemas.BannerCreate, db: Session = Depends(database.get_db), current_admin: models.User = Depends(require_admin)):
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

@app.get("/banners")
def get_active_banners(db: Session = Depends(database.get_db)):
    # دریافت بنرهای فعال برای صفحه اصلی فرانت‌ند
    return db.query(models.Banner).filter(models.Banner.status == "active").all()

@app.patch("/admin/contests/{contest_id}")
def update_contest(
    contest_id: int, 
    contest_data: dict, 
    db: Session = Depends(database.get_db), 
    current_admin: models.User = Depends(require_admin)
):
    """ویرایش فوق‌امن مسابقه و سینک خودکار قالب گواهی بدون ریسک خطای ۵۰۰ و CORS"""
    db_contest = db.query(models.Contest).filter(models.Contest.id == contest_id).first()
    if not db_contest:
        raise HTTPException(status_code=404, detail="مسابقه یافت نشد")
    
    now = datetime.now()

    for key, value in contest_data.items():
        if value is None:
            continue
            
        if key == "time_limit":
            minutes = int(value or 10)
            db_contest.max_time = time(hour=minutes // 60, minute=minutes % 60)
            
        elif key == "start_time" and isinstance(value, str):
            try: db_contest.start_time = datetime.fromisoformat(value.replace('Z', ''))
            except ValueError: pass
                
        elif key == "end_time" and isinstance(value, str):
            try: db_contest.end_time = datetime.fromisoformat(value.replace('Z', ''))
            except ValueError: pass
            
        elif key == "status":
            if value == "active":
                db_contest.status = "active"
                db_contest.start_time = now
                if db_contest.max_time:
                    duration_minutes = db_contest.max_time.hour * 60 + db_contest.max_time.minute
                    db_contest.end_time = now + timedelta(minutes=duration_minutes)
                else:
                    db_contest.end_time = now + timedelta(minutes=10)
            elif value == "resume":
                if db_contest.start_time and db_contest.start_time <= now:
                    db_contest.status = "active"
                    if db_contest.max_time:
                        duration_minutes = db_contest.max_time.hour * 60 + db_contest.max_time.minute
                        db_contest.end_time = now + timedelta(minutes=duration_minutes)
                else:
                    db_contest.status = "upcoming"
            elif value == "ended":
                db_contest.status = "ended"
                db_contest.end_time = now
            else:
                db_contest.status = value
                
        # 🌟 تغییر کلیدی: بروزرسانی نوع گواهی مسابقه در صورت تغییر در فرم
        elif key == "certificate_type":
            cert = db.query(models.Certificate).filter(models.Certificate.contest_id == contest_id).first()
            if value == "none":
                if cert: db.delete(cert)
            else:
                type_labels = {"excellent": "عالی", "very_good": "خیلی خوب", "good": "خوب"}
                label = type_labels.get(value, "عمومی")
                title_str = f"گواهی {label} - دوره {db_contest.title}"
                if cert: cert.title = title_str
                else:
                    db.add(models.Certificate(contest_id=contest_id, title=title_str, content="بدین‌وسیله گواهی می‌شود...", is_active=1))

        # 🌟 فیکس اصلی: فقط فیلدهای متنی و عددی مجاز را تغییر بده تا دیتابیس روی ریلیشن‌ها کرش نکند
        elif key in ["title", "description", "image_url", "video_url", "question_limit", "is_active"]:
            setattr(db_contest, key, value)
    
    # 🌟 هوشمندسازی: اگر دیتای قالب گواهی همزمان با این فرم پست شده بود، همین‌جا ذخیره‌اش کن
    cert_text = contest_data.get("certificate_text_template")
    cert_bg = contest_data.get("certificate_bg_url")
    cert_logo = contest_data.get("certificate_logo_url")
    
    if cert_text or cert_bg or cert_logo:
        cert = db.query(models.Certificate).filter(models.Certificate.contest_id == contest_id).first()
        if not cert:
            cert = models.Certificate(contest_id=contest_id, title=f"گواهی - دوره {db_contest.title}")
            db.add(cert)
            db.commit()
            db.refresh(cert)
            
        if cert_text: cert.content = cert_text
        if cert_bg: cert.background_url = cert_bg
        if cert_logo: cert.logo_url = cert_logo
        db.commit()
        
        # مدیریت و نوسازی امضاکنندگان قالب گواهی
        if "signer_name" in contest_data:
            db.query(models.CertificateSigners).filter(models.CertificateSigners.certificate_id == cert.id).delete()
            db.commit()
            
            def link_signer(name, title, sig_url):
                if name:
                    signer = db.query(models.Signer).filter(models.Signer.name == name, models.Signer.title == title).first()
                    if not signer:
                        signer = models.Signer(name=name, title=title, sign_url=sig_url)
                        db.add(signer)
                        db.commit()
                        db.refresh(signer)
                    db.add(models.CertificateSigners(certificate_id=cert.id, signer_id=signer.id))
            
            link_signer(contest_data.get("signer_name"), contest_data.get("signer_title"), contest_data.get("signer_signature_url"))
            link_signer(contest_data.get("signer_2_name"), contest_data.get("signer_2_title"), contest_data.get("signer_2_signature_url"))
            link_signer(contest_data.get("signer_3_name"), contest_data.get("signer_3_title"), contest_data.get("signer_3_signature_url"))

    # مدیریت تغییرات بخش جوایز
    if "award" in contest_data and contest_data["award"]:
        try:
            db.query(models.AwardContest).filter(models.AwardContest.contest_id == contest_id).delete()
            awards_list = contest_data["award"]
            if isinstance(awards_list, str): awards_list = json.loads(awards_list)
            if isinstance(awards_list, list):
                for aw in awards_list:
                    rank_num = int(aw.get('rank', 1))
                    award_title = aw.get('title', '').strip()
                    if not award_title: continue
                    db_award = db.query(models.Award).filter(models.Award.title == award_title).first()
                    if not db_award:
                        db_award = models.Award(title=award_title)
                        db.add(db_award)
                        db.commit()
                        db.refresh(db_award)
                    db.add(models.AwardContest(contest_id=contest_id, award_id=db_award.id, number=rank_num))
        except Exception as e:
            print(f"⚠️ خطا در به‌روزرسانی جوایز: {e}")

    # مدیریت پیوست جزوه
    if "file_url" in contest_data and contest_data["file_url"]:
        db.query(models.Attachment).filter(models.Attachment.contest_id == contest_id, models.Attachment.file_type == "pdf").delete()
        db.add(models.Attachment(contest_id=contest_id, file_name="جزوه راهنمای دوره", file_url=contest_data["file_url"], file_type="pdf", file_size=0))

    db.commit()
    db.refresh(db_contest)
    
    return {
        "message": "مسابقه و گواهی متصل به آن با موفقیت ویرایش شدند",
        "status": db_contest.status,
        "start_time": db_contest.start_time.isoformat() if db_contest.start_time else None,
        "end_time": db_contest.end_time.isoformat() if db_contest.end_time else None
    }

@app.get("/admin/contests/{contest_id}/questions", response_model=List[schemas.Question])
def get_admin_questions_list(
    contest_id: int, 
    db: Session = Depends(database.get_db),
    current_admin: models.User = Depends(require_admin) # امنیت روت برای ادمین
):
    contest = db.query(models.Contest).filter(models.Contest.id == contest_id).first()
    if not contest:
        raise HTTPException(status_code=404, detail="مسابقه یافت نشد")
        
    # واکشی ۱۰۰٪ تمام سوالات (بدون محدودیت ۱۵ تایی) همراه با لود تضمینی گزینه‌ها و وضعیت پاسخ صحیح
    questions = db.query(models.Question)\
                  .filter(models.Question.contest_id == contest_id, models.Question.deleted_at == None)\
                  .options(joinedload(models.Question.answers))\
                  .all()
                  
    return questions

@app.get("/admin/contests/{contest_id}/analytics")
def get_contest_analytics(contest_id: int, db: Session = Depends(database.get_db)):
    cors_headers = {
        "Access-Control-Allow-Origin": "http://localhost:3000",
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
    }
    
    contest = db.query(models.Contest).filter(models.Contest.id == contest_id).first()
    if not contest:
        return JSONResponse(status_code=404, content={"detail": "مسابقه یافت نشد"}, headers=cors_headers)
        
    subscriptions = db.query(models.Subscription).filter(
        models.Subscription.contest_id == contest_id,
        models.Subscription.deleted_at == None
    ).all()
    
    total_participants = len(subscriptions)
    
    # ۱. بخش توزیع زمانی (کاملاً سالم و فیکس)
    time_dist = {
        "زیر ۱ دقیقه": 0,
        "۱ تا ۳ دقیقه": 0,
        "۳ تا ۵ دقیقه": 0,
        "بالای ۵ دقیقه": 0
    }
    
    contest_total_seconds = 600
    if contest and contest.max_time:
        contest_total_seconds = (contest.max_time.hour * 3600) + (contest.max_time.minute * 60) + contest.max_time.second
    
    for sub in subscriptions:
        time_taken = 0
        if sub.time_left:
            try:
                if hasattr(sub.time_left, "hour"):
                    time_taken = (sub.time_left.hour * 3600) + (sub.time_left.minute * 60) + sub.time_left.second
                else:
                    time_taken = int(sub.time_left)
            except:
                time_taken = 0
            
        if time_taken < 60: time_dist["زیر ۱ دقیقه"] += 1
        elif time_taken < 180: time_dist["۱ تا ۳ دقیقه"] += 1
        elif time_taken < 300: time_dist["۳ تا ۵ دقیقه"] += 1
        else: time_dist["بالای ۵ دقیقه"] += 1
        
    time_payload = [{"name": k, "users": v} for k, v in time_dist.items()]
    
    # ۲. 🌟 واکشی سوالات و گزینه‌ها با کوئری‌های مستقیم و مستقل دیتابیسی (حل مشکل غیب شدن میله‌ها و فعال‌سازی پاپ‌آپ)
    questions_payload = []
    questions = db.query(models.Question).filter(
        models.Question.contest_id == contest_id, 
        models.Question.deleted_at == None
    ).order_by(models.Question.id.asc()).all()
    
    for idx, q in enumerate(questions):
        # 🌟 واکشی مستقیم گزینه‌ها از دیتابیس بدون اتکا به ریلیشن تنبل q.answers
        answers = db.query(models.Answer).filter(
            models.Answer.question_id == q.id,
            models.Answer.deleted_at == None
        ).order_by(models.Answer.id.asc()).all()
        
        options_list = []
        correct_answer_id = None
        correct_index = 1
        
        for a_idx, ans in enumerate(answers):
            options_list.append(ans.title)
            if ans.is_correct == 1:
                correct_answer_id = ans.id
                correct_index = a_idx + 1 # ایندکس گزینه‌ی صحیح برای فرانت‌ند
        
        # 🌟 واکشی مستقیم و ایمن تمام پاسخ‌های انتخاب شده (is_chosen == 1) از دیتابیس
        chosen_answers = db.query(models.SubscriptionAnswer).join(
            models.SubscriptionQuestions, 
            models.SubscriptionAnswer.subscription_question_id == models.SubscriptionQuestions.id
        ).join(
            models.Subscription,
            models.SubscriptionQuestions.subscription_id == models.Subscription.id
        ).filter(
            models.Subscription.contest_id == contest_id,
            models.Subscription.deleted_at == None,
            models.SubscriptionQuestions.question_id == q.id,
            models.SubscriptionQuestions.deleted_at == None,
            models.SubscriptionAnswer.is_chosen == 1,
            models.SubscriptionAnswer.deleted_at == None
        ).all()
        
        correct_count = 0
        for ca in chosen_answers:
            if correct_answer_id and int(ca.answer_id) == int(correct_answer_id):
                correct_count += 1
        
        # پاسخ‌های اشتباه = کل شرکت‌کنندگان منهای پاسخ‌های صحیح
        incorrect_count = max(0, total_participants - correct_count)
        
        # فرستادن پکیج کامل دیتا به فرانت‌ند
        questions_payload.append({
            "question_index": idx + 1,
            "title": q.title,
            "correct": correct_count,
            "incorrect": incorrect_count,
            "options": options_list,          # 🌟 تزریق شد: گزینه‌ها دیگر هرگز خالی نمی‌شوند
            "correct_answer": correct_index   # 🌟 تزریق شد: کلید صحیح برای روشن شدن در پاپ‌آپ
        })
        
    return JSONResponse(status_code=200, content={
        "time_distribution": time_payload,
        "questions_stats": questions_payload
    }, headers=cors_headers)

@app.post("/auth/refresh")
def refresh_access_token(payload: dict):
    refresh_token = payload.get("refresh_token")
    if not refresh_token:
        raise HTTPException(status_code=400, detail="ریفرش توکن ارسال نشده است")
        
    try:
        decoded_data = jwt.decode(refresh_token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = decoded_data.get("sub")
        is_admin: bool = decoded_data.get("is_admin", False)
        
        if username is None:
            raise HTTPException(status_code=401, detail="توکن نامعتبر است")
            
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
    
@app.post("/submissions")
def submit_exam_results(
    payload: dict, 
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    contest_id = payload.get("contest_id")
    time_taken = payload.get("time_taken", 0)
    answers_map = payload.get("answers_map", {}) # دکشنری ارسالی فرانت‌ند به فرمت {question_id: option_id}
    
    # ۱. واکشی سوالات حذف نشده‌ی این مسابقه برای محاسبه امن نمره در سرور
    questions = db.query(models.Question).filter(
        models.Question.contest_id == contest_id,
        models.Question.deleted_at == None
    ).all()
    
    if not questions:
        raise HTTPException(status_code=400, detail="این مسابقه سوالی ندارد")
        
    # ۲. مقایسه انتخاب‌های کاربر با گزینه‌های صحیح دیتابیس
    correct_count = 0
    for q in questions:
        user_option_id = answers_map.get(str(q.id)) or answers_map.get(q.id)
        correct_option = next((ans for ans in q.answers if ans.is_correct == 1), None)
        
        if correct_option and user_option_id and int(user_option_id) == correct_option.id:
            correct_count += 1
            
    score_percentage = (correct_count / len(questions)) * 100 if questions else 0
    
    # تبدیل ثانیه‌های فرانت‌ند به شیء استاندارد Time دیتابیس
    t_seconds = int(payload.get("time_taken", 0))
    time_obj = time(hour=(t_seconds // 3600) % 24, minute=(t_seconds % 3600) // 60, second=t_seconds % 60)
    
    sub = db.query(models.Subscription).filter(
        models.Subscription.user_id == current_user.id,
        models.Subscription.contest_id == contest_id
    ).first()
    
    if not sub:
        sub = models.Subscription(
            user_id=current_user.id,
            contest_id=contest_id,
            score=round(score_percentage),
            time_left=time_obj, 
            is_left=1
        )
        db.add(sub)
        db.commit()
        db.refresh(sub)
    else:
        sub.score = round(score_percentage)
        sub.time_left = time_obj 
        sub.is_left = 1
        db.commit()
        db.refresh(sub)
        
    # 🌟 شاه‌کلید فیکس: پاکسازی پاسخ‌های قدیمی همین کاربر (برای جلوگیری از رکوردهای تکراری در صورت ثبت مجدد)
    existing_qs = db.query(models.SubscriptionQuestions).filter(models.SubscriptionQuestions.subscription_id == sub.id).all()
    for eq in existing_qs:
        db.query(models.SubscriptionAnswer).filter(models.SubscriptionAnswer.subscription_question_id == eq.id).delete()
    db.query(models.SubscriptionQuestions).filter(models.SubscriptionQuestions.subscription_id == sub.id).delete()
    db.commit()

    # 🌟 شاه‌کلید فیکس: ذخیره تک‌تک پاسخ‌ها در جداول واسط برای دیتاماینینگ و آنالیز نمودار ادمین
    for q_id, a_id in answers_map.items():
        if a_id is not None:
            db_sub_q = models.SubscriptionQuestions(
                subscription_id=sub.id,
                question_id=int(q_id)
            )
            db.add(db_sub_q)
            db.commit()
            db.refresh(db_sub_q)

            db_sub_a = models.SubscriptionAnswer(
                subscription_question_id=db_sub_q.id,
                answer_id=int(a_id),
                is_chosen=1
            )
            db.add(db_sub_a)
            
    db.commit()
    
    return {
        "score": round(score_percentage),
        "correct_count": correct_count,
        "total_questions": len(questions)
    }


@app.get("/admin/contests/{contest_id}/participants")
def get_admin_contest_participants(
    contest_id: int,
    search: Optional[str] = None,
    db: Session = Depends(database.get_db),
    current_admin: models.User = Depends(require_admin)
):
    """واکشی امن لیست شرکت‌کنندگان مسابقه مخصوص پنل مدیریت"""
    # استفاده از Left Outer Join (اختیاری) تا اگر کاربری دیتایش ناقص بود هم کل لیست کرش نکند
    query = db.query(models.Subscription).filter(
        models.Subscription.contest_id == contest_id,
        models.Subscription.deleted_at == None
    )
    
    if search and search.strip() and search != "undefined":
        search_filter = f"%{search.strip()}%"
        query = query.join(models.User).filter(
            (models.User.first_name.like(search_filter)) |
            (models.User.last_name.like(search_filter)) |
            (models.User.national_id.like(search_filter))
        )
        
    subscriptions = query.options(joinedload(models.Subscription.user)).all()
    results = []
    for sub in subscriptions:
        # سوپاپ اطمینان برای جلوگیری از کرش در صورت حذف شدن فیزیکی یک کاربر
        if not sub.user:
            continue
            
        time_taken_seconds = 0
        if sub.time_left:
            if hasattr(sub.time_left, "hour"):
                time_taken_seconds = (sub.time_left.hour * 3600) + (sub.time_left.minute * 60) + sub.time_left.second
            else:
                try: time_taken_seconds = int(sub.time_left)
                except: time_taken_seconds = 0
                
        national_id = sub.user.national_id or "----"
        last_four = national_id[-4:] if len(national_id) >= 4 else national_id
        
        results.append({
            "user_id": sub.user_id,
            "name": f"{sub.user.first_name} {sub.user.last_name or ''}".strip() or "کاربر بدون نام",
            "score": sub.score if sub.score is not None else 0,
            "time": time_taken_seconds,
            "time_taken": time_taken_seconds,
            "last_four_id": last_four
        })
        
    results.sort(key=lambda x: (-x["score"], x["time_taken"]))
    for idx, item in enumerate(results):
        item["rank"] = idx + 1
        
    return results