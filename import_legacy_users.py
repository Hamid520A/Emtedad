import random
from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models import User
from app.auth import get_password_hash 

def import_legacy_users(csv_file_path: str):
    db = SessionLocal()
    success_count = 0
    batch_size = 500  # کاهش حجم دسته‌ها برای مدیریت بهتر
    new_users = []
    
    try:
        # بارگذاری دیتای اولیه
        existing_phones = {phone[0] for phone in db.query(User.phone_number).all() if phone[0]}
        existing_wallet_codes = {code[0] for code in db.query(User.wallet_code).all() if code[0]}
        existing_national_ids = {nid[0] for nid in db.query(User.national_id).all() if nid[0]}
        
        default_password_hash = get_password_hash('123456')

        with open(csv_file_path, mode='r', encoding='utf-16') as file:
            next(file)
            next(file)
            next(file)
            
            for line in file:
                row = line.strip('\n').split('\t')
                
                if len(row) < 7:
                    continue
                
                raw_phone = row[3].strip()
                if not raw_phone:
                    continue
                    
                phone = raw_phone.replace('-', '').replace(' ', '')
                national_id = row[2].strip()
                
                if phone in existing_phones:
                    continue
                
                if national_id and national_id in existing_national_ids:
                    continue
                
                # تولید کد کاملاً یکتا
                while True:
                    new_wallet_code = str(random.randint(100000, 999999))
                    if new_wallet_code not in existing_wallet_codes:
                        # چک کردن زنده در دیتابیس برای اطمینان صددرصدی
                        if not db.query(User).filter(User.wallet_code == new_wallet_code).first():
                            existing_wallet_codes.add(new_wallet_code)
                            break

                raw_gender = row[6].strip()
                gender_mapped = 'male' if raw_gender == 'برادر' else ('female' if raw_gender == 'خواهر' else None)
                
                user = User(
                    first_name=row[0].strip(),
                    last_name=row[1].strip(),
                    national_id=national_id if national_id else None,
                    phone_number=phone,
                    gender=gender_mapped,
                    password=default_password_hash,
                    wallet_code=new_wallet_code,
                    is_active=1
                )
                
                new_users.append(user)
                existing_phones.add(phone)
                if national_id:
                    existing_national_ids.add(national_id)
                
                if len(new_users) >= batch_size:
                    db.bulk_save_objects(new_users)
                    db.commit()
                    success_count += len(new_users)
                    new_users = []
                    
            if new_users:
                db.bulk_save_objects(new_users)
                db.commit()
                success_count += len(new_users)

        print(f"Data migration completed. {success_count} new users inserted successfully.")
        
    except Exception as e:
        db.rollback()
        print(f"Error during migration: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    import_legacy_users("/app/old_data.csv")