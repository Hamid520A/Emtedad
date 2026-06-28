import requests

# آدرس اندپوینت حساس لاگین که سقف آن را ۱۰ درخواست تنظیم کردیم
URL = "http://127.0.0.1:8000/login" 
PAYLOAD = {"phone_number": "09120000000", "password": "123"}

print("Rate Limit testing...\n")

for i in range(1, 16):
    try:
        response = requests.post(URL, json=PAYLOAD, timeout=5)
        print(f"request {i:02d} -> status: {response.status_code} | response: {response.json()}")
    except Exception as e:
        print(f"request {i:02d} -> error in connection: {e}")

print("\n🎯 testing completed.")