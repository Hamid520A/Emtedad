from app.database import engine
from app.models import Base

print("reseting database...")
Base.metadata.drop_all(bind=engine)

print("creating tables...")
Base.metadata.create_all(bind=engine)

print("DONE!")