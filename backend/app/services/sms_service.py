# backend/app/services/sms_service.py
import os
import requests
import re

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
            
            print(f"\n--- 📡 پاسخ خام سرور TSMS ---\n{response.text}\n-----------------------------\n")
            
            if response.status_code == 200 and "sendSmsResponse" in response.text:
                # 🌟 استخراج کاملاً هوشمندانه عدد از داخل تگ‌های پیچیده XML
                match = re.search(r'>\s*(-?\d+)\s*</item>', response.text)
                
                if match:
                    result_code = int(match.group(1))
                    
                    if result_code <= 0:
                        print(f"❌ درخواست به TSMS رسید، اما پنل ارور داد! کد خطای مخابرات: {result_code}")
                        if result_code == -8:
                            print("💡 راهنمایی: خطای -8 یعنی شماره فرستنده (TSMS_SENDER_NUMBER) اشتباه است یا به پنل شما تعلق ندارد.")
                        elif result_code == -1:
                            print("💡 راهنمایی: خطای -1 یعنی یوزرنیم یا پسورد پنل پیامک در env. اشتباه است.")
                        elif result_code == -2:
                            print("💡 راهنمایی: خطای -2 یعنی شارژ پنل پیامک شما تمام شده است.")
                        
                        return False
                    else:
                        print(f"✅ پیامک با موفقیت ارسال شد. کد رهگیری مخابرات: {result_code}")
                        return True
                else:
                    print("❌ خروجی TSMS قابل خواندن نیست و عدد نتیجه یافت نشد.")
                    return False
            else:
                print(f"❌ خطای اتصال به سرور TSMS: {response.text}")
                return False
                
        except requests.exceptions.Timeout:
            print("❌ خطا: سرور TSMS پاسخی نداد (Timeout).")
            return False
        except Exception as e:
            print(f"❌ خطای سیستمی در ارتباط با پیامک: {e}")
            return False

sms_service = TSMSService()