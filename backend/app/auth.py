import bcrypt
from jose import jwt
from datetime import datetime, timedelta
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from . import schemas, crud, models, database
from sqlalchemy.orm import Session


# تنظیمات توکن (تغییر ندهید)
SECRET_KEY = "YOUR_SECRET_KEY" 
ALGORITHM = "HS256"

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")

def get_password_hash(password: str) -> str:
    # تبدیل متن به بایت و هش کردن
    pwd_bytes = password.encode('utf-8')
    salt = bcrypt.gensalt()
    hashed_password = bcrypt.hashpw(pwd_bytes, salt)
    return hashed_password.decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    # چک کردن پسورد وارد شده با هش دیتابیس
    password_byte_enc = plain_password.encode('utf-8')
    hashed_password_byte_enc = hashed_password.encode('utf-8')
    return bcrypt.checkpw(password_byte_enc, hashed_password_byte_enc)

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=1440) # ۲۴ ساعت
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def get_current_user(db: Session = Depends(database.get_db), token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="اعتبارنامه نامعتبر است",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        phone: str = payload.get("sub") # یا هر فیلدی که موقع توکن ساختن گذاشتی
        if phone is None:
            raise credentials_exception
        token_data = schemas.TokenData(phone=phone)
    except JWTError:
        raise credentials_exception
        
    user = crud.get_user_by_phone(db, phone=token_data.phone)
    if user is None:
        raise credentials_exception
    return user