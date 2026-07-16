# مرحله اول: دانلود و نصب پکیج‌ها
FROM docker.arvancloud.ir/library/node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json ./
RUN npm install

# مرحله دوم: بیلد کردن پروژه نکست‌جی‌اس
FROM docker.arvancloud.ir/library/node:20-alpine AS builder
WORKDIR /app
COPY . .
COPY --from=deps /app/node_modules ./node_modules

# 🌟 شاه‌کلید: دریافت آدرس بک‌ند در زمان بیلد و پلمپ کردن آن در کدهای مرورگر
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

RUN npm run build

# مرحله سوم: اجرای فرانت‌ند در محیط پروداکشن با کمترین حجم ممکن
FROM docker.arvancloud.ir/library/node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV production

# کپی کردن فقط فایل‌های ضروری برای اجرا (حذف کدهای اضافی)
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public

EXPOSE 3000
ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

CMD ["npm", "start"]