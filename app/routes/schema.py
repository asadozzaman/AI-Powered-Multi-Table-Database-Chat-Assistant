from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.models import DatabaseConnection, SchemaVersion, User
from app.db.session import get_db
from app.dependencies import get_current_user, require_roles
from app.schema_rag.service import get_active_schema, refresh_schema


router = APIRouter(prefix="/schema", tags=["schema"])


def _connection(db: Session, connection_id: int | None) -> DatabaseConnection:
    query = db.query(DatabaseConnection)
    conn = query.filter(DatabaseConnection.id == connection_id).first() if connection_id else query.filter(DatabaseConnection.is_default.is_(True)).first()
    if not conn:
        conn = query.order_by(DatabaseConnection.created_at.desc()).first()
    if not conn:
        raise HTTPException(status_code=404, detail="No database connection configured")
    return conn


@router.get("/tables")
def tables(connection_id: int | None = None, db: Session = Depends(get_db), _: User = Depends(get_current_user)) -> dict:
    conn = _connection(db, connection_id)
    version = get_active_schema(db, conn.id)
    if not version:
        version = refresh_schema(db, conn)
    return {"connection_id": conn.id, "schema_hash": version.schema_hash, "tables": version.metadata_json.get("tables", [])}


@router.get("/relationships")
def relationships(connection_id: int | None = None, db: Session = Depends(get_db), _: User = Depends(get_current_user)) -> dict:
    conn = _connection(db, connection_id)
    version = get_active_schema(db, conn.id)
    if not version:
        version = refresh_schema(db, conn)
    return {"connection_id": conn.id, "relationships": version.metadata_json.get("relationships", [])}


@router.post("/refresh")
def refresh(connection_id: int | None = None, db: Session = Depends(get_db), _: User = Depends(require_roles("admin"))) -> dict:
    conn = _connection(db, connection_id)
    version = refresh_schema(db, conn)
    return {"connection_id": conn.id, "schema_hash": version.schema_hash, "changes": version.change_summary}


@router.get("/versions")
def versions(connection_id: int | None = None, db: Session = Depends(get_db), _: User = Depends(get_current_user)) -> list[dict]:
    conn = _connection(db, connection_id)
    rows = (
        db.query(SchemaVersion)
        .filter(SchemaVersion.connection_id == conn.id)
        .order_by(SchemaVersion.created_at.desc())
        .all()
    )
    return [
        {
            "id": row.id,
            "schema_hash": row.schema_hash,
            "is_active": row.is_active,
            "changes": row.change_summary,
            "created_at": row.created_at.isoformat(),
        }
        for row in rows
    ]


@router.get("/changes")
def changes(connection_id: int | None = None, db: Session = Depends(get_db), _: User = Depends(get_current_user)) -> dict:
    conn = _connection(db, connection_id)
    version = get_active_schema(db, conn.id)
    return {"connection_id": conn.id, "changes": version.change_summary if version else None}
