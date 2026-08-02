from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker
from app.config import get_settings

settings = get_settings()
is_sqlite = settings.database_url.startswith("sqlite")

engine_options = {"pool_pre_ping": True}
if is_sqlite:
    engine_options["connect_args"] = {"check_same_thread": False}
else:
    # Serverless runs many short-lived instances at once, so each keeps only a
    # couple of connections and recycles them quickly. Point DATABASE_URL at a
    # pooled endpoint (Neon's "-pooler" host) so the pooler absorbs the churn.
    engine_options |= {"pool_size": 2, "max_overflow": 3, "pool_recycle": 300}

engine = create_engine(settings.sqlalchemy_url, **engine_options)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
