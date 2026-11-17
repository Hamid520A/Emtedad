# backend/app/services/bale_direct.py
import os
import uuid
import requests
import logging
import traceback
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any, List
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError, OperationalError
from app import models, database

logger = logging.getLogger("emtedad_backend")

BALE_API_BASE = "https://tapi.bale.ai/bot"
BALE_TIMEOUT = (5, 15)
POLL_HTTP_TIMEOUT = (10, 12)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _token() -> str:
    return os.getenv("BALE_BOT_TOKEN", "").strip()


def _provider_token() -> str:
    return os.getenv("BALE_PROVIDER_TOKEN", "WALLET-TEST-1111111111111111").strip()


def _bot_username() -> str:
    return os.getenv("BALE_BOT_USERNAME", "emtedade_emam_bot").strip()


def irt_to_irr(amount_irt: int) -> int:
    """تبدیل تومان به ریال برای درگاه بله"""
    return int(amount_irt) * 10


def use_polling() -> bool:
    """اگر روی لوکال باشیم (بدون https) یا BALE_POLLING فعال باشد، از Polling استفاده می‌شود"""
    if os.getenv("BALE_POLLING", "").lower() in ("true", "1", "yes"):
        return True
    backend_url = os.getenv("BACKEND_URL", "http://127.0.0.1:8000").strip().lower()
    return not backend_url.startswith("https://")


def generate_deep_link(payload_id: str) -> Optional[str]:
    username = _bot_username()
    if not username:
        logger.error("BALE_BOT_USERNAME is not set")
        return None
    handle = username.lstrip("@")
    start = str(payload_id).replace("-", "")
    return f"https://ble.ir/{handle}?start={start}"


def expire_overdue(db: Session, user_id: Optional[uuid.UUID] = None) -> int:
    """منقضی کردن فاکتورهای معلقی که زمانشان (30 دقیقه) به پایان رسیده است"""
    now = _now()
    query = db.query(models.BaleDirectPayment).filter(
        models.BaleDirectPayment.status == models.BaleDirectPaymentStatus.pending.value,
        models.BaleDirectPayment.expires_at <= now,
    )
    if user_id is not None:
        query = query.filter(models.BaleDirectPayment.user_id == user_id)

    count = query.update(
        {"status": models.BaleDirectPaymentStatus.expired.value},
        synchronize_session=False,
    )
    if count:
        db.commit()
    return count


def create_payment(db: Session, user_id: uuid.UUID, amount_irt: int) -> models.BaleDirectPayment:
    """ایجاد فاکتور جدید و منقضی کردن فاکتورهای معلق قبلی کاربر"""
    now = _now()

    # اگر کاربر قبلاً فاکتور pending ساخته و حالا می‌خواهد مبلغ جدیدی بزند، قبلی را منقضی می‌کنیم تا قفل نشود
    db.query(models.BaleDirectPayment).filter(
        models.BaleDirectPayment.user_id == user_id,
        models.BaleDirectPayment.status == models.BaleDirectPaymentStatus.pending.value,
    ).update(
        {"status": models.BaleDirectPaymentStatus.expired.value},
        synchronize_session=False,
    )
    db.flush()

    ttl = int(os.getenv("BALE_DIRECT_TTL_SECONDS", "1800"))  # 30 دقیقه
    payload_id = uuid.uuid4().hex

    new_payment = models.BaleDirectPayment(
        user_id=user_id,
        amount_irt=amount_irt,
        payload_id=payload_id,
        status=models.BaleDirectPaymentStatus.pending.value,
        created_at=now,
        expires_at=now + timedelta(seconds=ttl),
    )
    db.add(new_payment)
    try:
        db.commit()
        db.refresh(new_payment)
    except IntegrityError:
        db.rollback()
        raise ValueError("خطا در ایجاد فاکتور. لطفاً دوباره تلاش کنید.")

    return new_payment


def get_by_payload(db: Session, payload_id: str) -> Optional[models.BaleDirectPayment]:
    raw = (payload_id or "").strip()
    if not raw:
        return None
    compact = raw.replace("-", "")
    return db.query(models.BaleDirectPayment).filter(
        models.BaleDirectPayment.payload_id.in_([raw, compact])
    ).first()


def is_expired(row: models.BaleDirectPayment, now: Optional[datetime] = None) -> bool:
    stamp = now or _now()
    expires = row.expires_at.replace(tzinfo=timezone.utc) if row.expires_at.tzinfo is None else row.expires_at
    return expires <= stamp


def _post(method: str, payload: Dict[str, Any], timeout=BALE_TIMEOUT) -> Optional[Dict[str, Any]]:
    token = _token()
    if not token:
        logger.error(f"BALE_BOT_TOKEN is not set; skipping {method}")
        return None
    url = f"{BALE_API_BASE}{token}/{method}"
    try:
        res = requests.post(url, json=payload, timeout=timeout)
        body = res.json()
        if not isinstance(body, dict) or not body.get("ok"):
            logger.warning(f"Bale {method} rejected: {body}")
            return None
        return body
    except Exception as e:
        logger.warning(f"Bale {method} failed: {type(e).__name__}")
        return None


def send_invoice(chat_id: int, title: str, description: str, payload_id: str, amount_irr: int):
    start = str(payload_id).replace("-", "")
    return _post("sendInvoice", {
        "chat_id": chat_id,
        "title": title,
        "description": description,
        "provider_token": _provider_token(),
        "payload": start,
        "start_parameter": start,
        "currency": "IRR",
        "prices": [{"label": title, "amount": amount_irr}],
    })


def answer_pre_checkout(query_id: str, ok: bool, error_message: str = ""):
    body: Dict[str, Any] = {
        "pre_checkout_query_id": query_id,
        "ok": ok,
    }
    if not ok and error_message:
        body["error_message"] = error_message
    return _post("answerPreCheckoutQuery", body)


def send_message(chat_id: int, text: str):
    return _post("sendMessage", {"chat_id": chat_id, "text": text})


def delete_webhook():
    """حذف وب‌هوک برای فعال‌سازی دریافت آپدیت با getUpdates در محیط لوکال"""
    return _post("deleteWebhook", {"drop_pending_updates": False})


def get_updates(offset: int, timeout: int = 5) -> List[Dict[str, Any]]:
    """دریافت رویدادهای بات بله از طریق Polling (مخصوص تست لوکال)"""
    body = _post(
        "getUpdates",
        {"offset": offset, "timeout": timeout},
        timeout=POLL_HTTP_TIMEOUT,
    )
    if not body:
        return []
    result = body.get("result")
    return result if isinstance(result, list) else []


def complete_payment(db: Session, payload_id: str, charge_id: str, charged_irr: int) -> Optional[models.BaleDirectPayment]:
    """تایید نهایی پرداخت و افزایش موجودی کیف پول کاربر به صورت اتمیک"""
    try:
        row = (
            db.query(models.BaleDirectPayment)
            .filter(models.BaleDirectPayment.payload_id == payload_id)
            .with_for_update()
            .first()
        )
    except OperationalError:
        db.rollback()
        raise RuntimeError("lock_timeout")

    if not row:
        logger.error(f"bale_direct complete: payload_id={payload_id} not found")
        return None

    # اگر قبلاً پرداخت شده یا وضعیت نهایی دارد، دوباره شارژ نکن (Idempotency)
    if row.status in (
        models.BaleDirectPaymentStatus.paid.value,
        models.BaleDirectPaymentStatus.failed.value,
        models.BaleDirectPaymentStatus.mismatched.value,
    ):
        return row

    expected_irr = irt_to_irr(row.amount_irt)
    if charged_irr != expected_irr:
        row.status = models.BaleDirectPaymentStatus.mismatched.value
        row.actual_charged_irr = charged_irr
        row.tracking_code = charge_id
        db.commit()
        return row

    # شارژ کیف پول کاربر (حتی اگر فاکتور در لحظه پرداخت expired شده باشد ولی بله پول را کسر کرده باشد)
    user = db.query(models.User).filter(models.User.id == row.user_id).with_for_update().first()
    if not user:
        db.rollback()
        return None

    user.wallet_balance = (user.wallet_balance or 0) + int(row.amount_irt)
    row.status = models.BaleDirectPaymentStatus.paid.value
    row.tracking_code = charge_id

    try:
        db.commit()
        db.refresh(row)
    except IntegrityError:
        db.rollback()
        logger.warning(f"Duplicate tracking_code for payload {payload_id}")
        row = db.query(models.BaleDirectPayment).filter(models.BaleDirectPayment.payload_id == payload_id).first()

    return row


def process_update_dict(update: Dict[str, Any]) -> None:
    """پردازش یکپارچه آپدیت‌های بله (مشترک بین Webhook و Poller)"""
    logger.info(f"Bale update received: {update}")
    db = database.SessionLocal()
    try:
        message = update.get("message")
        if isinstance(message, dict):
            chat_id = (message.get("chat") or {}).get("id")
            text = (message.get("text") or "").strip()

            # ۱. دستور /start (با پارامتر یا بدون پارامتر در وب بله)
            if chat_id is not None and text.startswith("/start"):
                parts = text.split()
                payload_id = parts[1].replace("-", "") if len(parts) > 1 else ""

                row = get_by_payload(db, payload_id) if payload_id else None

                # 🌟 راه‌حل باگ نسخه وب بله: اگر /start خالی آمد، آخرین فاکتور pending که در ۵ دقیقه اخیر ساخته شده را پیدا کن
                if not row and not payload_id:
                    five_min_ago = _now() - timedelta(minutes=5)
                    recent_pending = (
                        db.query(models.BaleDirectPayment)
                        .filter(
                            models.BaleDirectPayment.status == models.BaleDirectPaymentStatus.pending.value,
                            models.BaleDirectPayment.created_at >= five_min_ago,
                        )
                        .order_by(models.BaleDirectPayment.created_at.desc())
                        .all()
                    )
                    # اگر فقط یک فاکتور تازه در انتظار است، همان را باز کن
                    if len(recent_pending) == 1:
                        row = recent_pending[0]
                        payload_id = row.payload_id

                if not row:
                    send_message(
                        chat_id,
                        "برای دریافت فاکتور، لطفاً ابتدا از داخل پروفایل بخش کیف پول مبلغ را وارد کرده و دکمه پرداخت را بزنید."
                    )
                elif row.status != models.BaleDirectPaymentStatus.pending.value or is_expired(row):
                    msg = (
                        "این فاکتور قبلاً پرداخت شده است."
                        if row.status == models.BaleDirectPaymentStatus.paid.value
                        else "این فاکتور منقضی شده است. لطفاً از پنل کاربری فاکتور جدید بسازید."
                    )
                    send_message(chat_id, msg)
                else:
                    amount_irr = irt_to_irr(row.amount_irt)
                    title = "شارژ کیف پول امتداد"
                    desc = f"شارژ کیف پول به مبلغ {row.amount_irt:,} تومان"
                    res = send_invoice(chat_id, title, desc, row.payload_id, amount_irr)
                    if not res:
                        send_message(
                            chat_id,
                            "❌ خطا در صدور فاکتور بانکی بله. لطفاً از صحت توکن پرداخت (BALE_PROVIDER_TOKEN) در BotFather اطمینان حاصل کنید."
                        )

            # ۲. رویداد پرداخت موفق (successful_payment)
            successful = message.get("successful_payment")
            if isinstance(successful, dict) and chat_id is not None:
                pay_payload = (successful.get("invoice_payload") or "").strip()
                charge_id = str(
                    successful.get("provider_payment_charge_id")
                    or successful.get("telegram_payment_charge_id")
                    or ""
                ).strip()
                charged_irr = int(successful.get("total_amount") or 0)

                if pay_payload and charge_id and charged_irr > 0:
                    result_row = complete_payment(db, pay_payload, charge_id, charged_irr)
                    if result_row and result_row.status == models.BaleDirectPaymentStatus.paid.value:
                        send_message(
                            chat_id,
                            f"✅ پرداخت {result_row.amount_irt:,} تومان با موفقیت انجام شد و کیف پول شما شارژ گردید.\n"
                            f"کد پیگیری: {charge_id}"
                        )
                    elif result_row and result_row.status == models.BaleDirectPaymentStatus.mismatched.value:
                        send_message(
                            chat_id,
                            "⏳ مبلغ پرداخت‌شده با فاکتور تطابق ندارد. پرداخت شما ثبت شده و توسط پشتیبانی بررسی می‌شود."
                        )
                    else:
                        send_message(chat_id, "❌ خطا در پردازش پرداخت. لطفاً با پشتیبانی تماس بگیرید.")

        # ۳. تاییدیه پیش از کسر وجه (pre_checkout_query)
        pre_checkout = update.get("pre_checkout_query")
        if isinstance(pre_checkout, dict):
            query_id = str(pre_checkout.get("id") or "")
            payload_id = (pre_checkout.get("invoice_payload") or "").strip()

            if query_id:
                row = get_by_payload(db, payload_id) if payload_id else None
                if not row or row.status != models.BaleDirectPaymentStatus.pending.value:
                    answer_pre_checkout(query_id, False, "پرداخت نامعتبر یا قبلاً پردازش شده است.")
                elif is_expired(row):
                    answer_pre_checkout(query_id, False, "مهلت پرداخت این فاکتور به پایان رسیده است.")
                else:
                    charged_irr = int(pre_checkout.get("total_amount") or 0)
                    expected_irr = irt_to_irr(row.amount_irt)
                    if charged_irr != expected_irr:
                        answer_pre_checkout(query_id, False, "مبلغ فاکتور با درخواست ثبت‌شده مطابقت ندارد.")
                    else:
                        answer_pre_checkout(query_id, True)

    except Exception as e:
        db.rollback()
        logger.error(f"Bale update processing failed: {e}\n{traceback.format_exc()}")
    finally:
        db.close()