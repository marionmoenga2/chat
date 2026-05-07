import os

from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# Use DATABASE_URL if provided (PostgreSQL on Render)
# Otherwise use SQLite in /tmp/ (ephemeral, gets wiped on restart)
DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    # Use /tmp/ for SQLite on Render (fresh every deploy)
    # Use ./chat.db for local development
    if os.getenv("RENDER"):
        DATABASE_URL = "sqlite:////tmp/chat.db"
    else:
        DATABASE_URL = "sqlite:///./chat.db"

if DATABASE_URL.startswith("sqlite"):
    engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
else:
    engine = create_engine(DATABASE_URL)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def init_db():
    from . import models
    Base.metadata.create_all(bind=engine)
