from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.db.models import DatabaseConnection, User
from app.db.session import SessionLocal, init_db
from app.auth.security import hash_password
from app.routes import auth, chat, data, database, health, history, schema


def create_app() -> FastAPI:
    settings = get_settings()
    api = FastAPI(title="AI-Powered Multi-Table Database Chat Assistant", version="3.0.0-mvp")
    api.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "Accept"],
    )
    api.include_router(health.router)
    api.include_router(auth.router)
    api.include_router(database.router)
    api.include_router(data.router)
    api.include_router(schema.router)
    api.include_router(chat.router)
    api.include_router(history.router)

    @api.on_event("startup")
    def startup() -> None:
        init_db()
        _seed_dev_defaults(settings.target_database_url)

    return api


def _seed_dev_defaults(target_database_url: str | None) -> None:
    db = SessionLocal()
    try:
        if not db.query(User).filter(User.email == "admin@example.com").first():
            db.add(
                User(
                    email="admin@example.com",
                    full_name="Demo Admin",
                    role="admin",
                    hashed_password=hash_password("admin123"),
                )
            )
        if target_database_url and not db.query(DatabaseConnection).first():
            db.add(
                DatabaseConnection(
                    name="Demo Business Database",
                    dialect="postgresql",
                    connection_url=target_database_url,
                    is_default=True,
                )
            )
        db.commit()
    finally:
        db.close()


app = create_app()
