# backend/app/services/sms_service.py
import os
import logging
from zeep import Client
from zeep.transports import Transport
from requests import Session

logger = logging.getLogger("emtedad_backend")

class TSMSService:
    def __init__(self):
        self.username = os.getenv("TSMS_USERNAME")
        self.password = os.getenv("TSMS_PASSWORD")
        self.sender = os.getenv("TSMS_SENDER_NUMBER")
        
        # 🌟 اتصال مستقیم و زنده به لینک داکیومنت سایت TSMS
        self.wsdl_url = "http://www.tsms.ir/soapWSDL/?wsdl"

    def send_sms(self, receiver_mobile: str, message_text: str) -> bool:
        if not self.username or not self.password or not self.sender:
            logger.error("⚠️ تنظیمات پنل پیامک در فایل env خالی است.")
            return False

        try:
            # ۱. ساخت کلاینت استاندارد (با تایم‌اوت ۱۰ ثانیه برای جلوگیری از هنگ کردن)
            session = Session()
            transport = Transport(session=session, timeout=10)
            client = Client(wsdl=self.wsdl_url, transport=transport)

            # ۲. فراخوانی دقیق متد sendSms از روی WSDL سایت (ارسال پارامترها به صورت آرایه)
            result = client.service.sendSms(
                self.username,
                self.password,
                [self.sender],
                [receiver_mobile],
                [message_text],
                []  # mclass (طبق داکیومنت آرایه خالی مجاز است)
            )
            
            logger.info(f"پاسخ داکیومنت TSMS: {result}")
            
            # ۳. بررسی وضعیت خروجی
            # TSMS معمولاً آرایه‌ای برمی‌گرداند. اگر عدد بزرگتر از ۱۰۰۰ باشد، کد رهگیری مخابرات است.
            if result and len(result) > 0:
                status_code = int(result[0])
                if status_code > 1000:
                    logger.info(f"✅ پیامک با موفقیت توسط WSDL خوانده و ثبت شد. شناسه: {status_code}")
                    return True
                else:
                    logger.error(f"❌ خطای پنل پیامک (طبق جدول خطاهای سایت): {status_code}")
                    return False
            
            return False

        except Exception as e:
            logger.error(f"❌ خطای برقراری ارتباط با لینک WSDL: {str(e)}")
            return False

sms_service = TSMSService()