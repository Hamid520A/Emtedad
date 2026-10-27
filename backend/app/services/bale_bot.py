# backend/app/services/bale_bot.py
# Thin client for the Bale bot API (Telegram-compatible). Every call fails soft:
# errors are logged and None is returned, so webhook handling never raises on Bale outages.
import logging
import os
import uuid
from typing import Any, Dict, List, Optional

import requests

logger = logging.getLogger("emtedad_backend")

BALE_API_BASE = "https://tapi.bale.ai"
REQUEST_TIMEOUT = (2.0, 5.0)
DOWNLOAD_TIMEOUT = (2.0, 15.0)
MAX_RECEIPT_BYTES = 10 * 1024 * 1024
RECEIPT_DIR = os.path.join("private_uploads", "receipts")


def _token() -> str:
    return os.getenv("BALE_BOT_TOKEN", "")


def _call(method: str, payload: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    token = _token()
    if not token:
        logger.error("BALE_BOT_TOKEN is not set; skipping Bale call %s", method)
        return None
    try:
        response = requests.post(f"{BALE_API_BASE}/bot{token}/{method}", json=payload, timeout=REQUEST_TIMEOUT)
        data = response.json()
    except (requests.RequestException, ValueError) as e:
        # The URL embeds the bot token, so log only the method name.
        logger.warning("Bale %s failed: %s", method, type(e).__name__)
        return None
    if not data.get("ok"):
        logger.warning("Bale %s rejected: %s", method, data.get("description"))
        return None
    return data.get("result")


def send_message(chat_id: int, text: str) -> Optional[Dict[str, Any]]:
    return _call("sendMessage", {"chat_id": chat_id, "text": text})


def send_photo(
    chat_id: int,
    file_id: str,
    caption: str,
    inline_keyboard: Optional[List[List[Dict[str, str]]]] = None,
) -> Optional[Dict[str, Any]]:
    payload: Dict[str, Any] = {"chat_id": chat_id, "photo": file_id, "caption": caption}
    if inline_keyboard:
        payload["reply_markup"] = {"inline_keyboard": inline_keyboard}
    return _call("sendPhoto", payload)


def edit_message_reply_markup(chat_id: int, message_id: int) -> Optional[Dict[str, Any]]:
    """Remove all inline buttons from a message."""
    return _call(
        "editMessageReplyMarkup",
        {"chat_id": chat_id, "message_id": message_id, "reply_markup": {"inline_keyboard": []}},
    )


def edit_message_caption(chat_id: int, message_id: int, caption: str) -> Optional[Dict[str, Any]]:
    return _call(
        "editMessageCaption",
        {
            "chat_id": chat_id,
            "message_id": message_id,
            "caption": caption,
            "reply_markup": {"inline_keyboard": []},
        },
    )


def answer_callback_query(callback_query_id: str, text: str) -> Optional[Dict[str, Any]]:
    return _call("answerCallbackQuery", {"callback_query_id": callback_query_id, "text": text})


def get_file(file_id: str) -> Optional[Dict[str, Any]]:
    return _call("getFile", {"file_id": file_id})


def download_receipt(file_id: str) -> Optional[str]:
    """Save a private copy of the receipt and return its path relative to the app root."""
    file_info = get_file(file_id)
    file_path = (file_info or {}).get("file_path")
    if not file_path:
        return None
    if (file_info.get("file_size") or 0) > MAX_RECEIPT_BYTES:
        logger.warning("Bale receipt too large: %s bytes", file_info.get("file_size"))
        return None

    ext = os.path.splitext(file_path)[1].lower()
    if ext not in (".jpg", ".jpeg", ".png", ".webp"):
        ext = ".jpg"
    os.makedirs(RECEIPT_DIR, exist_ok=True)
    local_path = os.path.join(RECEIPT_DIR, f"{uuid.uuid4().hex}{ext}")

    try:
        with requests.get(
            f"{BALE_API_BASE}/file/bot{_token()}/{file_path}", stream=True, timeout=DOWNLOAD_TIMEOUT
        ) as response:
            response.raise_for_status()
            written = 0
            with open(local_path, "wb") as out:
                for chunk in response.iter_content(chunk_size=64 * 1024):
                    written += len(chunk)
                    if written > MAX_RECEIPT_BYTES:
                        raise ValueError("receipt exceeds size limit")
                    out.write(chunk)
    except (requests.RequestException, ValueError, OSError) as e:
        logger.warning("Bale receipt download failed: %s", type(e).__name__)
        if os.path.exists(local_path):
            os.remove(local_path)
        return None
    return local_path
