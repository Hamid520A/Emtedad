# backend/app/services/sms_service.py
import os
import requests

class TSMSService:
    def __init__(self):
        self.api_url = 'http://www.tsms.ir/soapWSDL/'
        self.username = os.getenv("TSMS_USERNAME")
        self.password = os.getenv("TSMS_PASSWORD")
        self.sender_number = os.getenv("TSMS_SENDER_NUMBER")

    def send_sms(self, receiver_mobile: str, message_text: str):
        if not self.username or not self.password or not self.sender_number:
            print("❌ خطا: اطلاعات پنل پیامک در فایل env. تنظیم نشده است.")
            return False

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
            response = requests.post(self.api_url, data=payload.encode('utf-8'), headers=headers, timeout=5)
            
            # 🌟 شاه‌کلید عیب‌یابی: چاپ دقیق کدی که TSMS برمی‌گرداند
            print(f"\n--- 📡 پاسخ خام سرور TSMS ---\n{response.text}\n-----------------------------\n")
            
            if response.status_code == 200 and "sendSmsResponse" in response.text:
                # سامانه‌های پیامکی برای خطاها کدهای منفی (مثل -1 یا -3) یا صفر برمی‌گردانند
                if "<item>-" in response.text or "<item>0</item>" in response.text:
                    print("❌ درخواست به TSMS رسید، اما پنل ارور داد (به لاگ بالا دقت کنید).")
                    return False
                    
                print("✅ پیامک با موفقیت در صف ارسال مخابرات/TSMS قرار گرفت.")
                return True
            else:
                print(f"❌ خطای ناشناخته از سمت TSMS: {response.text}")
                return False
                
        except requests.exceptions.Timeout:
            print("❌ خطا: سرور TSMS پاسخی نداد (Timeout).")
            return False
        except Exception as e:
            print(f"❌ خطای سیستمی در ارتباط با پیامک: {e}")
            return False

sms_service = TSMSService()