from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# Local SQLite Database for MVP portability (Can easily swap to PostgreSQL in production via env)
DATABASE_URL = "sqlite:///./valkyrie_lending.db"

# connect_args={"check_same_thread": False} is required only for SQLite
engine = create_engine(
    DATABASE_URL, connect_args={"check_same_thread": False}
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    """
    Dependency generator to yield database sessions per request and automatically close them.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
