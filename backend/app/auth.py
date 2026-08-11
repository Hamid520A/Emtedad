import bcrypt, os
from datetime import datetime, timedelta, timezone
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from . import models, database
from sqlalchemy.orm import Session

# 🌟 خواندن مستقیم کلیدها از فایل env
SECRET_KEY = os.getenv("SECRET_KEY", "fallback_temporary_secret_key_for_development")
ALGORITHM = os.getenv("ALGORITHM", "HS256")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")

def get_password_hash(password: str) -> str:
    pwd_bytes = password.encode('utf-8')
    salt = bcrypt.gensalt()
    hashed_password = bcrypt.hashpw(pwd_bytes, salt)
    return hashed_password.decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    password_byte_enc = plain_password.encode('utf-8')
    hashed_password_byte_enc = hashed_password.encode('utf-8')
    return bcrypt.checkpw(password_byte_enc, hashed_password_byte_enc)

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=1440) # ۲۴ ساعت
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

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