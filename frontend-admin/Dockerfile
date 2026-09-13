# مرحله اول: دانلود و نصب پکیج‌ها
FROM docker.arvancloud.ir/library/node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm config set registry https://registry.npmmirror.com && npm ci

# مرحله دوم: بیلد کردن پروژه نکست‌جی‌اس (standalone)
FROM docker.arvancloud.ir/library/node:20-alpine AS builder
WORKDIR /app
COPY . .
COPY --from=deps /app/node_modules ./node_modules

# 🌟 شاه‌کلید: دریافت آدرس بک‌ند در زمان بیلد و پلمپ کردن آن در کدهای مرورگر
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

RUN npm run build

# مرحله سوم: اجرای server.js تولیدشده توسط output: 'standalone'
FROM docker.arvancloud.ir/library/node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN apk add --no-cache wget \
  && addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

CMD ["node", "server.js"]
