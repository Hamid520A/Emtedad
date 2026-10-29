# backend/app/services/bale_receipts.py
# Wallet top-up receipts submitted through the Bale bot.
# User: photo + caption "wallet_code amount" -> pending transaction -> admin gets Approve/Reject buttons.
# Admin: button click -> row lock + pending check -> atomic balance update -> buttons removed.
import logging
import os
import re
from datetime import datetime, timezone
from typing import Optional, Set

from sqlalchemy import func, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app import models, schemas
from app.services import bale_bot

logger = logging.getLogger("emtedad_backend")

# transactions.amount and users.wallet_balance are 32-bit INTEGER columns.
AMOUNT_HARD_LIMIT = 2_000_000_000

CAPTION_RE = re.compile(r"^(\d{6})\s+(\d+)$")
CALLBACK_RE = re.compile(r"^(approve|reject)_(\d+)$")
_DIGITS = str.maketrans("۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩", "01234567890123456789")

HELP_TEXT = (
    "برای ثبت رسید واریز، تصویر رسید را ارسال کنید و در توضیح (کپشن) عکس "
    "شناسه کیف پول ۶ رقمی و مبلغ به ریال را با یک فاصله بنویسید.\n"
    "مثال: 123456 500000"
)

WELCOME_TEXT = """
📌 مراحل ارسال صحیح:
۱. عکس رسید واریزی را انتخاب کنید.
۲. در بخش توضیحات عکس، ابتدا «شناسه ۶ رقمی کاربری» و سپس با یک فاصله «مبلغ به ریال» را بنویسید.
۳. عکس را ارسال کنید.

✅مثال صحیح برای ارسال:
123456 500000
(این یعنی: شناسه کاربری ۱۲۳۴۵۶ را به مبلغ ۵۰۰ هزار ریال شارژ کن).

⚠️نکات مهم:
حتماً شناسه کاربری و مبلغ را در توضیحات تصویر بنویسید؛ پیام متنیِ جداگانه پردازش نمی‌شود.
مبلغ را حتماً به ریال و فقط به صورت عدد (بدون حروف) وارد کنید.
از ارسال رسیدهای تکراری خودداری کنید.
پس از ارسال، یک پیام «در حال بررسی» دریافت می‌کنید. به محض تایید ادمین، کیف پول شما شارژ خواهد شد.
شناسه ۶ رقمی کاربری خود را می‌توانید از بخش پروفایل کاربری مشاهده کنید."""


def _utc_now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _env_int(name: str, default: Optional[int] = None) -> Optional[int]:
    raw = (os.getenv(name) or "").strip()
    try:
        return int(raw) if raw else default
    except ValueError:
        logger.error("Invalid integer in %s", name)
        return default


def admin_chat_id() -> Optional[int]:
    return _env_int("BALE_ADMIN_CHAT_ID")


def admin_user_ids() -> Set[int]:
    ids = set()
    for part in (os.getenv("BALE_ADMIN_USER_IDS") or "").split(","):
        part = part.strip()
        if part.lstrip("-").isdigit():
            ids.add(int(part))
    return ids


def max_amount() -> int:
    return min(_env_int("BALE_MAX_AMOUNT", 100_000_000), AMOUNT_HARD_LIMIT)


def max_pending_per_user() -> int:
    return _env_int("BALE_MAX_PENDING_PER_USER", 3)


def parse_caption(caption: Optional[str]):
    """Return (wallet_code, amount) or None."""
    if not caption:
        return None
    normalized = caption.translate(_DIGITS).replace(",", "").replace("٬", "").strip()
    match = CAPTION_RE.match(normalized)
    if not match:
        return None
    wallet_code, amount = int(match.group(1)), int(match.group(2))
    if not 1 <= amount <= max_amount():
        return None
    return wallet_code, amount


def _mask_phone(phone: Optional[str]) -> str:
    if not phone or len(phone) < 7:
        return phone or "-"
    return f"{phone[:4]}***{phone[-4:]}"


def _admin_caption(tx_id: int, user: models.User, wallet_code: int, amount: int) -> str:
    full_name = f"{user.first_name or ''} {user.last_name or ''}".strip() or "-"
    return (
        f"🧾 رسید واریز جدید\n"
        f"شماره پیگیری: {tx_id}\n"
        f"کاربر: {full_name}\n"
        f"موبایل: {_mask_phone(user.phone_number)}\n"
        f"شناسه کیف پول: {wallet_code}\n"
        f"مبلغ: {amount:,} ریال"
    )


def handle_receipt_message(db: Session, msg: schemas.BaleMessage) -> None:
    chat_id = msg.chat.id
    if chat_id == admin_chat_id():
        return

    # /start, plain text and any other photo-less message get the full instructions.
    if not msg.photo:
        bale_bot.send_message(chat_id, WELCOME_TEXT)
        return

    parsed = parse_caption(msg.caption)
    if not parsed:
        bale_bot.send_message(chat_id, HELP_TEXT)
        return
    wallet_code, amount = parsed

    user = db.execute(
        select(models.User).where(models.User.wallet_code == wallet_code, models.User.deleted_at.is_(None))
    ).scalar_one_or_none()
    if user is None:
        bale_bot.send_message(chat_id, "شناسه کاربری نامعتبر است")
        return

    pending_count = db.execute(
        select(func.count(models.Transaction.id)).where(
            models.Transaction.user_id == user.id,
            models.Transaction.status == "pending",
            models.Transaction.deleted_at.is_(None),
        )
    ).scalar_one()
    if pending_count >= max_pending_per_user():
        bale_bot.send_message(
            chat_id, "شما رسیدهای در انتظار بررسی دارید. لطفاً تا بررسی آن‌ها صبر کنید."
        )
        return

    # Bale lists sizes smallest first; prefer the largest by size, then the last one.
    photo = max(enumerate(msg.photo), key=lambda item: (item[1].file_size or 0, item[0]))[1]

    already_exists = db.execute(
        select(models.Transaction.id).where(models.Transaction.receipt_file_unique_id == photo.file_unique_id)
    ).first()
    if already_exists:
        bale_bot.send_message(chat_id, "این رسید قبلاً ثبت شده")
        return

    local_path = bale_bot.download_receipt(photo.file_id)
    if local_path is None:
        logger.warning("Receipt copy not saved; continuing with Bale file_id only")

    tx = models.Transaction(
        user_id=user.id,
        wallet_code=wallet_code,
        amount=amount,
        status="pending",
        receipt_image_url=local_path,
        receipt_file_id=photo.file_id,
        receipt_file_unique_id=photo.file_unique_id,
        user_chat_id=chat_id,
    )
    db.add(tx)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        if local_path and os.path.exists(local_path):
            os.remove(local_path)
        bale_bot.send_message(chat_id, "این رسید قبلاً ثبت شده")
        return

    tx_id = tx.id
    target_chat = admin_chat_id()
    sent = None
    if target_chat is None:
        logger.error("BALE_ADMIN_CHAT_ID is not set; transaction %s has no admin message", tx_id)
    else:
        sent = bale_bot.send_photo(
            target_chat,
            photo.file_id,
            _admin_caption(tx_id, user, wallet_code, amount),
            inline_keyboard=[[
                {"text": "تایید", "callback_data": f"approve_{tx_id}"},
                {"text": "رد", "callback_data": f"reject_{tx_id}"},
            ]],
        )
        if sent is None:
            logger.error("Admin notification failed for transaction %s", tx_id)

    if sent and sent.get("message_id"):
        db.execute(
            update(models.Transaction)
            .where(models.Transaction.id == tx_id)
            .values(admin_chat_id=target_chat, admin_message_id=sent["message_id"])
        )
        db.commit()

    bale_bot.send_message(chat_id, f"رسید شما ثبت شد و در حال بررسی است. ⏳\nشماره پیگیری: {tx_id}")


def _remove_buttons(chat_id: Optional[int], message_id: Optional[int], cq: schemas.BaleCallbackQuery) -> None:
    if (not chat_id or not message_id) and cq.message:
        chat_id, message_id = cq.message.chat.id, cq.message.message_id
    if chat_id and message_id:
        bale_bot.edit_message_reply_markup(chat_id, message_id)


def handle_admin_callback(db: Session, cq: schemas.BaleCallbackQuery) -> None:
    if cq.from_.id not in admin_user_ids():
        bale_bot.answer_callback_query(cq.id, "دسترسی ندارید")
        return

    match = CALLBACK_RE.match(cq.data or "")
    if not match:
        bale_bot.answer_callback_query(cq.id, "دستور نامعتبر است")
        return
    action, tx_id = match.group(1), int(match.group(2))

    try:
        tx = db.execute(
            select(models.Transaction)
            .where(models.Transaction.id == tx_id, models.Transaction.deleted_at.is_(None))
            .with_for_update()
            .execution_options(populate_existing=True)
        ).scalar_one_or_none()

        if tx is None or tx.status != "pending":
            admin_ids = (tx.admin_chat_id, tx.admin_message_id) if tx else (None, None)
            db.rollback()
            _remove_buttons(*admin_ids, cq)
            bale_bot.answer_callback_query(cq.id, "این تراکنش قبلاً پردازش شده")
            return

        new_balance = None
        if action == "approve":
            # Lock order: transaction row first, then the user row.
            new_balance = db.execute(
                update(models.User)
                .where(models.User.id == tx.user_id)
                .values(wallet_balance=models.User.wallet_balance + tx.amount)
                .returning(models.User.wallet_balance)
            ).scalar_one()
            tx.status = "success"
        else:
            tx.status = "rejected"
        tx.processed_at = _utc_now()
        tx.processed_by_bale_id = cq.from_.id

        result = {
            "status": tx.status,
            "amount": tx.amount,
            "user_chat_id": tx.user_chat_id,
            "admin_chat_id": tx.admin_chat_id,
            "admin_message_id": tx.admin_message_id,
        }
        db.commit()
    except Exception:
        db.rollback()
        raise

    # Bale HTTP calls only after the row lock is released.
    approved = result["status"] == "success"
    _remove_buttons(result["admin_chat_id"], result["admin_message_id"], cq)

    verdict = "✅ تایید شد" if approved else "❌ رد شد"
    caption_chat = result["admin_chat_id"] or (cq.message.chat.id if cq.message else None)
    caption_msg = result["admin_message_id"] or (cq.message.message_id if cq.message else None)
    if caption_chat and caption_msg:
        base_caption = (cq.message.caption if cq.message and cq.message.caption else f"شماره پیگیری: {tx_id}")
        bale_bot.edit_message_caption(caption_chat, caption_msg, f"{base_caption}\n\n{verdict}")

    bale_bot.answer_callback_query(cq.id, verdict)

    if approved:
        bale_bot.send_message(
            result["user_chat_id"],
            f"واریز شما به مبلغ {result['amount']:,} ریال تایید شد.\n"
            f"موجودی فعلی کیف پول: {new_balance:,} ریال\n"
            f"شماره پیگیری: {tx_id}",
        )
    else:
        bale_bot.send_message(
            result["user_chat_id"],
            f"رسید شما با شماره پیگیری {tx_id} تایید نشد. در صورت نیاز با پشتیبانی تماس بگیرید.",
        )
