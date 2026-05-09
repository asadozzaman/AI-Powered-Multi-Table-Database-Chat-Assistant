from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db.models import DatabaseConnection, User
from app.db.session import get_db
from app.dependencies import get_current_user, require_roles
from app.schema_rag.service import get_active_schema, refresh_schema


router = APIRouter(prefix="/database", tags=["database"])


class DatabaseConnectRequest(BaseModel):
    name: str
    connection_url: str
    is_default: bool = False


class DatabaseOut(BaseModel):
    id: int
    name: str
    dialect: str
    is_default: bool
    has_active_schema: bool = False

    model_config = {"from_attributes": True}


@router.post("/connect", response_model=DatabaseOut)
def connect_database(
    payload: DatabaseConnectRequest,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("admin")),
) -> DatabaseOut:
    try:
        engine = create_engine(payload.connection_url, pool_pre_ping=True)
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        dialect = engine.dialect.name
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Could not connect to target database") from exc

    if payload.is_default:
        db.query(DatabaseConnection).update({DatabaseConnection.is_default: False})

    connection = DatabaseConnection(
        name=payload.name,
        connection_url=payload.connection_url,
        dialect=dialect,
        is_default=payload.is_default,
        created_by_id=user.id,
    )
    db.add(connection)
    db.commit()
    db.refresh(connection)
    refresh_schema(db, connection)
    return DatabaseOut.model_validate({**connection.__dict__, "has_active_schema": True})


@router.get("/list", response_model=list[DatabaseOut])
def list_databases(db: Session = Depends(get_db), _: User = Depends(get_current_user)) -> list[DatabaseOut]:
    connections = db.query(DatabaseConnection).order_by(DatabaseConnection.created_at.desc()).all()
    return [
        DatabaseOut.model_validate({**conn.__dict__, "has_active_schema": get_active_schema(db, conn.id) is not None})
        for conn in connections
    ]


@router.get("/status")
def database_status(db: Session = Depends(get_db), _: User = Depends(get_current_user)) -> dict:
    settings = get_settings()
    count = db.query(DatabaseConnection).count()
    return {
        "configured_connections": count,
        "default_target_from_env": bool(settings.target_database_url),
        "app_env": settings.app_env,
    }
