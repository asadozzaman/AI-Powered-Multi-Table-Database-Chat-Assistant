from __future__ import annotations

from sqlalchemy.orm import Session

from app.db.models import DatabaseConnection, SchemaObject, SchemaVersion
from app.schema_rag.chunker import create_schema_chunks
from app.schema_rag.inspector import inspect_database
from app.schema_rag.vector_store import schema_index
from app.schema_rag.versioning import diff_schemas, schema_hash


def get_active_schema(db: Session, connection_id: int) -> SchemaVersion | None:
    return (
        db.query(SchemaVersion)
        .filter(SchemaVersion.connection_id == connection_id, SchemaVersion.is_active.is_(True))
        .order_by(SchemaVersion.created_at.desc())
        .first()
    )


def refresh_schema(db: Session, connection: DatabaseConnection) -> SchemaVersion:
    snapshot = inspect_database(connection.connection_url).as_dict()
    new_hash = schema_hash(snapshot)
    current = get_active_schema(db, connection.id)

    if current and current.schema_hash == new_hash:
        chunks = create_schema_chunks(current.metadata_json)
        schema_index.upsert_schema(connection.id, current.schema_hash, chunks)
        return current

    change_summary = diff_schemas(current.metadata_json if current else None, snapshot)
    if current:
        current.is_active = False

    version = SchemaVersion(
        connection_id=connection.id,
        schema_hash=new_hash,
        metadata_json=snapshot,
        change_summary=change_summary,
        is_active=True,
    )
    db.add(version)
    db.flush()

    chunks = create_schema_chunks(snapshot)
    for chunk in chunks:
        db.add(
            SchemaObject(
                schema_version_id=version.id,
                object_type=chunk["type"],
                object_name=chunk["id"],
                metadata_json=chunk["metadata"],
                chunk_text=chunk["text"],
            )
        )
    schema_index.upsert_schema(connection.id, new_hash, chunks)
    db.commit()
    db.refresh(version)
    return version
