# backend/app/services/sms_service.py
import os
import requests

class TSMSService:
    def __init__(self):
        # آدرس مستقیم وب‌سرویس (بدون نیاز به WSDL و پارس کردن فایل‌های خراب)
        self.api_url = 'http://www.tsms.ir/soapWSDL/'
        
        # خواندن اطلاعات از فایل env.
        self.username = os.getenv("TSMS_USERNAME")
        self.password = os.getenv("TSMS_PASSWORD")
        self.sender_number = os.getenv("TSMS_SENDER_NUMBER")

    def send_sms(self, receiver_mobile: str, message_text: str):
        if not self.username or not self.password or not self.sender_number:
            print("❌ خطا: اطلاعات پنل پیامک (TSMS_USERNAME, ...) در فایل env. تنظیم نشده است.")
            return False

        # ساختار خام و دقیق XML (SOAP Payload) برای ارسال دستور پیامک
        payload = f"""<?xml version="1.0" encoding="utf-8"?>
        <soapenv:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" 
                          xmlns:xsd="http://www.w3.org/2001/XMLSchema" 
                          xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" 
                          xmlns:sms="http://sms.tsms.ir/">
           <soapenv:Header/>
           <soapenv:Body>
              <sms:sendSms soapenv:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">
                 <username xsi:type="xsd:string">{self.username}</username>
                 <password xsi:type="xsd:string">{self.password}</password>
                 <sms_number xsi:type="sms:ArrayOfString">
                    <item xsi:type="xsd:string">{self.sender_number}</item>
                 </sms_number>
                 <mobile xsi:type="sms:ArrayOfString">
                    <item xsi:type="xsd:string">{receiver_mobile}</item>
                 </mobile>
                 <msg xsi:type="sms:ArrayOfString">
                    <item xsi:type="xsd:string">{message_text}</item>
                 </msg>
                 <mclass xsi:type="sms:ArrayOfString">
                    <item xsi:type="xsd:string">1</item>
                 </mclass>
                 <messageid xsi:type="xsd:string"></messageid>
              </sms:sendSms>
           </soapenv:Body>
        </soapenv:Envelope>"""

        headers = {
            'Content-Type': 'text/xml; charset=utf-8',
            'SOAPAction': '""'
        }

        try:
            # ارسال مستقیم و سریع ریکوئست (با تایم‌اوت ۵ ثانیه برای جلوگیری از هنگ کردن سرور شما)
            response = requests.post(self.api_url, data=payload.encode('utf-8'), headers=headers, timeout=5)
            
            if response.status_code == 200 and "sendSmsResponse" in response.text:
                print("✅ پیامک از طریق TSMS با موفقیت ارسال شد.")
                return True
            else:
                print(f"❌ خطای سامانه پیامکی TSMS: {response.text}")
                return False
                
        except requests.exceptions.Timeout:
            print("❌ خطا: سرور سامانه پیامکی پاسخی نداد (Timeout).")
            return False
        except Exception as e:
            print(f"❌ خطای سیستمی در ارتباط با وب‌سرویس پیامک: {e}")
            return False

# ساخت یک نمونه (Instance) برای استفاده در تمام بخش‌های بک‌اند
sms_service = TSMSService()