# ۱. استفاده از نسخه سبک و پایدار پایتون
FROM docker.arvancloud.ir/library/python:3.11-slim

# ۲. تنظیم پوشه کاری داخل کانتینر
WORKDIR /app

# ۳. جلوگیری از نوشتن فایل‌های کش .pyc توسط پایتون
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1

# تعداد پروسس‌های Uvicorn
ENV WEB_CONCURRENCY=4

# ۴. نصب ابزارهای مورد نیاز سیستم برای کامپایل پکیج‌ها (مثل psycopg2)
#    و کتابخانه‌های شکل‌دهی متن راست‌به‌چپ Pillow (raqm + fribidi + harfbuzz + freetype) برای گواهی‌ها
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    curl \
    libfreetype6 \
    libfribidi0 \
    libharfbuzz0b \
    libraqm0 \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# ۵. کپی و نصب پکیج‌های پایتون
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade -r requirements.txt

# ۶. کپی کردن کل کدهای بک‌ند به داخل کانتینر
COPY . .

# ۷. فونت وزیرمتن برای رندر گواهی از دیسک (نسخه‌ی داخل مخزن در backend/fonts؛ فقط در نبود آن دانلود می‌شود)
#    و توقف بیلد اگر Pillow قادر به شکل‌دهی متن فارسی نباشد
ARG VAZIRMATN_BASE_URL=https://raw.githubusercontent.com/rastikerdar/vazirmatn/v33.003/fonts/ttf
RUN mkdir -p fonts \
    && for weight in Bold Medium; do \
         font="fonts/Vazirmatn-${weight}.ttf"; \
         [ -s "$font" ] || curl -fsSL --retry 3 --connect-timeout 15 -o "$font" "${VAZIRMATN_BASE_URL}/Vazirmatn-${weight}.ttf"; \
       done \
    && python -c "from PIL import ImageFont, features; [ImageFont.truetype(f'fonts/Vazirmatn-{w}.ttf', 20) for w in ('Bold', 'Medium')]; assert features.check('raqm'), 'Pillow raqm (RTL shaping) is unavailable'"

# ۸. اضافه کردن کاربر غیر روت برای امنیت پروداکشن
RUN addgroup --system appgroup && adduser --system --group appuser
RUN chown -R appuser:appgroup /app
USER appuser

# ۹. باز کردن پورت ۸۰۰۰
EXPOSE 8000

# ۱۰. ساخت جداول (فقط یک‌بار) و سپس اجرای سرور با uvicorn (چند پروسسی)
CMD ["sh", "-c", "python prestart.py && exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers \"$WEB_CONCURRENCY\""]
