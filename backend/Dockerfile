# ۱. استفاده از نسخه سبک و پایدار پایتون
FROM docker.arvancloud.ir/library/python:3.11-slim

# ۲. تنظیم پوشه کاری داخل کانتینر
WORKDIR /app

# ۳. جلوگیری از نوشتن فایل‌های کش .pyc توسط پایتون
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1

# ۴. نصب ابزارهای مورد نیاز سیستم برای کامپایل پکیج‌ها (مثل psycopg2)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# ۵. کپی و نصب پکیج‌های پایتون
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade -r requirements.txt

# ۶. کپی کردن کل کدهای بک‌ند به داخل کانتینر
COPY . .

# ۷. باز کردن پورت ۸۰۰۰ که سرور فاست‌اپی روی آن دوود می‌کند
EXPOSE 8000

# ۸. دستور اجرای سرور با uvicorn
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]