import bcrypt, os
from datetime import datetime, timedelta, timezone
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from . import models, database
from sqlalchemy.orm import Session

# 🌟 خواندن مستقیم کلیدها از فایل env
SECRET_KEY = os.getenv("SECRET_KEY", "fallback_temporary_secret_key_for_development")
DEBUG_MODE = os.getenv("DEBUG_MODE", "False").lower() in ("true", "1", "yes")

if SECRET_KEY == "fallback_temporary_secret_key_for_development" and not DEBUG_MODE:
    raise RuntimeError("FATAL SECURITY ERROR: Running in production with a fallback SECRET_KEY is strictly forbidden.")

ALGORITHM = os.getenv("ALGORITHM", "HS256")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="swagger-login")

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(data: dict):
    # Strip any sensitive PII explicitly
    safe_data = {k: v for k, v in data.items() if k not in ("password", "national_id", "hashed_password")}
    expire = datetime.now(timezone.utc) + timedelta(minutes=1440) # ۲۴ ساعت
    safe_data.update({"exp": expire})
    return jwt.encode(safe_data, SECRET_KEY, algorithm=ALGORITHM)

def get_current_user(db: Session = Depends(database.get_db), token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="کارت ورود شما معتبر نیست. لطفاً مجدداً لاگین کنید",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub") 
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
        
    user = db.query(models.User).filter(models.User.phone_number == username).first()
    if user is None:
        raise credentials_exception
    return user

# 🌟 فیکس اصلی: اصلاح auth.get_current_user به get_current_user
def require_admin(current_user: models.User = Depends(get_current_user), db: Session = Depends(database.get_db)):
    """بررسی سطح دسترسی مدیر در سنگر نهایی بک‌ند بر اساس جدول جدید admins"""
    if not current_user:
        raise HTTPException(status_code=401, detail="ابتدا وارد حساب کاربری خود شوید")
        
    if not getattr(current_user, "is_active", 1):
        raise HTTPException(status_code=403, detail="حساب کاربری شما غیرفعال است")
    
    # بررسی وجود رکورد متصل در جدول مستقل admins
    if not current_user.admin or current_user.admin.is_active == 0:
        raise HTTPException(
            status_code=403, 
            detail="خطای امنیتی: شما دسترسی لازم برای این بخش را ندارید!"
        )
        
    return current_user