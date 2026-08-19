# backend/app/services/sms_service.py
import os
import logging
import requests
import re

logger = logging.getLogger("emtedad_backend")

class TSMSService:
    def __init__(self):
        self.username = os.getenv("TSMS_USERNAME")
        self.password = os.getenv("TSMS_PASSWORD")
        self.sender = os.getenv("TSMS_SENDER_NUMBER")
        self.endpoint = "http://www.tsms.ir/soapWSDL/index.php"

    def send_sms(self, receiver_mobile: str, message_text: str) -> bool:
        if not self.username or not self.password or not self.sender:
            logger.error("⚠️ تنظیمات پنل پیامک در فایل env خالی است.")
            return False

        # 🌟 ساختار XML فوق‌استاندارد با تعریف دقیق Type‌ها برای جلوگیری از ارور -6 و کرش سرور TSMS
        payload = f"""<?xml version="1.0" encoding="utf-8"?>
        <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" 
                          xmlns:sms="http://sms.tsms.ir/" 
                          xmlns:SOAP-ENC="http://schemas.xmlsoap.org/soap/encoding/" 
                          xmlns:xsd="http://www.w3.org/2001/XMLSchema" 
                          xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
           <soapenv:Header/>
           <soapenv:Body>
              <sms:sendSms>
                 <username xsi:type="xsd:string">{self.username}</username>
                 <password xsi:type="xsd:string">{self.password}</password>
                 <from SOAP-ENC:arrayType="xsd:string[1]" xsi:type="sms:ArrayOfString">
                    <item xsi:type="xsd:string">{self.sender}</item>
                 </from>
                 <to SOAP-ENC:arrayType="xsd:string[1]" xsi:type="sms:ArrayOfString">
                    <item xsi:type="xsd:string">{receiver_mobile}</item>
                 </to>
                 <msg SOAP-ENC:arrayType="xsd:string[1]" xsi:type="sms:ArrayOfString">
                    <item xsi:type="xsd:string">{message_text}</item>
                 </msg>
                 <mclass SOAP-ENC:arrayType="xsd:string[1]" xsi:type="sms:ArrayOfString">
                    <item xsi:type="xsd:string"></item>
                 </mclass>
              </sms:sendSms>
           </soapenv:Body>
        </soapenv:Envelope>"""

        headers = {
            'Content-Type': 'text/xml; charset=utf-8',
            'SOAPAction': 'http://sms.tsms.ir/sendSms'
        }

        try:
            # ارسال با تایم‌اوت ۱۵ ثانیه
            response = requests.post(self.endpoint, data=payload.encode('utf-8'), headers=headers, timeout=15)
            
            if response.status_code == 200:
                match = re.search(r'<item[^>]*>([-\d]+)</item>', response.text)
                if match:
                    code = int(match.group(1))
                    if code > 1000:
                        logger.info(f"✅ پیامک به مخابرات تحویل شد. کد رهگیری: {code}")
                        return True
                    elif code < 0:
                        logger.error(f"❌ خطای برگشتی از سمت پنل TSMS: کد {code}")
                        return False
                
                logger.warning(f"⚠️ پاسخ نامشخص از سرور TSMS: {response.text}")
                return False
            else:
                logger.error(f"❌ خطای اتصال به سرور پیامک: HTTP {response.status_code}")
                return False

        except requests.exceptions.RequestException as e:
            logger.error(f"❌ خطای شبکه در ارتباط با سرور TSMS: {str(e)}")
            return False
        except Exception as e:
            logger.error(f"❌ خطای سیستمی پردازش پیامک: {str(e)}")
            return False

sms_service = TSMSService()