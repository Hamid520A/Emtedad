import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
import os
import sys

# Add the project root to python path to import app modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.main import app
from app.database import Base, get_db
from app import models, auth

# Setup in-memory SQLite for testing
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)

@pytest.fixture(scope="session", autouse=True)
def setup_database():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    
    user = models.User(first_name="Test", last_name="User", phone_number="09123456789")
    db.add(user)
    
    contest = models.Contest(title="Test Contest", status="active")
    db.add(contest)
    db.flush()
    
    q1 = models.Question(title="Q1", contest_id=contest.id)
    q2 = models.Question(title="Q2", contest_id=contest.id)
    db.add_all([q1, q2])
    db.flush()
    
    # Q1: A1 (Correct), A2 (Wrong)
    # Q2: A3 (Wrong), A4 (Correct)
    db.add_all([
        models.Answer(title="A1", question_id=q1.id, is_correct=1),
        models.Answer(title="A2", question_id=q1.id, is_correct=0),
        models.Answer(title="A3", question_id=q2.id, is_correct=0),
        models.Answer(title="A4", question_id=q2.id, is_correct=1),
    ])
    
    db.commit()
    db.close()
    
    yield
    Base.metadata.drop_all(bind=engine)

@pytest.fixture(autouse=True)
def clear_subscriptions():
    db = TestingSessionLocal()
    db.query(models.SubscriptionAnswer).delete()
    db.query(models.SubscriptionQuestions).delete()
    db.query(models.Subscription).delete()
    db.commit()
    db.close()
    yield

@pytest.fixture(autouse=True)
def mock_current_user():
    def override_get_current_user():
        db = TestingSessionLocal()
        user = db.query(models.User).filter_by(phone_number="09123456789").first()
        db.close()
        return user
        
    app.dependency_overrides[auth.get_current_user] = override_get_current_user
    yield
    app.dependency_overrides.pop(auth.get_current_user, None)

def test_submit_exam_happy_path():
    db = TestingSessionLocal()
    contest = db.query(models.Contest).first()
    q1 = db.query(models.Question).filter_by(title="Q1").first()
    q2 = db.query(models.Question).filter_by(title="Q2").first()
    a1 = db.query(models.Answer).filter_by(title="A1").first() # Correct
    a3 = db.query(models.Answer).filter_by(title="A3").first() # Wrong
    db.close()

    payload = {
        "contest_id": contest.id,
        "time_limit": 60,
        "certificate_type": "none",
        "answers_map": {
            str(q1.id): a1.id,
            str(q2.id): a3.id
        }
    }
    
    response = client.post("/subscriptions", json=payload)
    assert response.status_code == 200
    assert response.json()["status"] == "success"
    
    db = TestingSessionLocal()
    sub = db.query(models.Subscription).filter_by(user_id=1, contest_id=contest.id).first()
    assert sub is not None
    assert sub.score == 50 # (1 correct out of 2) = 50%
    db.close()

def test_submit_exam_spoofing_protection():
    db = TestingSessionLocal()
    contest = db.query(models.Contest).first()
    q1 = db.query(models.Question).filter_by(title="Q1").first()
    q2 = db.query(models.Question).filter_by(title="Q2").first()
    a2 = db.query(models.Answer).filter_by(title="A2").first() # Wrong
    a3 = db.query(models.Answer).filter_by(title="A3").first() # Wrong
    db.close()

    payload = {
        "contest_id": contest.id,
        "time_limit": 60,
        "certificate_type": "none",
        "score": 100, # Client attempts to spoof a perfect score
        "answers_map": {
            str(q1.id): a2.id,
            str(q2.id): a3.id
        }
    }
    
    response = client.post("/subscriptions", json=payload)
    assert response.status_code == 200
    
    db = TestingSessionLocal()
    sub = db.query(models.Subscription).filter_by(user_id=1, contest_id=contest.id).first()
    assert sub is not None
    assert sub.score == 0 # Server overrides spoofed score, calculates 0% correctly
    db.close()

def test_submit_exam_double_submit_protection():
    db = TestingSessionLocal()
    contest = db.query(models.Contest).first()
    q1 = db.query(models.Question).filter_by(title="Q1").first()
    a1 = db.query(models.Answer).filter_by(title="A1").first()
    db.close()

    payload = {
        "contest_id": contest.id,
        "time_limit": 60,
        "certificate_type": "none",
        "answers_map": {
            str(q1.id): a1.id
        }
    }
    
    # Request 1: Should succeed
    response1 = client.post("/subscriptions", json=payload)
    assert response1.status_code == 200
    
    # Request 2: Duplicate submission should be rejected gracefully
    response2 = client.post("/subscriptions", json=payload)
    assert response2.status_code == 400
    assert "قبلاً در این آزمون شرکت کرده‌اید" in response2.json()["detail"]
