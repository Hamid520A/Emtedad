# backend/app/models.py
from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Boolean, Float, Text, SmallInteger, Date, Time, BigInteger
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .database import Base
import datetime

class City(Base):
    __tablename__ = "cities"
    id = Column(Integer, primary_key=True, index=True)
    parent_id = Column(Integer, ForeignKey("cities.id"), nullable=True)
    title = Column(String(255), nullable=False)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, onupdate=func.now())
    deleted_at = Column(DateTime, nullable=True)

    parent = relationship("City", remote_side=[id])
    users = relationship("User", back_populates="city")

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    first_name = Column(String(255), nullable=False)
    last_name = Column(String(255), nullable=True)
    phone_number = Column(String(20), unique=True, index=True)
    password = Column(String(255), nullable=False)
    national_id = Column(String(20), unique=True, index=True)
    city_id = Column(Integer, ForeignKey("cities.id"), nullable=True)
    birth_date = Column(Date, nullable=True)
    gender = Column(String(20), nullable=True)
    eitaa_user_id = Column(BigInteger, unique=True, nullable=True, index=True)
    eitaa_access_hash = Column(BigInteger, nullable=True)
    is_active = Column(SmallInteger, default=1)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, onupdate=func.now())
    deleted_at = Column(DateTime, nullable=True)

    city = relationship("City", back_populates="users")
    subscriptions = relationship("Subscription", back_populates="user")
    certificate_users = relationship("CertificateUser", back_populates="user")
    notification_users = relationship("NotificationUsers", back_populates="user")
    banner_users = relationship("BannerUsers", back_populates="user")
    
    # ریلیشن ۱ به ۱ متصل به جدول ادمین‌ها
    admin = relationship("Admin", back_populates="user", uselist=False, cascade="all, delete-orphan")

class Admin(Base):
    __tablename__ = "admins"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False, index=True)
    is_active = Column(SmallInteger, default=1)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, onupdate=func.now())
    deleted_at = Column(DateTime, nullable=True)

    user = relationship("User", back_populates="admin")
    logs = relationship("AdminLog", back_populates="admin")

class AdminLog(Base):
    __tablename__ = "admin_logs"
    id = Column(Integer, primary_key=True, index=True)
    admin_id = Column(Integer, ForeignKey("admins.id"), nullable=False)
    action = Column(String(255), nullable=False)          
    target_model = Column(String(50), nullable=True)     
    target_id = Column(Integer, nullable=True)           
    description = Column(Text, nullable=True) 
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, onupdate=func.now())
    deleted_at = Column(DateTime, nullable=True)

    admin = relationship("Admin", back_populates="logs")

class Contest(Base):
    __tablename__ = "contests"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), index=True, nullable=False)
    image_url = Column(String(500), nullable=True)
    description = Column(Text, nullable=True)
    max_time = Column(Time, nullable=True)
    video_url = Column(String(500), nullable=True)
    start_time = Column(DateTime, nullable=True)
    end_time = Column(DateTime, nullable=True)
    status = Column(String(50), default="upcoming")
    is_active = Column(SmallInteger, default=1)
    question_limit = Column(Integer, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, onupdate=func.now())
    deleted_at = Column(DateTime, nullable=True)

    questions = relationship("Question", back_populates="contest", cascade="all, delete-orphan")
    subscriptions = relationship("Subscription", back_populates="contest")
    attachments = relationship("Attachment", back_populates="contest")
    award_contests = relationship("AwardContest", back_populates="contest")
    certificates = relationship("Certificate", back_populates="contest")

class Attachment(Base):
    __tablename__ = "attachments"
    id = Column(Integer, primary_key=True, index=True)
    contest_id = Column(Integer, ForeignKey("contests.id"))
    file_name = Column(String(255))
    file_subtitle = Column(String(255), nullable=True)
    file_url = Column(String(500))
    file_type = Column(String(50))
    file_size = Column(Integer)
    is_active = Column(SmallInteger, default=1)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, onupdate=func.now())
    deleted_at = Column(DateTime, nullable=True)

    contest = relationship("Contest", back_populates="attachments")

class Award(Base):
    __tablename__ = "awards"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    is_active = Column(SmallInteger, default=1)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, onupdate=func.now())
    deleted_at = Column(DateTime, nullable=True)

    award_contests = relationship("AwardContest", back_populates="award")

class AwardContest(Base):
    __tablename__ = "award_contests"
    id = Column(Integer, primary_key=True, index=True)
    award_id = Column(Integer, ForeignKey("awards.id"))
    contest_id = Column(Integer, ForeignKey("contests.id"))
    number = Column(Integer)
    is_active = Column(SmallInteger, default=1)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, onupdate=func.now())
    deleted_at = Column(DateTime, nullable=True)

    award = relationship("Award", back_populates="award_contests")
    contest = relationship("Contest", back_populates="award_contests")

class Question(Base):
    __tablename__ = "questions"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(500), nullable=False)
    description = Column(Text, nullable=True)
    contest_id = Column(Integer, ForeignKey("contests.id"))
    is_active = Column(SmallInteger, default=1)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, onupdate=func.now())
    deleted_at = Column(DateTime, nullable=True)

    contest = relationship("Contest", back_populates="questions")
    answers = relationship("Answer", back_populates="question", cascade="all, delete-orphan")

class Answer(Base):
    __tablename__ = "answers"
    id = Column(Integer, primary_key=True, index=True)
    question_id = Column(Integer, ForeignKey("questions.id"))
    title = Column(String(500), nullable=False)
    is_correct = Column(SmallInteger, default=0)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, onupdate=func.now())
    deleted_at = Column(DateTime, nullable=True)

    question = relationship("Question", back_populates="answers")

class Subscription(Base):
    __tablename__ = "subscriptions"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    contest_id = Column(Integer, ForeignKey("contests.id"))
    time_left = Column(Time, nullable=True)
    score = Column(Integer, default=0)
    is_left = Column(SmallInteger, default=0)
    started_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, onupdate=func.now())
    deleted_at = Column(DateTime, nullable=True)

    user = relationship("User", back_populates="subscriptions")
    contest = relationship("Contest", back_populates="subscriptions")
    subscription_questions = relationship("SubscriptionQuestions", back_populates="subscription")

class SubscriptionQuestions(Base):
    __tablename__ = "subscription_questions"
    id = Column(Integer, primary_key=True, index=True)
    subscription_id = Column(Integer, ForeignKey("subscriptions.id"))
    question_id = Column(Integer, ForeignKey("questions.id"))
    time_taken = Column(Time, nullable=True)
    number = Column(Integer)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, onupdate=func.now())
    deleted_at = Column(DateTime, nullable=True)

    subscription = relationship("Subscription", back_populates="subscription_questions")
    subscription_answers = relationship("SubscriptionAnswer", back_populates="subscription_question")

class SubscriptionAnswer(Base):
    __tablename__ = "subscription_answers"
    id = Column(Integer, primary_key=True, index=True)
    subscription_question_id = Column(Integer, ForeignKey("subscription_questions.id"))
    answer_id = Column(Integer, ForeignKey("answers.id"))
    number = Column(Integer)
    is_chosen = Column(SmallInteger, default=0)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, onupdate=func.now())
    deleted_at = Column(DateTime, nullable=True)

    subscription_question = relationship("SubscriptionQuestions", back_populates="subscription_answers")

class Signer(Base):
    __tablename__ = "signers"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    title = Column(String(255), nullable=False)
    sign_url = Column(String(500), nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, onupdate=func.now())
    deleted_at = Column(DateTime, nullable=True)

    certificate_signers = relationship("CertificateSigners", back_populates="signer")

class Certificate(Base):
    __tablename__ = "certificates"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    content = Column(Text, nullable=True)
    contest_id = Column(Integer, ForeignKey("contests.id"))
    background_url = Column(String(500), nullable=True)
    logo_url = Column(String(500), nullable=True)
    level_id = Column(Integer, ForeignKey("certificate_levels.id"), nullable=True)
    is_active = Column(SmallInteger, default=1)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, onupdate=func.now())
    deleted_at = Column(DateTime, nullable=True)

    contest = relationship("Contest", back_populates="certificates")
    certificate_signers = relationship("CertificateSigners", back_populates="certificate")
    levels = relationship("CertificateLevel", foreign_keys=[level_id])
    all_levels = relationship("CertificateLevel", back_populates="certificate", foreign_keys="[CertificateLevel.certificate_id]")
    certificate_users = relationship("CertificateUser", back_populates="certificate")

class CertificateSigners(Base):
    __tablename__ = "certificate_signers"
    id = Column(Integer, primary_key=True, index=True)
    certificate_id = Column(Integer, ForeignKey("certificates.id"))
    signer_id = Column(Integer, ForeignKey("signers.id"))
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, onupdate=func.now())
    deleted_at = Column(DateTime, nullable=True)

    certificate = relationship("Certificate", back_populates="certificate_signers")
    signer = relationship("Signer", back_populates="certificate_signers")

class CertificateLevel(Base):
    __tablename__ = "certificate_levels"
    id = Column(Integer, primary_key=True, index=True)
    certificate_id = Column(Integer, ForeignKey("certificates.id"))
    min_score = Column(Integer)
    max_score = Column(Integer)
    is_active = Column(SmallInteger, default=1)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, onupdate=func.now())
    deleted_at = Column(DateTime, nullable=True)

    certificate = relationship("Certificate", back_populates="all_levels", foreign_keys=[certificate_id])

class CertificateUser(Base):
    __tablename__ = "certificate_users"
    id = Column(Integer, primary_key=True, index=True)
    serial_number = Column(Integer, unique=True)
    certificate_id = Column(Integer, ForeignKey("certificates.id"))
    user_id = Column(Integer, ForeignKey("users.id"))
    image_url = Column(String(500), nullable=True)
    is_viewed = Column(SmallInteger, default=0)
    is_active = Column(SmallInteger, default=1)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, onupdate=func.now())
    deleted_at = Column(DateTime, nullable=True)

    certificate = relationship("Certificate", back_populates="certificate_users")
    user = relationship("User", back_populates="certificate_users")

class Notification(Base):
    __tablename__ = "notifications"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    content = Column(Text, nullable=False)
    is_global = Column(SmallInteger, default=0)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, onupdate=func.now())
    deleted_at = Column(DateTime, nullable=True)

    notification_users = relationship("NotificationUsers", back_populates="notification")

class NotificationUsers(Base):
    __tablename__ = "notification_users"
    id = Column(Integer, primary_key=True, index=True)
    notification_id = Column(Integer, ForeignKey("notifications.id"))
    user_id = Column(Integer, ForeignKey("users.id"))
    is_viewed = Column(SmallInteger, default=0)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, onupdate=func.now())
    deleted_at = Column(DateTime, nullable=True)

    notification = relationship("Notification", back_populates="notification_users")
    user = relationship("User", back_populates="notification_users")

class Banner(Base):
    __tablename__ = "banners"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    link_url = Column(String(500), nullable=True)
    image_url = Column(String(500), nullable=False)
    status = Column(String(50), default="active")
    banner_users = relationship("BannerUsers", back_populates="banner")

class BannerUsers(Base):
    __tablename__ = "banner_users"
    id = Column(Integer, primary_key=True, index=True)
    banner_id = Column(Integer, ForeignKey("banners.id"))
    user_id = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, onupdate=func.now())
    deleted_at = Column(DateTime, nullable=True)

    banner = relationship("Banner", back_populates="banner_users")
    user = relationship("User", back_populates="banner_users")