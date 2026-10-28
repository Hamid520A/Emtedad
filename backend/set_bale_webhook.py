# backend/set_bale_webhook.py
# Registers the Bale bot webhook and prints the resulting webhook info.
# Bale's setWebhook only accepts `url` (ports 443 or 88), so the secret is part of the path.
#
#   docker compose run --rm backend python set_bale_webhook.py
#   docker compose run --rm backend python set_bale_webhook.py --delete
import os
import sys

try:
    from dotenv import load_dotenv
    load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))
    load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))
except ImportError:
    pass

import requests

API_BASE = "https://tapi.bale.ai"


def _call(token: str, method: str, payload=None) -> dict:
    response = requests.post(f"{API_BASE}/bot{token}/{method}", json=payload or {}, timeout=(5, 15))
    return response.json()


def main() -> int:
    token = os.getenv("BALE_BOT_TOKEN", "").strip()
    secret = os.getenv("BALE_WEBHOOK_SECRET", "").strip()
    backend_url = os.getenv("BACKEND_URL", "").strip().rstrip("/")

    if not token:
        print("BALE_BOT_TOKEN is not set")
        return 1

    if "--delete" in sys.argv:
        print("setWebhook(url=''):", _call(token, "setWebhook", {"url": ""}))
        print("getWebhookInfo:", _call(token, "getWebhookInfo"))
        return 0

    if not secret or not backend_url:
        print("BALE_WEBHOOK_SECRET and BACKEND_URL must both be set")
        return 1
    if not backend_url.startswith("https://"):
        print("BACKEND_URL must be an https:// URL for Bale webhooks")
        return 1

    webhook_url = f"{backend_url}/api/webhook/bale/{secret}"
    result = _call(token, "setWebhook", {"url": webhook_url})
    print("setWebhook:", result)

    info = _call(token, "getWebhookInfo")
    registered = (info.get("result") or {}).get("url", "")
    print("getWebhookInfo url matches:", registered == webhook_url)
    return 0 if result.get("ok") and registered == webhook_url else 1


if __name__ == "__main__":
    sys.exit(main())
