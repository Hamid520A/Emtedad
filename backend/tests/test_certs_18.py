from sqlalchemy import func
from app.database import SessionLocal
from app.models import User, Subscription, Certificate, CertificateLevel, CertificateUser, Signer, CertificateSigners
from app.auth import get_password_hash
import jdatetime

TARGET_CONTEST_ID = 11
MIN_SCORE = 70

def generate_serial_number(contest_id: int, sequence: int) -> int:
    year = str(jdatetime.date.today().year)
    c_id = f"{contest_id:04d}"  # تبدیل 8 به 0008
    seq = f"{sequence:06d}"     # تبدیل 1 به 000001
    return int(year + c_id + seq)

def setup_and_issue_certs():
    db = SessionLocal()
    success_count = 0
    try:
        # ۱. ساخت یا بازیابی قالب گواهی برای مسابقه ۸
        cert = db.query(Certificate).filter(Certificate.contest_id == TARGET_CONTEST_ID).first()
        if not cert:
            cert = Certificate(
                title="گواهی پایان‌دوره مسابقه هجدهم",
                content="بدین‌وسیله گواهی می‌شود جناب/سرکار {{first_name}} {{last_name}} در آزمون شرکت کرده و نمره قبولی را کسب نموده‌اند.\nتاریخ: {{date}}",
                contest_id=TARGET_CONTEST_ID,
                background_url="/static/uploads/bg-8.jpg",
                is_active=1
            )
            db.add(cert)
            db.flush()

        # ۲. ساخت یا بروزرسانی سطح نمره قبولی (هاردکد روی 70)
        level = db.query(CertificateLevel).filter(CertificateLevel.certificate_id == cert.id).first()
        if not level:
            level = CertificateLevel(
                certificate_id=cert.id,
                min_score=MIN_SCORE,
                max_score=100,
                is_active=1
            )
            db.add(level)
            db.flush()
            cert.level_id = level.id
        else:
            level.min_score = MIN_SCORE

        # ۳. ثبت امضاکننده
        signer_name = "دکتر علی احمدی"
        signer = db.query(Signer).filter(Signer.name == signer_name).first()
        if not signer:
            signer = Signer(
                name=signer_name,
                title="مدیر برگزاری مسابقات",
                sign_url="/static/uploads/sign-8.png"
            )
            db.add(signer)
            db.flush()

        cert_signer = db.query(CertificateSigners).filter(
            CertificateSigners.certificate_id == cert.id,
            CertificateSigners.signer_id == signer.id
        ).first()
        if not cert_signer:
            db.add(CertificateSigners(certificate_id=cert.id, signer_id=signer.id))

        db.commit()

        # ۴. یافتن کاربران واجد شرایط (نمره >= 70 در مسابقه 8)
        eligible_subs = db.query(Subscription).filter(
            Subscription.contest_id == TARGET_CONTEST_ID,
            Subscription.score >= MIN_SCORE
        ).all()

        existing = {
            c.user_id for c in db.query(CertificateUser.user_id)
            .filter(CertificateUser.certificate_id == cert.id).all()
        }
        max_serial = db.query(func.max(CertificateUser.serial_number)).filter(
            CertificateUser.certificate_id == cert.id
        ).scalar()
        current_seq = int(str(max_serial)[-6:]) + 1 if max_serial else 1

        new_certs = []
        sample_user_id = None

        for sub in eligible_subs:
            if not sample_user_id:
                sample_user_id = sub.user_id

            if sub.user_id in existing:
                continue

            serial = generate_serial_number(TARGET_CONTEST_ID, current_seq)
            new_certs.append(CertificateUser(
                serial_number=serial,
                certificate_id=cert.id,
                user_id=sub.user_id,
                is_viewed=0,
                is_active=1
            ))
            existing.add(sub.user_id)
            current_seq += 1

        if new_certs:
            db.bulk_save_objects(new_certs)
            db.commit()
            success_count = len(new_certs)

        print(f"Success! Issued {success_count} new certificates for contest ID {TARGET_CONTEST_ID}.")

        # ۵. تنظیم رمز تست روی اولین کاربر واجد شرایط (فقط برای تست در لوکال!)
        if sample_user_id:
            test_user = db.query(User).filter(User.id == sample_user_id).first()
            if test_user:
                test_user.password = get_password_hash("12345678")
                db.commit()
                print("-" * 50)
                print(f"TEST LOGIN READY (LOCAL ONLY):")
                print(f"User: {test_user.first_name} {test_user.last_name}")
                print(f"Phone: {test_user.phone_number}")
                print(f"Temp Password: 12345678")
                print("-" * 50)

    except Exception as e:
        db.rollback()
        print(f"Error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    setup_and_issue_certs()