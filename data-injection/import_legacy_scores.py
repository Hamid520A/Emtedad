import sys
from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models import User, Subscription

def import_legacy_subscriptions(csv_file_path: str, target_contest_id: int):
    db = SessionLocal()
    success_count = 0
    batch_size = 500
    new_subscriptions = []

    try:
        print("Caching existing users to memory for fast matching...")
        users = db.query(User.id, User.phone_number, User.national_id).all()
        phone_to_user_id = {u.phone_number: u.id for u in users if u.phone_number}
        nid_to_user_id = {u.national_id: u.id for u in users if u.national_id}

        print(f"Caching existing subscriptions for contest {target_contest_id}...")
        existing_subs = db.query(Subscription.user_id).filter(Subscription.contest_id == target_contest_id).all()
        existing_sub_user_ids = {sub.user_id for sub in existing_subs}

        with open(csv_file_path, mode='r', encoding='utf-16') as file:
            next(file)
            next(file)
            next(file)
            
            for line in file:
                row = line.strip('\n').split('\t')
                
                if len(row) < 33: 
                    continue
                
                raw_phone = row[3].strip()
                phone = raw_phone.replace('-', '').replace(' ', '') if raw_phone else None
                national_id = row[2].strip() if row[2].strip() else None
                
                # استخراج نمره خام
                try:
                    raw_score = float(row[32].strip())
                except ValueError:
                    raw_score = 0
                
                # شمارش تعداد سوالات پاسخ داده شده (از ستون 7 تا 29 اکسل)
                ans_count = sum(1 for i in range(7, 30) if i < len(row) and row[i].strip())
                
                # محاسبه مستقیم درصد
                if ans_count == 0:
                    percentage = 0
                else:
                    percentage = int(round((raw_score / ans_count) * 100))
                
                # پیدا کردن کاربر در دیتابیس
                user_id = None
                if phone and phone in phone_to_user_id:
                    user_id = phone_to_user_id[phone]
                elif national_id and national_id in nid_to_user_id:
                    user_id = nid_to_user_id[national_id]
                    
                if not user_id:
                    continue
                    
                # جلوگیری از ثبت نمره تکراری برای یک نفر در یک مسابقه
                if user_id in existing_sub_user_ids:
                    continue
                
                sub = Subscription(
                    user_id=user_id,
                    contest_id=target_contest_id,
                    score=percentage,  # ثبت درصد به جای نمره خام
                    is_left=0
                )
                
                new_subscriptions.append(sub)
                existing_sub_user_ids.add(user_id)
                
                if len(new_subscriptions) >= batch_size:
                    db.bulk_save_objects(new_subscriptions)
                    db.commit()
                    success_count += len(new_subscriptions)
                    new_subscriptions = []
                    
            if new_subscriptions:
                db.bulk_save_objects(new_subscriptions)
                db.commit()
                success_count += len(new_subscriptions)

        print(f"Migration completed. {success_count} subscriptions (percentages) inserted for contest {target_contest_id}.")
        
    except Exception as e:
        db.rollback()
        print(f"Error during migration: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    # اجرای اسکریپت با ارسال مسیر فایل و آیدی مسابقه (مثلا ۱۱)
    import_legacy_subscriptions("/app/old_data.csv", 11)