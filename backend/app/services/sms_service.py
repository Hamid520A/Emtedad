# backend/app/services/sms_service.py
import os
from zeep import Client
from zeep.exceptions import Fault

class TSMSService:
    def __init__(self):
        # آدرس WSDL سامانه پیامکی طبق فایل XML شما
        self.wsdl_url = 'http://www.tsms.ir/soapWSDL/?wsdl'
        
        # خواندن اطلاعات از فایل env.
        self.username = os.getenv("TSMS_USERNAME")
        self.password = os.getenv("TSMS_PASSWORD")
        self.sender_number = os.getenv("TSMS_SENDER_NUMBER")
        
        # کلاینت Zeep
        self.client = Client(wsdl=self.wsdl_url)

    def send_sms(self, receiver_mobile: str, message_text: str):
        """
        ارسال یک پیامک تکی
        """
        if not self.username or not self.password or not self.sender_number:
            print("خطا: اطلاعات ورود به سامانه پیامکی در فایل env تنظیم نشده است.")
            return False

        try:
            # نکته WSDL: طبق فایل شما، شماره‌ها و متن‌ها باید ArrayOfString باشند.
            # در پایتون (zeep) کافیست آنها را داخل لیست (List) قرار دهیم.
            sms_numbers = [self.sender_number]
            mobiles = [receiver_mobile]
            msgs = [message_text]
            mclass = ["1"] # کلاس پیامک (1 معمولاً استاندارد است)
            messageid = "" # آیدی دلخواه (خالی می‌گذاریم تا خود سرور TSMS آیدی بدهد)

            # فراخوانی متد sendSms که در فایل WSDL تعریف شده است
            result = self.client.service.sendSms(
                self.username,
                self.password,
                sms_numbers,
                mobiles,
                msgs,
                mclass,
                messageid
            )
            
            # خروجی (ArrayOfInt) معمولاً شامل آیدی پیامک در سامانه یا کد خطا است
            print(f"sms sent successfully, result: {result}")
            return True

        except Fault as fault:
            print(f"soap error from sms server: {fault}")
            return False
        except Exception as e:
            print(f"unexpected error: {e}")
            return False

# ساخت یک نمونه (Instance) برای استفاده در تمام بخش‌های بک‌اند
sms_service = TSMSService()