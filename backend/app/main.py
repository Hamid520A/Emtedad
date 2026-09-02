# =====================================================================
# بخش اول فایل main.py: ایمپورت‌ها، کانفیگ‌ها و موتورهای گرافیکی پروژه
# =====================================================================
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.encoders import jsonable_encoder
from fastapi import FastAPI, Depends, HTTPException, status, UploadFile, File, Request, BackgroundTasks
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, text, desc, asc
from sqlalchemy.exc import IntegrityError
from typing import List, Optional, Dict, Any
from . import schemas, models, auth, database
import shutil, os, random, redis, json, io, requests, traceback, uuid, re, logging, contextvars, jdatetime
from app.services.sms_service import sms_service
from pydantic import BaseModel, Field, field_validator
from datetime import datetime, timedelta, date, time
from PIL import Image, ImageDraw, ImageFont
from fastapi.responses import JSONResponse, StreamingResponse
from jose import JWTError, jwt
from starlette.middleware.base import BaseHTTPMiddleware
from prometheus_fastapi_instrumentator import Instrumentator
from contextlib import asynccontextmanager
from uuid import UUID

@asynccontextmanager
async def lifespan(app: FastAPI):
    # این لاگر در خطوط پایین‌تر فایل ساخته می‌شود و هنگام استارت در دسترس است
    logger.info("Application is warming up...")
    yield
    logger.info("Initiating graceful shutdown...")
    try:
        r.close()
        logger.info("Closed RateLimiter Redis connection.")
    except Exception as e:
        logger.error(f"Error closing RateLimiter Redis: {e}")
        
    try:
        r_eitaa.close()
        logger.info("Closed Eitaa Session Redis connection.")
    except Exception as e:
        logger.error(f"Error closing Eitaa Session Redis: {e}")
        
    try:
        database.engine.dispose()
        logger.info("Disposed SQLAlchemy engine.")
    except Exception as e:
        logger.error(f"Error disposing SQLAlchemy engine: {e}")

app = FastAPI(lifespan=lifespan)
models.Base.metadata.create_all(bind=database.engine)

# 🌟 فعال‌سازی متریک‌های پرومتئوس به صورت مخفی و محدود شده به شبکه داخلی
Instrumentator().instrument(app).expose(app, include_in_schema=False)

# 🌟 میدلور امنیتی: محدود کردن دسترسی به /metrics فقط برای سرور پرومتئوس
@app.middleware("http")
async def restrict_metrics_endpoint(request: Request, call_next):
    if request.url.path == "/metrics":
        client_ip = request.client.host if request.client else ""
        allowed_ips_env = os.getenv("PROMETHEUS_ALLOWED_IPS", "127.0.0.1,localhost,::1,172.30.0.8,172.30.0.1")
        allowed_ips = [ip.strip() for ip in allowed_ips_env.split(",")]
        
        # در داکر معمولا آی‌پی کلاینت همان آی‌پی گیت‌وی داکر (مثلا 172.x.x.x) است
        if "*" not in allowed_ips and client_ip not in allowed_ips and not client_ip.startswith("172."):
            return JSONResponse(
                status_code=403, 
                content={"detail": "Access forbidden: Your IP is not allowed to view metrics."}
            )
    return await call_next(request)

# 🌟 متغیر کانتکست ایمن برای لاگین یکپارچه
request_id_context = contextvars.ContextVar("request_id", default="unknown")

class JSONLogFormatter(logging.Formatter):
    def format(self, record):
        log_record = {
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "level": record.levelname,
            "request_id": request_id_context.get(),
            "message": record.getMessage()
        }
        return json.dumps(log_record)

# 🌟 پیکربندی لاگر ساختاریافته JSON
logger = logging.getLogger("emtedad_backend")
logger.setLevel(logging.INFO)
for handler in logger.handlers:
    logger.removeHandler(handler)
log_handler = logging.StreamHandler()
log_handler.setFormatter(JSONLogFormatter())
logger.addHandler(log_handler)
# غیرفعال‌سازی لاگ‌های دیفالت uvicorn برای جلوگیری از اسپم متنی
logging.getLogger("uvicorn.access").disabled = True

# 🌟 میدلور تزریق Traceability (Request ID)
class RequestTracingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        req_id = request.headers.get("X-Correlation-ID") or str(uuid.uuid4())
        token = request_id_context.set(req_id)
        
        response = await call_next(request)
        response.headers["X-Request-ID"] = req_id
        
        request_id_context.reset(token)
        return response

app.add_middleware(RequestTracingMiddleware)

# ۱. اتصال به سرور دیتابیس Redis برای Rate Limiting
SECRET_KEY = os.getenv("SECRET_KEY", "fallback_temporary_secret_key_for_development")
DEBUG_MODE = os.getenv("DEBUG_MODE", "False").lower() in ("true", "1", "yes")

if SECRET_KEY == "fallback_temporary_secret_key_for_development" and not DEBUG_MODE:
    raise RuntimeError("FATAL SECURITY ERROR: Running in production with a fallback SECRET_KEY is strictly forbidden.")

ALGORITHM = os.getenv("ALGORITHM", "HS256")
RATELIMIT_REDIS_HOST = os.getenv("REDIS_HOST", "redis")
RATELIMIT_REDIS_PORT = int(os.getenv("REDIS_PORT", 6379))
RATELIMIT_REDIS_DB = int(os.getenv("REDIS_DB", 0))
r = redis.Redis(host=RATELIMIT_REDIS_HOST, port=RATELIMIT_REDIS_PORT, db=RATELIMIT_REDIS_DB, decode_responses=True, socket_timeout=5)

# ۲. اتصال اختصاصی به سرور Redis برای سشن‌های ایتا (پورت ۶۳۸۹ و آی‌پِی ۱۰.۱۰.۲۰.۵۱)
EITAA_REDIS_HOST = os.getenv("EITAA_REDIS_HOST", "redis")
EITAA_REDIS_PORT = int(os.getenv("EITAA_REDIS_PORT", 6389))
EITAA_REDIS_DB = int(os.getenv("EITAA_REDIS_DB", 0))
ACCOUNT_KEY = os.getenv("ACCOUNT_KEY", "latest_session:default")
r_eitaa = redis.Redis(host=EITAA_REDIS_HOST, port=EITAA_REDIS_PORT, db=EITAA_REDIS_DB, decode_responses=True, socket_timeout=5)

allowed_origins_env = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000")
ALLOWED_ORIGINS = [origin.strip() for origin in allowed_origins_env.split(",")]
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".pdf"}

if "*" in ALLOWED_ORIGINS:
    raise RuntimeError("FATAL SECURITY ERROR: CORS ALLOWED_ORIGINS cannot contain '*' when allow_credentials is True.")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def add_download_headers(request: Request, call_next):
    response = await call_next(request)
    path = request.url.path.lower()
    if path.startswith("/static/") and path.endswith((".pdf", ".doc", ".docx", ".zip", ".rar", ".mp4")):
        if request.query_params.get("download") == "true":
            filename = os.path.basename(request.url.path)
            response.headers["Content-Disposition"] = f'attachment; filename="{filename}"'
    return response

# ۲. هماهنگ‌سازی کلیدهای JWT با فایل auth
BACKEND_URL = os.getenv("BACKEND_URL", "http://127.0.0.1:8000")
EITAA_API_URL = os.getenv("EITAA_API_URL", "http://127.0.0.1:3000/send")
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

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception on {request.method} {request.url}: {exc}\n{traceback.format_exc()}")
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal Server Error. The incident has been logged."}
    )

@app.get("/health", tags=["System"])
def liveness_probe():
    return {"status": "alive"}

@app.get("/ready", tags=["System"])
def readiness_probe(db: Session = Depends(database.get_db)):
    health_status = {
        "status": "ok",
        "database": "ok",
        "redis_ratelimit": "ok",
        "redis_eitaa": "ok"
    }
    
    # Check Database
    try:
        db.execute(text("SELECT 1"))
    except Exception as e:
        logger.error(f"HealthCheck DB Error: {str(e)}")
        health_status["database"] = "error"
        health_status["status"] = "error"
        
    # Check Redis Ratelimit
    try:
        if not r.ping():
            raise Exception("Redis ping returned False")
    except Exception as e:
        logger.error(f"HealthCheck Redis Ratelimit Error: {str(e)}")
        health_status["redis_ratelimit"] = "error"
        health_status["status"] = "error"
        
    # Check Redis Eitaa
    try:
        if not r_eitaa.ping():
            raise Exception("Redis Eitaa ping returned False")
    except Exception as e:
        logger.error(f"HealthCheck Redis Eitaa Error: {str(e)}")
        health_status["redis_eitaa"] = "error"
        health_status["status"] = "error"
        
    if health_status["status"] == "error":
        raise HTTPException(status_code=503, detail=health_status)
        
    return health_status

async def get_current_user_optional(request: Request, db: Session = Depends(database.get_db)):
    """تابع کمکی برای احراز هویت اختیاری؛ اگر کاربر توکن فرستاده بود هویتش مشخص می‌شود، در غیر این صورت None برمی‌گرداند"""
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        return None
        
    token = auth_header.split(" ")[1]
    try:
        # رمزگشایی توکن با کلیدهای امنیتی موجود در همین فایل و بررسی سفت و سخت
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM], options={"verify_signature": True, "verify_exp": True})
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
    # Strip any sensitive PII explicitly
    safe_data = {k: v for k, v in data.items() if k not in ("password", "national_id", "hashed_password")}
    expire = datetime.utcnow() + expires_delta
    safe_data.update({"exp": expire})
    return jwt.encode(safe_data, SECRET_KEY, algorithm=ALGORITHM)

def safe_load_image(url_str):
    if not url_str:
        return None
    try:
        if url_str.startswith("/"):
            url_str = f"{BACKEND_URL}{url_str}"
            
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
        # استفاده از قابلیت داخلی Pillow برای RTL. اگر Pillow با Raqm کامپایل شده باشد این کار می‌کند
        bbox = draw.textbbox((0, 0), text, font=font, direction="rtl", language="fa")
        text_width = bbox[2] - bbox[0]
    except Exception as e:
        logger.warning(f"Error calculating text width: {e}")
        text_width = len(text) * 13
        
    actual_x = center_x - (text_width // 2)
    try:
        draw.text((actual_x, y), text, font=font, fill=fill, direction="rtl", language="fa")
    except Exception as e:
        logger.error(f"Draw text fallback: {e}")
        draw.text((actual_x, y), text, font=font, fill=fill)

def safe_draw_text(draw, position, text, font, fill, direction="rtl"):
    try:
        draw.text(position, text, font=font, fill=fill, direction=direction, language="fa")
    except Exception as e:
        try:
             draw.text(position, text, font=font, fill=fill)
        except Exception as e2:
            logger.error(f"Silent failure intercepted: {e2}")

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

    score_val = subscription.score or 0
    rank_text = "عمومی"
    
    if cert:
        if "عالی" in cert.title:
            rank_text = "عالی"
        elif "خیلی خوب" in cert.title:
            rank_text = "خیلی خوب"
        elif "خوب" in cert.title:
            rank_text = "خوب"
    user_full_name = f"{user.first_name or ''} {user.last_name or ''}".strip() or "شرکت‌کننده امتداد"
    
    # 🌟 اصلاح هوشمند فیلد تاریخ تولد برای حل باگ برعکس شدن لایوت گرافیکی
    # 🌟 ۱. تبدیل تاریخ تولد از میلادی به شمسی
    if user.birth_date:
        try:
            # تبدیل آبجکت میلادی دیتابیس به شمسی با کتابخانه jdatetime
            shamsi_bd = jdatetime.date.fromgregorian(date=user.birth_date)
            raw_date = shamsi_bd.strftime("%Y/%m/%d")
        except Exception:
            raw_date = str(user.birth_date)
        
        # استفاده از کاراکتر \u200e برای تثبیت جهت اعداد در متن فارسی
        birth_date_str = f"\u200e{to_persian_digits(raw_date)}\u200e"
    else:
        birth_date_str = "---"

    # دریافت متن قالب گواهی
    template = cert.content if cert else "بدین‌وسیله گواهی می‌شود {{name}} در مسابقه شرکت نموده است."
    
    # اعمال جایگزینی‌ها همراه با فارسی‌سازی کدملی
    full_text = template.replace("{{name}}", user_full_name)\
                        .replace("{{national_id}}", to_persian_digits(user.national_id or "---"))\
                        .replace("{{birth_date}}", birth_date_str)\
                        .replace("{{rank}}", rank_text)

    # 🌟 ۲. تولید شماره سریال و تاریخ صدور کاملاً شمسی برای گوشه بالا
    if hasattr(user.id, 'int'):
        user_serial_part = str(user.id.int)[-4:]
    else:
        user_serial_part = str(abs(hash(str(user.id))))[-4:]
        
    persian_serial = to_persian_digits(f"1405{contest.id:02d}{user_serial_part}")
    
    # دریافت تاریخ امروز به صورت شمسی
    persian_date = to_persian_digits(jdatetime.date.today().strftime("%Y/%m/%d"))
    
    txt_serial = f"شماره: {persian_serial}"
    txt_date = f"تاریخ: {persian_date}"
    
    try:
        w_s = draw.textbbox((0, 0), txt_serial, font=font_sub, direction="rtl")[2] - draw.textbbox((0, 0), txt_serial, font=font_sub, direction="rtl")[0]
        w_d = draw.textbbox((0, 0), txt_date, font=font_sub, direction="rtl")[2] - draw.textbbox((0, 0), txt_date, font=font_sub, direction="rtl")[0]
    except Exception as e:
        logger.warning(f"Error calculating text width: {e}")
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
        "Access-Control-Allow-Origin": ALLOWED_ORIGINS[0],
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

# =====================================================================
# کدهای مدیریت پیامک و OTP (ذخیره در کانکشن Redis اصلی پروژه)
# =====================================================================
class OTPRequest(BaseModel):
    phone_number: str

class OTPVerify(BaseModel):
    phone_number: str = Field(..., pattern=r"^09\d{9}$")
    code: str = Field(..., min_length=5, max_length=5, pattern=r"^\d{5}$")

    @field_validator("phone_number", "code", mode="before")
    @classmethod
    def convert_otp_digits(cls, value):
        if not value:
            return value
        trans_table = str.maketrans("۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩", "01234567890123456789")
        return str(value).translate(trans_table)

@app.post("/send-otp", tags=["Auth"])
def send_otp(payload: OTPRequest):
    mobile = fa_to_en_digits(payload.phone_number)
    
    # ۱. تولید کد ۵ رقمی کاملاً تصادفی
    otp_code = str(random.randint(10000, 99999))
    
    try:
        # ۲. ذخیره در ردیس با استفاده از کانکشن r موجود در خود main.py (انقضا: ۱۲۰ ثانیه)
        r.setex(f"otp:{mobile}", 120, otp_code)
    except Exception as e:
        logger.error(f"Redis OTP Error: {e}")
        raise HTTPException(status_code=500, detail="خطا در ارتباط با حافظه موقت (ردیس).")
        
    # ۳. ساخت متن و ارسال پیامک از طریق سرویس TSMS
    from app.services.sms_service import sms_service
    text = f"سامانه مسابقات امتداد امام\nکد تایید شما: {otp_code}\nاز در اختیار گذاشتن این کد به دیگران خودداری کنید."
    success = sms_service.send_sms(receiver_mobile=mobile, message_text=text)
    
    if success:
        return {"message": "کد تایید با موفقیت پیامک شد."}
    else:
        raise HTTPException(status_code=500, detail="خطا در ارسال پیامک. لطفا دقایقی دیگر تلاش کنید.")

@app.post("/verify-otp", tags=["Auth"])
def verify_otp(payload: OTPVerify):
    mobile = fa_to_en_digits(payload.phone_number)
    
    # واکشی کد ذخیره شده در ردیس
    stored_code = r.get(f"otp:{mobile}")
    if not stored_code:
        raise HTTPException(status_code=400, detail="کد تایید منقضی شده یا وجود ندارد. لطفا مجددا درخواست دهید.")
        
    if stored_code != fa_to_en_digits(payload.code):
        raise HTTPException(status_code=400, detail="کد تایید وارد شده اشتباه است.")
        
    # 🌟 در صورت موفقیت، کد را می‌سوزانیم تا دوباره استفاده نشود
    r.delete(f"otp:{mobile}")
    return {"message": "شماره موبایل تایید شد."}

class PasswordReset(BaseModel):
    phone_number: str
    otp_code: str = Field(..., min_length=5, max_length=5, pattern=r"^\d{5}$")
    new_password: str

    @field_validator("phone_number", "otp_code", mode="before")
    @classmethod
    def convert_reset_digits(cls, value):
        if not value:
            return value
        trans_table = str.maketrans("۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩", "01234567890123456789")
        return str(value).translate(trans_table)

@app.post("/reset-password", tags=["Auth"])
def reset_password_with_otp(payload: PasswordReset, db: Session = Depends(database.get_db)):
    mobile = fa_to_en_digits(payload.phone_number)
    
    # ۱. بررسی صحت کد تایید (OTP)
    stored_code = r.get(f"otp:{mobile}")
    if not stored_code or stored_code != fa_to_en_digits(payload.otp_code):
        raise HTTPException(status_code=400, detail="کد تایید اشتباه یا منقضی شده است.")
        
    # ۲. پیدا کردن کاربر در دیتابیس
    user = db.query(models.User).filter(models.User.phone_number == mobile).first()
    if not user:
        raise HTTPException(status_code=404, detail="کاربری با این شماره یافت نشد.")
        
    # ۳. اعتبارسنجی و تغییر رمز عبور
    if len(fa_to_en_digits(payload.new_password)) < 6:
        raise HTTPException(status_code=400, detail="رمز عبور باید حداقل ۶ کاراکتر باشد.")
        
    user.password = auth.get_password_hash(fa_to_en_digits(payload.new_password))
    db.commit()
    
    # ۴. سوزاندن کد تایید تا دیگر قابل استفاده نباشد
    r.delete(f"otp:{mobile}")
    
    return {"message": "رمز عبور با موفقیت تغییر کرد. اکنون میتوانید وارد شوید."}

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

    db_city = db.query(models.City).filter(models.City.id == user.city_id).first()
    if not db_city:
        raise HTTPException(status_code=400, detail="شهر انتخاب شده معتبر نیست.")
        
    # هش کردن رمز عبور و ساخت کاربر بر اساس فیلدهای جدید (حذف جنسیت و استان متنی)
    hashed_pwd = auth.get_password_hash(user.password)
    db_model_user = models.User(
        first_name=user.first_name,
        last_name=user.last_name,
        phone_number=user.phone_number,
        password=hashed_pwd,
        national_id=user.national_id,
        is_iranian=user.is_iranian,
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

@app.post("/swagger-login", tags=["System"], include_in_schema=False)
def login_for_swagger(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(database.get_db)):
    """این اندپوینت کاملاً مخفی است و فقط برای دکمه Authorize سواگر کار می‌کند"""
    # سواگر شماره تلفن را به صورت خودکار درون فیلد username قرار می‌دهد
    user = db.query(models.User).filter(models.User.phone_number == form_data.username).first()
    
    if not user or not auth.verify_password(form_data.password, user.password):
        raise HTTPException(status_code=400, detail="شماره موبایل یا رمز عبور اشتباه است")
        
    # صدور توکن با تشخیص اتوماتیک ادمین بودن
    token = auth.create_access_token(data={
        "sub": user.phone_number, 
        "is_admin": True if (user.admin and user.admin.is_active == 1) else False
    })
    
    return {"access_token": token, "token_type": "bearer"}

@app.get("/contests", response_model=List[schemas.ContestListItem])
def get_all_contests(status: Optional[str] = None, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    """دریافت لیست مسابقات - فیلتر کامل و قطعی مسابقات حذف شده (Soft Deleted)"""
    now = datetime.now()
    
    # 🌟 فیکس: آپدیت بالک وضعیت مسابقات در سطح دیتابیس (جلوگیری از OOM)
    # ۱. فعال‌سازی خودکار مسابقاتی که زمان شروع آن‌ها رسیده
    db.query(models.Contest).filter(
        models.Contest.status == 'upcoming',
        models.Contest.start_time != None,
        models.Contest.start_time <= now
    ).update({"status": "active"}, synchronize_session=False)

    # 🌟 ۲. پایان خودکار مسابقاتی که زمان اتمام آن‌ها فرا رسیده است
    db.query(models.Contest).filter(
        models.Contest.status == 'active',
        models.Contest.end_time != None,
        models.Contest.end_time <= now
    ).update({"status": "finished"}, synchronize_session=False)

    db.commit()

    # فیکس: واکشی امن و برگرداندن دیتای نهایی فیلتر شده (با سیستم کش ردیس)
    cache_key = f"cache:contests:all:{status or 'all'}"
    cached_data = r.get(cache_key)
    if cached_data:
        try:
            return json.loads(cached_data)
        except Exception as e:
            logger.error(f"Silent failure intercepted: {e}")
            
    query = db.query(models.Contest).filter(models.Contest.deleted_at == None)
    if status:
        query = query.filter(models.Contest.status == status)
        
    results = query.all()
    
    # ذخیره در کش ردیس (مدت زمان ۳۰ ثانیه)
    try:
        from fastapi.encoders import jsonable_encoder
        r.setex(cache_key, 30, json.dumps(jsonable_encoder(results)))
    except Exception as e:
        print(f"Cache save error: {e}")
        
    return results

@app.get("/contests/{contest_id}")
def get_contest_detail(
    contest_id: int, 
    db: Session = Depends(database.get_db), 
    current_user: Optional[models.User] = Depends(get_current_user_optional)
):
    cors_headers = {
        "Access-Control-Allow-Origin": ALLOWED_ORIGINS[0],
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
        "poster_url": contest.poster_url,
        "video_url": contest.video_url,
        "audio_url": contest.audio_url,
        "status": contest.status,
        "start_time": contest.start_time.isoformat() if contest.start_time else None,
        "end_time": contest.end_time.isoformat() if contest.end_time else None,
        "server_now": datetime.now().isoformat(),
        "question_limit": contest.question_limit,
        "time_limit": time_limit_minutes,
        "file_url": file_url,
        "awards": awards_data,
        "certificate_type": certificate_type,
        "certificate_details": cert_payload,
        "success_message": contest.success_message,
        "failure_message": contest.failure_message,
        "sms_message": contest.sms_message,
    })

@app.get("/contests/{contest_id}/questions", response_model=List[schemas.RandomizedQuestion])
def get_questions_list(
    contest_id: int, 
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    contest = db.query(models.Contest).filter(models.Contest.id == contest_id).first()
    if not contest:
        raise HTTPException(status_code=404, detail="مسابقه یافت نشد")
        
    # ۱. گارد امنیتی: بررسی شرکت قبلی کاربر (استثنا برای ادمین‌ها جهت تست مکرر)
    existing_subscription = db.query(models.Subscription).filter(
        models.Subscription.user_id == current_user.id,
        models.Subscription.contest_id == contest_id
    ).first()

    is_admin_user = getattr(current_user, 'is_admin', False) or getattr(current_user, 'role', '') == 'admin'

    if existing_subscription and not is_admin_user:
        raise HTTPException(
            status_code=403, 
            detail="شما قبلاً در این آزمون شرکت کرده‌اید و مجاز به ورود مجدد نیستید!"
        )

    # 🌟 قفل امنیتی آنی: ثبت رکورد شروع اولیه در دیتابیس تا در صورت بسته شدن مینی‌اپ (کلیک روی ضربدر) یا خروج، امکان شرکت مجدد وجود نداشته باشد
    if not existing_subscription and not is_admin_user:
        initial_sub = models.Subscription(
            user_id=current_user.id,
            contest_id=contest_id,
            score=0,
            is_left=1
        )
        db.add(initial_sub)
        db.commit()
        db.refresh(initial_sub)
        
    # ۲. واکشی سوالات حذف‌نشده و فعال
    all_questions = db.query(models.Question).filter(
        models.Question.contest_id == contest_id, 
        models.Question.is_active == 1,
        models.Question.deleted_at == None
    ).all()
    
    # انتخاب تصادفی سوالات بر اساس حد مجاز مسابقه
    limit = contest.question_limit or 15
    selected_questions = random.sample(all_questions, min(len(all_questions), limit))
    processed_questions = []
    
    for q in selected_questions:
        # 🌟 شاه‌کلید امنیت: پاکسازی و خالص‌سازی گزینه‌ها
        # فقط ID و Title استخراج می‌شوند و فیلد is_correct به هیچ‌عنوان پاس داده نمی‌شود.
        options = [
            {"id": ans.id, "title": ans.title} 
            for ans in q.answers 
            if ans.deleted_at is None
        ]
        
        # برهم زدن چیدمان گزینه‌ها برای هر کاربر
        random.shuffle(options)
        
        processed_questions.append({
            "id": q.id,
            "title": q.title,
            "description": q.description,
            "shuffled_options": options
        })
        
    return processed_questions

@app.post("/contests", response_model=schemas.Contest)
def create_new_contest(contest: schemas.ContestCreate, db: Session = Depends(database.get_db), current_admin: models.User = Depends(require_admin)):
    minutes = contest.time_limit or 10
    max_time_obj = time(hour=minutes // 60, minute=minutes % 60)

    db_contest = models.Contest(
        title=contest.title,
        description=contest.description,
        image_url=contest.image_url,
        poster_url=contest.poster_url,
        video_url=contest.video_url,
        audio_url=contest.audio_url,
        max_time=max_time_obj,
        start_time=contest.start_time,
        end_time=contest.end_time,
        status=contest.status,
        question_limit=contest.question_limit,
        success_message=contest.success_message,
        failure_message=contest.failure_message,
        sms_message=contest.sms_message,
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
    db: Session = Depends(database.get_db),
    current_admin: models.User = Depends(require_admin)
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
async def upload_file(
    file: UploadFile = File(...),
    current_admin: models.User = Depends(require_admin)
):
    import uuid # 🌟 ایمپورت محلی برای رفع تداخل با کلاس UUID دیتابیس
    import shutil, os, re
    
    try:
        # ۱. بررسی نوع فایل (MIME Type + پسوند)
        allowed_mimes = {
            "image/jpeg", "image/png", "image/webp", "application/pdf", "image/svg+xml",
            "audio/mpeg", "audio/wav", "audio/ogg", "audio/mp4",
            "audio/x-wav", "audio/wave", "audio/x-m4a", "audio/aac",
        }
        allowed_extensions = {
            ".jpg", ".jpeg", ".png", ".webp", ".svg", ".pdf",
            ".mp3", ".wav", ".ogg", ".m4a", ".aac",
        }
        mime_to_ext = {
            "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp",
            "image/svg+xml": ".svg", "application/pdf": ".pdf",
            "audio/mpeg": ".mp3", "audio/wav": ".wav", "audio/x-wav": ".wav",
            "audio/wave": ".wav", "audio/ogg": ".ogg", "audio/mp4": ".m4a",
            "audio/x-m4a": ".m4a", "audio/aac": ".aac",
        }

        # ۲. بررسی حجم فایل (فیکس شده برای نسخه‌های جدید FastAPI)
        file_size = getattr(file, "size", 0)
        if file_size == 0:
            file.file.seek(0, 2)
            file_size = file.file.tell()
            file.file.seek(0)
        
        if file_size > 30 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="حجم فایل نباید بیشتر از 30 مگابایت باشد.")

        # ۳. ایمن‌سازی نام فایل و استخراج فرمت
        original_filename = file.filename or "unknown.jpg"
        safe_filename = re.sub(r'[^a-zA-Z0-9.\-]', '', os.path.basename(original_filename))
        file_ext = os.path.splitext(safe_filename)[1].lower()
        content_type = (file.content_type or "").lower()

        mime_ok = content_type in allowed_mimes
        ext_ok = file_ext in allowed_extensions
        if not mime_ok and not ext_ok:
            raise HTTPException(status_code=400, detail="فرمت فایل غیرمجاز است.")

        # سوپاپ اطمینان برای اسم‌های کاملاً فارسی که فرمتشان پاک می‌شود
        if file_ext not in allowed_extensions:
            file_ext = mime_to_ext.get(content_type)
            if not file_ext:
                if "image" in content_type:
                    file_ext = ".jpg"
                elif "audio" in content_type:
                    file_ext = ".mp3"
                elif "pdf" in content_type:
                    file_ext = ".pdf"
                else:
                    raise HTTPException(status_code=400, detail="پسوند فایل قابل تشخیص نیست.")

        # ۴. ساخت نام یکتا و مسیر فایل
        unique_filename = f"{uuid.uuid4().hex}{file_ext}"
        UPLOAD_DIR = "static/uploads"
        if not os.path.exists(UPLOAD_DIR):
            os.makedirs(UPLOAD_DIR)
        file_path = os.path.join(UPLOAD_DIR, unique_filename)

        # ۵. ذخیره روی هارد سرور
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        BACKEND_URL = os.getenv("BACKEND_URL", "http://127.0.0.1:8000")
        return {"url": f"{BACKEND_URL}/static/uploads/{unique_filename}"}
        
    except HTTPException:
        raise
    except Exception as e:
        # 🌟 چاپ دقیق خطا در کنسولِ سرور به جای ارور گنگ ۵۰۰
        print(f"❌ Upload Error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"خطا در پردازش فایل: {str(e)}")

@app.get("/contests/{contest_id}/leaderboard")
def get_leaderboard(contest_id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    cors_headers = {
        "Access-Control-Allow-Origin": ALLOWED_ORIGINS[0],
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
    }
    
    # 🌟 سیستم کش پرسرعت ردیس برای لیدربورد (۶۰ ثانیه)
    cache_key = f"cache:leaderboard:{contest_id}"
    cached_data = r.get(cache_key)
    if cached_data:
        try:
            return JSONResponse(status_code=200, content=json.loads(cached_data), headers=cors_headers)
        except Exception as e:
            logger.error(f"Silent failure intercepted: {e}")
            
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
                "user_id": str(sub.user_id),
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
        # ذخیره در کش ردیس برای ۶۰ ثانیه
        try:
            r.setex(cache_key, 60, json.dumps(jsonable_encoder(results)))
        except Exception as e:
            logger.error(f"Silent failure intercepted: {e}")

        return JSONResponse(status_code=200, content=jsonable_encoder(results), headers=cors_headers)

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
    payload: schemas.UserProfileUpdate,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    user = db.query(models.User).filter(models.User.id == current_user.id).first()
    if not user:
        raise HTTPException(status_code=404, detail="کاربر یافت نشد")

    user.first_name = payload.first_name
    user.last_name = payload.last_name

    normalized_date = fa_to_en_digits(payload.birth_date).replace("-", "/")
    user.birth_date = jdatetime.datetime.strptime(normalized_date, '%Y/%m/%d').togregorian().date()

    db_city = db.query(models.City).filter(models.City.title == payload.city).first()
    if not db_city:
        raise HTTPException(status_code=400, detail="شهر انتخاب شده معتبر نیست.")
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
        "is_iranian": getattr(user_data, 'is_iranian', True),
        "birth_date": jdatetime.date.fromgregorian(date=user_data.birth_date).strftime('%Y/%m/%d') if user_data.birth_date else "---",
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
        "Access-Control-Allow-Origin": ALLOWED_ORIGINS[0],
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
    })

@app.get("/users/me/contests/{contest_id}/certificate/download")
def download_my_certificate(
    contest_id: int, 
    request: Request, # 🌟 تغییر اصلی: به جای current_user از ریکوئست خام استفاده می‌کنیم
    db: Session = Depends(database.get_db)
):
    cors_headers = {
        "Access-Control-Allow-Origin": ALLOWED_ORIGINS[0],
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
    }

    # 🌟 شاه‌کلید فیکس مینی‌اپ: استخراج توکن از آدرس URL (اگر در هدر نبود)
    token = request.query_params.get("token")
    if not token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]
            
    if not token:
        return JSONResponse(status_code=401, content={"detail": "شما وارد نشده‌اید (توکن یافت نشد)"}, headers=cors_headers)
        
    try:
        # پردازش و رمزگشایی توکن به صورت دستی
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM], options={"verify_signature": True, "verify_exp": True})
        phone_number = payload.get("sub")
        current_user = db.query(models.User).filter(models.User.phone_number == phone_number).first()
        if not current_user:
            return JSONResponse(status_code=401, content={"detail": "کاربر معتبر نیست"}, headers=cors_headers)
    except JWTError:
        return JSONResponse(status_code=401, content={"detail": "توکن منقضی یا نامعتبر است"}, headers=cors_headers)

    # ==========================================
    # ادامه منطق استاندارد صدور گواهی
    # ==========================================
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
    
    # واکشی فقط سوالاتی که واقعاً به این کاربر تخصیص داده شده‌اند
    assigned_rows = db.query(models.SubscriptionQuestions).filter(
        models.SubscriptionQuestions.subscription_id == sub.id,
        models.SubscriptionQuestions.deleted_at == None
    ).order_by(models.SubscriptionQuestions.id.asc()).all()

    assigned_question_ids = [row.question_id for row in assigned_rows]

    dynamic_answers_map = {}
    for sq in assigned_rows:
        chosen_ans = db.query(models.SubscriptionAnswer).filter(
            models.SubscriptionAnswer.subscription_question_id == sq.id
        ).filter(
            (models.SubscriptionAnswer.is_chosen == 1) | (models.SubscriptionAnswer.is_chosen == None)
        ).first()
        if chosen_ans:
            dynamic_answers_map[str(sq.question_id)] = chosen_ans.answer_id
    
    questions_data = []
    if assigned_question_ids:
        questions = db.query(models.Question).filter(
            models.Question.id.in_(assigned_question_ids),
            models.Question.contest_id == contest_id,
            models.Question.is_active == 1,
            models.Question.deleted_at == None
        ).all()
        questions_by_id = {q.id: q for q in questions}

        for assigned_row in assigned_rows:
            q = questions_by_id.get(assigned_row.question_id)
            if not q:
                continue

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

            user_selected_ans_id = dynamic_answers_map.get(str(q.id)) or dynamic_answers_map.get(q.id)

            questions_data.append({
                "id": q.id,
                "title": q.title,
                "description": q.description,
                "shuffled_options": options_list,
                "correct_option": correct_option_id,
                "user_option": user_selected_ans_id,
                "selected_option": user_selected_ans_id
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
        # ۱. محاسبه نمره سرور-ساید (جلوگیری از Spoofing)
        questions = db.query(models.Question).filter(
            models.Question.contest_id == subscription.contest_id,
            models.Question.deleted_at == None
        ).all()
        
        correct_answers = {}
        for q in questions:
            for a in q.answers:
                if a.is_correct == 1 and a.deleted_at is None:
                    correct_answers[str(q.id)] = str(a.id)
                    break
                    
        total_questions = len(questions)
        correct_count = 0
        answers_map = getattr(subscription, "answers_map", None)
        
        if answers_map and isinstance(answers_map, dict):
            for q_id, a_id in answers_map.items():
                if str(q_id) in correct_answers and str(a_id) == correct_answers[str(q_id)]:
                    correct_count += 1
                    
        calculated_score = int((correct_count / total_questions) * 100) if total_questions > 0 else 0

        # ۲. ایجاد رکورد اصلی شرکت در مسابقه
        db_subscription = models.Subscription(
            user_id=current_user.id,
            contest_id=subscription.contest_id,
            score=calculated_score,
            started_at=datetime.utcnow()
        )
        db.add(db_subscription)
        db.flush() # تولید ID بدون کامیت برای استفاده در رکورد فرزند
        
        # ۳. ذخیره جواب‌ها به صورت اتمیک
        if answers_map and isinstance(answers_map, dict):
            for q_id, a_id in answers_map.items():
                db_sub_q = models.SubscriptionQuestions(
                    subscription_id=db_subscription.id,
                    question_id=int(q_id)
                )
                db.add(db_sub_q)
                db.flush()

                db_sub_a = models.SubscriptionAnswer(
                    subscription_question_id=db_sub_q.id,
                    answer_id=int(a_id),
                    is_chosen=1
                )
                db.add(db_sub_a)
                
        # یک کامیت نهایی و اتمیک (جلوگیری از تراکنش‌های تکه‌تکه)
        db.commit()
        db.refresh(db_subscription)

        return {"status": "success", "id": db_subscription.id}
        
    except IntegrityError:
        # ۴. جلوگیری از Race Condition با کچ ارور UniqueConstraint
        db.rollback()
        raise HTTPException(status_code=400, detail="شما قبلاً در این آزمون شرکت کرده‌اید و نمره شما ثبت شده است!")
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        print(f"Error saving subscription: {e}")
        raise HTTPException(status_code=500, detail="خطا در ذخیره نمره در دیتابیس")
 

@app.patch("/contests/{contest_id}/status")
def update_contest_status(contest_id: str, status_update: StatusUpdate, db: Session = Depends(database.get_db), current_admin: models.User = Depends(require_admin)):
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

@app.get("/admin/contests", response_model=List[schemas.ContestListItem])
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
    except Exception as e:
        logger.warning(f"Error generating chart data: {e}")
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
    current_user: models.User = Depends(auth.get_current_user)
):
    # 🌟 استفاده مستقیم از متغیر محیطی (فال‌بک به نام کانتینر در داکر شبکه داخلی)
    eitaa_target_url = "http://10.10.20.51:3000/send"

    try:
        session_json_str = r_eitaa.get(ACCOUNT_KEY)
        if not session_json_str:
            return {"status": "error", "message": f"500: کلید سشن {ACCOUNT_KEY} در ردیس یافت نشد."}
        
        session_data = json.loads(session_json_str)
        token = session_data.get("token")
        imei = session_data.get("imei")

        if not token or not imei:
            return {"status": "error", "message": "500: مقادیر token یا imei در ردیس مفقود هستند."}
        
        request_data["token"] = token
        request_data["imei"] = imei

        # 🌟 افزایش شدید تایم‌اوت برای جلوگیری از ارور ۵۰۲ در دریافت عکس
        dynamic_timeout = (5.0, 30.0) if request_data.get("method") == "upload.getFile" else (5.0, 10.0)
        
        # اضافه کردن هدر Connection: close برای جلوگیری از پر شدن استخر کانکشن‌های وب‌سرور
        headers = {"Connection": "close"}
        response = requests.post(eitaa_target_url, json=request_data, timeout=dynamic_timeout, headers=headers)
        
        # اگر ایتا ارور ۵۰۲ یا ۵۰۴ داد، آن را به درستی به فرانت بفرست
        if response.status_code >= 500:
            logger.error(f"Eitaa API returned status {response.status_code}: {response.text}")
            raise HTTPException(status_code=502, detail="سرور ایتا در حال حاضر پاسخگو نیست.")
            
        response_data = response.json()

        # کش کردن دیتای هویت‌سنجی ایتا در دیتابیس پروژه
        if request_data.get("method") == "contacts.importContacts" and response.status_code == 200:
            eitaa_users = response_data.get("users", [])
            
            if eitaa_users and len(eitaa_users) > 0:
                eitaa_user = eitaa_users[0]
                
                fetched_eitaa_id = int(eitaa_user.get("id"))
                fetched_access_hash = int(eitaa_user.get("access_hash"))
                
                is_unique = db.query(models.User).filter(
                    models.User.eitaa_user_id == fetched_eitaa_id,
                    models.User.id != current_user.id 
                ).first()
                
                if not is_unique:
                    if current_user.eitaa_user_id != fetched_eitaa_id:
                        current_user.eitaa_user_id = fetched_eitaa_id
                        current_user.eitaa_access_hash = fetched_access_hash
                        db.commit()
                        print(f"✅ اطلاعات ایتا برای کاربر {current_user.id} کش شد.")
                else:
                    print(f"⚠️ خطای یکتایی: آیدی ایتای {fetched_eitaa_id} تصاحب شده است.")

        return response_data
            
    except (requests.exceptions.ConnectionError, requests.exceptions.Timeout) as e:
        logger.error(f"Eitaa Upstream Failed: {str(e)}")
        raise HTTPException(status_code=502, detail="ارتباط با سرور واسط ایتا برقرار نشد (تایم‌اوت یا قطعی شبکه).")
    except json.JSONDecodeError as e:
        logger.error(f"Eitaa Upstream Failed: JSONDecodeError - {str(e)}")
        raise HTTPException(status_code=500, detail="ساختار متنی ایتا معتبر نیست.")
    except Exception as e:
        logger.error(f"Eitaa Proxy General Error: {str(e)}")
        raise HTTPException(status_code=500, detail="خطای نامشخص در برقراری ارتباط با سرور آپ‌استریم.")

@app.get("/admin/users", response_model=List[Dict[str, Any]])
@app.get("/admin/users-list", response_model=List[Dict[str, Any]])
def get_admin_users_list(
    search: Optional[str] = None,
    contest_id: Optional[int] = None,
    participation_status: Optional[str] = None,
    sort_by: Optional[str] = None,
    db: Session = Depends(database.get_db),
    current_admin: models.User = Depends(require_admin),
):
    """واکشی بهینه‌شده و فوق‌سریع لیست کاربران برای پنل ادمین بدون مشکل N+1 Query"""

    active_sub = models.Subscription.deleted_at.is_(None)

    query = (
        db.query(models.User)
        .options(
            joinedload(models.User.city).joinedload(models.City.parent),
            joinedload(models.User.admin),
        )
        .filter(models.User.deleted_at.is_(None))
    )

    if search and search.strip():
        term = f"%{fa_to_en_digits(search.strip())}%"
        query = query.filter(
            (models.User.first_name.ilike(term))
            | (models.User.last_name.ilike(term))
            | (models.User.phone_number.ilike(term))
            | (models.User.national_id.ilike(term))
        )

    if participation_status == "not_participated":
        participated_user_ids = (
            db.query(models.Subscription.user_id)
            .filter(active_sub)
            .distinct()
        )
        query = query.filter(~models.User.id.in_(participated_user_ids))

    if contest_id is not None:
        contest_user_ids = (
            db.query(models.Subscription.user_id)
            .filter(active_sub, models.Subscription.contest_id == contest_id)
            .distinct()
        )
        query = query.filter(models.User.id.in_(contest_user_ids))

    if sort_by == "recent_registration":
        query = query.order_by(models.User.created_at.desc())
    elif sort_by == "recent_participation":
        participation_sq = (
            db.query(
                models.Subscription.user_id.label("user_id"),
                func.max(models.Subscription.created_at).label("last_participation"),
            )
            .filter(active_sub)
        )
        if contest_id is not None:
            participation_sq = participation_sq.filter(
                models.Subscription.contest_id == contest_id
            )
        participation_sq = participation_sq.group_by(models.Subscription.user_id).subquery()
        query = query.outerjoin(
            participation_sq, models.User.id == participation_sq.c.user_id
        ).order_by(
            desc(participation_sq.c.last_participation).nullslast(),
            models.User.created_at.desc(),
        )
    elif sort_by in ("highest_score", "lowest_score"):
        if contest_id is not None:
            query = query.join(
                models.Subscription,
                (models.User.id == models.Subscription.user_id)
                & (models.Subscription.contest_id == contest_id)
                & active_sub,
            )
            score_col = models.Subscription.score
        else:
            agg_fn = func.max if sort_by == "highest_score" else func.min
            score_sq = (
                db.query(
                    models.Subscription.user_id.label("user_id"),
                    agg_fn(models.Subscription.score).label("sort_score"),
                )
                .filter(active_sub)
                .group_by(models.Subscription.user_id)
                .subquery()
            )
            query = query.outerjoin(score_sq, models.User.id == score_sq.c.user_id)
            score_col = score_sq.c.sort_score

        if sort_by == "highest_score":
            if contest_id is not None:
                query = query.order_by(
                    desc(score_col).nullslast(),
                    models.Subscription.time_left.asc().nullslast(),
                )
            else:
                query = query.order_by(desc(score_col).nullslast(), models.User.created_at.desc())
        else:
            query = query.order_by(asc(score_col).nullslast(), models.User.created_at.desc())
    elif sort_by == "youngest":
        query = query.order_by(
            models.User.birth_date.desc().nullslast(),
            models.User.created_at.desc(),
        )
    elif sort_by == "oldest":
        query = query.order_by(
            models.User.birth_date.asc().nullslast(),
            models.User.created_at.desc(),
        )
    else:
        query = query.order_by(models.User.created_at.desc())

    users = query.all()
    if not users:
        return []

    user_ids = [u.id for u in users]

    avg_rows = (
        db.query(
            models.Subscription.user_id,
            func.avg(models.Subscription.score).label("avg_score"),
        )
        .filter(models.Subscription.user_id.in_(user_ids), active_sub)
        .group_by(models.Subscription.user_id)
        .all()
    )
    avg_map = {row.user_id: row.avg_score for row in avg_rows}

    all_subs = (
        db.query(models.Subscription)
        .join(models.Contest, models.Subscription.contest_id == models.Contest.id)
        .filter(
            models.Subscription.user_id.in_(user_ids),
            active_sub,
            models.Contest.deleted_at.is_(None),
        )
        .options(joinedload(models.Subscription.contest))
        .order_by(models.Subscription.created_at.asc())
        .all()
    )
    subs_by_user: Dict[Any, List[models.Subscription]] = {}
    for sub in all_subs:
        subs_by_user.setdefault(sub.user_id, []).append(sub)

    results = []
    for u in users:
        user_subs = subs_by_user.get(u.id, [])
        avg_score = avg_map.get(u.id)
        average_score = f"{round(float(avg_score), 1)}%" if avg_score is not None else "---"
        participated_contests = [sub.contest.title for sub in user_subs if sub.contest]
        last_sub = user_subs[-1] if user_subs else None

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
            "gender": u.gender or "---",
            "last_contest": last_sub.contest.title if last_sub and last_sub.contest else "شرکت نکرده",
            "all_contests": participated_contests,
            "average_score": average_score,
            "is_admin": True if u.admin else False
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
def get_user_detail(user_id: UUID, db: Session = Depends(database.get_db), current_admin: models.User = Depends(require_admin)):
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
        "is_admin": True if user.admin else False,
        "birth_date": jdatetime.date.fromgregorian(date=user.birth_date).strftime('%Y/%m/%d') if user.birth_date else "",
        "history": history_records
    }

@app.put("/admin/users/{user_id}/update")
def update_admin_user_profile(
    user_id: UUID, 
    payload: dict, 
    db: Session = Depends(database.get_db), 
    current_admin: models.User = Depends(require_admin)
):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="کاربر یافت نشد")
        
    user.first_name = payload.get("first_name", user.first_name)
    user.last_name = payload.get("last_name", user.last_name)
    user.phone_number = payload.get("phone", payload.get("phone_number", user.phone_number))
    user.national_id = payload.get("national_id", user.national_id)
    
    if "gender" in payload:
        user.gender = payload.get("gender")
    
    if "city_id" in payload:
        user.city_id = payload.get("city_id")
        
    if "birth_date" in payload and payload.get("birth_date"):
        try:
            normalized_date = fa_to_en_digits(payload.get("birth_date"))
            user.birth_date = jdatetime.datetime.strptime(normalized_date, '%Y/%m/%d').togregorian().date()
        except Exception as e:
            print(f"⚠️ خطای تبدیل تاریخ تولد در پنل ادمین: {e}")
            
    # 🌟 مدیریت هوشمند جدول admins بر اساس مقدار کلید is_admin ارسالی از فرانت‌ند
    if "is_admin" in payload:
        is_admin_requested = payload.get("is_admin")
        
        # چک کردن وضعیت فعلی کاربر در جدول ادمین‌ها
        existing_admin = db.query(models.Admin).filter(models.Admin.user_id == user_id).first()
        
        if is_admin_requested and not existing_admin:
            # اگر فرانت‌ند گفته ادمین شود ولی ردیف ندارد -> ردیف جدید بساز
            new_admin = models.Admin(user_id=user_id, is_active=1)
            db.add(new_admin)
        elif not is_admin_requested and existing_admin:
            # اگر فرانت‌ند گفته کاربر عادی شود ولی ردیف دارد -> ردیف را پاک کن
            db.delete(existing_admin)
    
    db.commit()
    return {"status": "success", "message": "اطلاعات کاربر با موفقیت ویرایش شد"}

@app.get("/admin/users/{user_id}/contests/{contest_id}/answers")
def get_admin_user_answers(
    user_id: UUID,
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
        
    # ۲. واکشی فقط سوالاتی که واقعاً به این کاربر تخصیص داده شده‌اند
    assigned_rows = db.query(models.SubscriptionQuestions).filter(
        models.SubscriptionQuestions.subscription_id == subscription.id,
        models.SubscriptionQuestions.deleted_at == None
    ).order_by(models.SubscriptionQuestions.id.asc()).all()

    assigned_question_ids = [row.question_id for row in assigned_rows]

    if not assigned_question_ids:
        return []

    questions = db.query(models.Question).filter(
        models.Question.id.in_(assigned_question_ids),
        models.Question.contest_id == contest_id,
        models.Question.is_active == 1,
        models.Question.deleted_at == None
    ).all()

    questions_by_id = {q.id: q for q in questions}
    
    results = []
    for idx, assigned_row in enumerate(assigned_rows):
        q = questions_by_id.get(assigned_row.question_id)
        if not q:
            continue

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
        
        # سطر سوال از همان لیست تخصیص‌یافته
        sub_question = assigned_row
        
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
def update_certificate_template(contest_id: int, data: dict, db: Session = Depends(database.get_db), current_admin: models.User = Depends(require_admin)):
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
                "ملیت": "ایرانی" if getattr(u, 'is_iranian', True) else "اتباع غیرایرانی",
                "کد ملی / شناسه اتباع": u.national_id or "---",
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
    user_id: UUID,
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
        status=banner_data.status or "active"
    )
    db.add(db_banner)
    db.commit()
    db.refresh(db_banner)
    return {"message": "بنر با موفقیت ذخیره شد", "banner_id": db_banner.id}

@app.get("/admin/banners")
def get_all_banners_admin(db: Session = Depends(database.get_db), current_admin: models.User = Depends(require_admin)):
    return db.query(models.Banner).order_by(models.Banner.id.desc()).all()

@app.delete("/admin/banners/{banner_id}")
def delete_banner_admin(banner_id: int, db: Session = Depends(database.get_db), current_admin: models.User = Depends(require_admin)):
    db_banner = db.query(models.Banner).filter(models.Banner.id == banner_id).first()
    if not db_banner:
        raise HTTPException(status_code=404, detail="بنر یافت نشد")
    db.delete(db_banner)
    db.commit()
    return {"message": "بنر با موفقیت حذف شد"}

@app.patch("/admin/banners/{banner_id}/toggle")
def toggle_banner_admin(banner_id: int, db: Session = Depends(database.get_db), current_admin: models.User = Depends(require_admin)):
    db_banner = db.query(models.Banner).filter(models.Banner.id == banner_id).first()
    if not db_banner:
        raise HTTPException(status_code=404, detail="بنر یافت نشد")
    db_banner.status = "inactive" if db_banner.status == "active" else "active"
    db.commit()
    db.refresh(db_banner)
    return {"message": "وضعیت بنر به روزرسانی شد", "status": db_banner.status}

@app.get("/banners")
def get_active_banners(db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
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
        elif key in ["title", "description", "image_url", "poster_url", "video_url", "audio_url", "question_limit", "is_active", "success_message", "failure_message", "sms_message"]:
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
        "Access-Control-Allow-Origin": ALLOWED_ORIGINS[0],
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
    }
    
    contest = db.query(models.Contest).filter(models.Contest.id == contest_id).first()
    if not contest:
        return JSONResponse(status_code=404, content={"detail": "مسابقه یافت نشد"}, headers=cors_headers)
        
    subscriptions = db.query(models.Subscription).options(
        joinedload(models.Subscription.user).joinedload(models.User.city).joinedload(models.City.parent)
    ).filter(
        models.Subscription.contest_id == contest_id,
        models.Subscription.deleted_at == None
    ).all()
    
    total_participants = len(subscriptions)
    
    # متغیرهای تجمیع داده‌ها
    time_dist = {
        "زیر ۱ دقیقه": 0, "۱ تا ۳ دقیقه": 0,
        "۳ تا ۵ دقیقه": 0, "بالای ۵ دقیقه": 0
    }
    province_map = {}
    
    # 🌟 متغیر جدید برای شمارش جنسیت
    gender_map = {"مرد": 0, "زن": 0, "نامشخص": 0}

    for sub in subscriptions:
        # --- منطق توزیع زمانی ---
        time_taken = 0
        if sub.time_left:
            try:
                if hasattr(sub.time_left, "hour"):
                    time_taken = (sub.time_left.hour * 3600) + (sub.time_left.minute * 60) + sub.time_left.second
                else:
                    time_taken = int(sub.time_left)
            except Exception as e:
                logger.warning(f"Error calculating time taken: {e}")
                time_taken = 0
            
        if time_taken < 60: time_dist["زیر ۱ دقیقه"] += 1
        elif time_taken < 180: time_dist["۱ تا ۳ دقیقه"] += 1
        elif time_taken < 300: time_dist["۳ تا ۵ دقیقه"] += 1
        else: time_dist["بالای ۵ دقیقه"] += 1

        # --- منطق توزیع جغرافیایی و جنسیت ---
        u = sub.user
        if u:
            # پراکندگی استان
            prov_name = "نامشخص"
            city_name = "نامشخص"
            
            if u.city:
                if u.city.parent:
                    prov_name = u.city.parent.title
                    city_name = u.city.title
                else:
                    prov_name = u.city.title
                    city_name = "مرکز استان"
                    
            if prov_name not in province_map:
                province_map[prov_name] = {"count": 0, "cities": {}}
                
            province_map[prov_name]["count"] += 1
            
            if city_name not in province_map[prov_name]["cities"]:
                province_map[prov_name]["cities"][city_name] = 0
            province_map[prov_name]["cities"][city_name] += 1
            
            # 🌟 شمارش جنسیت
            if u.gender == "male":
                gender_map["مرد"] += 1
            elif u.gender == "female":
                gender_map["زن"] += 1
            else:
                gender_map["نامشخص"] += 1
        
    time_payload = [{"name": k, "users": v} for k, v in time_dist.items()]
    
    province_stats = []
    for prov_name, data in province_map.items():
        cities_list = [{"city": c, "count": count} for c, count in data["cities"].items()]
        cities_list.sort(key=lambda x: x["count"], reverse=True)
        province_stats.append({
            "province": prov_name,
            "count": data["count"],
            "cities": cities_list
        })
    province_stats.sort(key=lambda x: x["count"], reverse=True)
    
    # 🌟 پکیج‌بندی دیتای جنسیت
    gender_stats = [
        {"gender": "مرد", "count": gender_map["مرد"]},
        {"gender": "زن", "count": gender_map["زن"]},
        {"gender": "نامشخص", "count": gender_map["نامشخص"]}
    ]
    
    # --- منطق سوالات ---
    questions_payload = []
    questions = db.query(models.Question).filter(
        models.Question.contest_id == contest_id, 
        models.Question.deleted_at == None
    ).order_by(models.Question.id.asc()).all()
    
    for idx, q in enumerate(questions):
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
                correct_index = a_idx + 1 
        
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
        
        incorrect_count = max(0, total_participants - correct_count)
        
        questions_payload.append({
            "question_index": idx + 1,
            "title": q.title,
            "correct": correct_count,
            "incorrect": incorrect_count,
            "options": options_list,          
            "correct_answer": correct_index   
        })
        
    return JSONResponse(status_code=200, content={
        "time_distribution": time_payload,
        "questions_stats": questions_payload,
        "province_stats": province_stats,
        "gender_stats": gender_stats # 🌟 ارسال دیتای جنسیت به فرانت‌ند
    }, headers=cors_headers)

@app.post("/auth/refresh")
def refresh_access_token(payload: dict):
    refresh_token = payload.get("refresh_token")
    if not refresh_token:
        raise HTTPException(status_code=400, detail="ریفرش توکن ارسال نشده است")
        
    try:
        decoded_data = jwt.decode(refresh_token, SECRET_KEY, algorithms=[ALGORITHM], options={"verify_signature": True, "verify_exp": True})
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
    background_tasks: BackgroundTasks,
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

    if not answers_map:
        raise HTTPException(status_code=400, detail="پاسخی ارسال نشده است")

    contest = db.query(models.Contest).filter(models.Contest.id == contest_id).first()

    sub = db.query(models.Subscription).filter(
        models.Subscription.user_id == current_user.id,
        models.Subscription.contest_id == contest_id
    ).first()

    questions_by_id = {q.id: q for q in questions}

    # Denominator = exactly the questions assigned to this user (not the full contest bank).
    assigned_rows = []
    if sub:
        assigned_rows = db.query(models.SubscriptionQuestions).filter(
            models.SubscriptionQuestions.subscription_id == sub.id,
            models.SubscriptionQuestions.deleted_at == None
        ).all()

    if assigned_rows:
        assigned_question_ids = [row.question_id for row in assigned_rows]
    else:
        # Frontend must send every assigned question key, with null for unanswered ones.
        assigned_question_ids = [int(q_id) for q_id in answers_map.keys()]

    total_assigned = len(assigned_question_ids)
    if total_assigned == 0:
        raise HTTPException(status_code=400, detail="سوالی برای محاسبه نمره یافت نشد")

    # ۲. مقایسه انتخاب‌های کاربر با گزینه‌های صحیح — فقط روی سوالات تخصیص‌یافته
    correct_count = 0
    for q_id in assigned_question_ids:
        user_option_id = answers_map.get(str(q_id)) or answers_map.get(q_id)

        if user_option_id is None:
            continue  # blank: counts against score, but NOT in correct_count

        q = questions_by_id.get(int(q_id))
        if not q:
            continue

        correct_option = next(
            (ans for ans in q.answers if ans.is_correct == 1 and ans.deleted_at is None),
            None,
        )
        if correct_option and int(user_option_id) == correct_option.id:
            correct_count += 1

    score_percentage = (correct_count / total_assigned) * 100
    
    # تبدیل ثانیه‌های فرانت‌ند به شیء استاندارد Time دیتابیس
    t_seconds = int(payload.get("time_taken", 0))
    time_obj = time(hour=(t_seconds // 3600) % 24, minute=(t_seconds % 3600) // 60, second=t_seconds % 60)
    
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

    sms_text = contest.sms_message.strip() if contest and contest.sms_message else ""
    user_phone = current_user.phone_number
    if sms_text and user_phone:
        background_tasks.add_task(sms_service.send_sms, user_phone, sms_text)
    
    return {
        "score": round(score_percentage),
        "correct_count": correct_count,
        "total_questions": total_assigned
    }


@app.get("/admin/contests/{contest_id}/participants")
def get_admin_contest_participants(
    contest_id: int,
    search: Optional[str] = None,
    sort_by: Optional[str] = None,
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

    if sort_by == "lowest_score":
        query = query.order_by(models.Subscription.score.asc(), models.Subscription.created_at.desc())
    elif sort_by == "recent_participation":
        query = query.order_by(models.Subscription.created_at.desc())
    elif sort_by == "recent_registration":
        query = query.join(models.User).order_by(models.User.created_at.desc())
    elif sort_by == "youngest":
        query = query.join(models.User).order_by(
            models.User.birth_date.desc().nullslast(),
            models.Subscription.created_at.desc(),
        )
    elif sort_by == "oldest":
        query = query.join(models.User).order_by(
            models.User.birth_date.asc().nullslast(),
            models.Subscription.created_at.desc(),
        )
    elif sort_by == "highest_score":
        query = query.order_by(
            models.Subscription.score.desc(),
            models.Subscription.time_left.asc().nullslast(),
        )
    else:
        query = query.order_by(
            models.Subscription.score.desc(),
            models.Subscription.time_left.asc().nullslast(),
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
                except Exception as e:
                    logger.warning(f"Error calculating time taken: {e}")
                    time_taken_seconds = 0
                
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
        
    for idx, item in enumerate(results):
        item["rank"] = idx + 1
        
    return results