from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models import User, Subscription

def fix_scores_to_percentage(csv_file_path: str, target_contest_id: int):
    db = SessionLocal()
    success_count = 0
    try:
        # کش کردن کاربران
        users = db.query(User.id, User.phone_number, User.national_id).all()
        phone_to_user_id = {u.phone_number: u.id for u in users if u.phone_number}
        nid_to_user_id = {u.national_id: u.id for u in users if u.national_id}

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
                
                # استخراج تعداد پاسخ‌های صحیح (نمره خام)
                try:
                    raw_score = float(row[32].strip())
                except ValueError:
                    raw_score = 0
                
                # شمارش اینکه این کاربر دقیقا به چند سوال پاسخ داده است (از ستون 7 تا 29 اکسل)
                ans_count = sum(1 for i in range(7, 30) if i < len(row) and row[i].strip())
                
                # محاسبه درصد واقعی کاربر
                if ans_count == 0:
                    percentage = 0
                else:
                    percentage = int(round((raw_score / ans_count) * 100))
                
                user_id = phone_to_user_id.get(phone) or nid_to_user_id.get(national_id)
                if not user_id: 
                    continue
                
                # آپدیت کردن نمره کاربر در دیتابیس به درصد
                db.query(Subscription).filter(
                    Subscription.user_id == user_id, 
                    Subscription.contest_id == target_contest_id
                ).update({"score": percentage})
                
                success_count += 1
                
                # ثبت تغییرات در دیتابیس هر ۵۰۰ نفر
                if success_count % 500 == 0:
                    db.commit()
            
            # ثبت نهایی باقیمانده‌ها
            db.commit()
            
        print(f"Successfully updated {success_count} scores to percentage for contest {target_contest_id}.")
        
    except Exception as e:
        db.rollback()
        print(f"Error during update: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    # اجرای اسکریپت برای مسابقه شماره ۱۱
    fix_scores_to_percentage("/app/old_data.csv", 11)