from typing import Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.data.service import DynamicDataService
from app.db.models import DatabaseConnection, User
from app.db.session import get_db
from app.dependencies import get_current_user, require_roles
from app.routes.schema import _connection
from app.schema_rag.service import get_active_schema, refresh_schema


router = APIRouter(prefix="/data", tags=["data"])


class RowCreateRequest(BaseModel):
    values: dict[str, Any] = Field(default_factory=dict)
    connection_id: int | None = None


class RowUpdateRequest(BaseModel):
    pk: dict[str, Any] = Field(default_factory=dict)
    values: dict[str, Any] = Field(default_factory=dict)
    connection_id: int | None = None


class RowDeleteRequest(BaseModel):
    pk: dict[str, Any] = Field(default_factory=dict)
    connection_id: int | None = None


def _service(db: Session, connection_id: int | None) -> tuple[DatabaseConnection, DynamicDataService]:
    connection = _connection(db, connection_id)
    version = get_active_schema(db, connection.id)
    if not version:
        version = refresh_schema(db, connection)
    return connection, DynamicDataService(connection.connection_url, version.metadata_json)


@router.get("/tables")
def data_tables(connection_id: int | None = None, db: Session = Depends(get_db), _: User = Depends(get_current_user)) -> dict:
    connection, service = _service(db, connection_id)
    return {"connection_id": connection.id, "tables": service.list_tables()}


@router.get("/{table_name}/rows")
def data_rows(
    table_name: str,
    connection_id: int | None = None,
    limit: int = 100,
    offset: int = 0,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> dict:
    _, service = _service(db, connection_id)
    return service.get_rows(table_name, limit, offset)


@router.post("/{table_name}/rows")
def create_data_row(
    table_name: str,
    payload: RowCreateRequest,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("admin")),
) -> dict:
    _, service = _service(db, payload.connection_id)
    return service.create_row(table_name, payload.values)


@router.patch("/{table_name}/rows")
def update_data_row(
    table_name: str,
    payload: RowUpdateRequest,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("admin")),
) -> dict:
    _, service = _service(db, payload.connection_id)
    return service.update_row(table_name, payload.pk, payload.values)


@router.delete("/{table_name}/rows")
def delete_data_row(
    table_name: str,
    payload: RowDeleteRequest,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("admin")),
) -> dict:
    _, service = _service(db, payload.connection_id)
    return service.delete_row(table_name, payload.pk)
