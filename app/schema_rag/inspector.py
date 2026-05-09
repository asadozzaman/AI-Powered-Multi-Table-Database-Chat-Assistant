from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.engine import Engine
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.sql.compiler import IdentifierPreparer


@dataclass(frozen=True)
class SchemaSnapshot:
    dialect: str
    tables: list[dict[str, Any]]
    relationships: list[dict[str, Any]]

    def as_dict(self) -> dict[str, Any]:
        return {"dialect": self.dialect, "tables": self.tables, "relationships": self.relationships}


def make_engine(connection_url: str) -> Engine:
    return create_engine(connection_url, pool_pre_ping=True)


def _qualified_table(preparer: IdentifierPreparer, table: str, schema: str | None) -> str:
    if schema:
        return f"{preparer.quote_schema(schema)}.{preparer.quote(table)}"
    return preparer.quote(table)


def _sample_rows(engine: Engine, table: str, schema: str | None, limit: int = 3) -> list[dict[str, Any]]:
    preparer = engine.dialect.identifier_preparer
    query = text(f"SELECT * FROM {_qualified_table(preparer, table, schema)} LIMIT :limit")
    try:
        with engine.connect() as conn:
            rows = conn.execute(query, {"limit": limit}).mappings().all()
            return [dict(row) for row in rows]
    except SQLAlchemyError:
        return []


def _safe_row_count(engine: Engine, table: str, schema: str | None) -> int | None:
    preparer = engine.dialect.identifier_preparer
    query = text(f"SELECT COUNT(*) AS row_count FROM {_qualified_table(preparer, table, schema)}")
    try:
        with engine.connect() as conn:
            row = conn.execute(query).mappings().first()
            return int(row["row_count"]) if row else None
    except SQLAlchemyError:
        return None


def inspect_database(connection_url: str, include_schemas: list[str] | None = None) -> SchemaSnapshot:
    """Inspect a relational database without assuming any fixed table layout."""

    engine = make_engine(connection_url)
    inspector = inspect(engine)
    dialect = engine.dialect.name
    schemas = include_schemas or [None]
    if include_schemas is None and dialect == "postgresql":
        schemas = ["public"]

    tables: list[dict[str, Any]] = []
    relationships: list[dict[str, Any]] = []

    for schema in schemas:
        for table_name in inspector.get_table_names(schema=schema):
            columns = []
            for col in inspector.get_columns(table_name, schema=schema):
                columns.append(
                    {
                        "name": col["name"],
                        "type": str(col.get("type")),
                        "nullable": bool(col.get("nullable", True)),
                        "default": str(col.get("default")) if col.get("default") is not None else None,
                    }
                )

            pk = inspector.get_pk_constraint(table_name, schema=schema) or {}
            indexes = inspector.get_indexes(table_name, schema=schema) or []
            foreign_keys = inspector.get_foreign_keys(table_name, schema=schema) or []
            normalized_fks = []

            for fk in foreign_keys:
                fk_record = {
                    "name": fk.get("name"),
                    "source_table": table_name,
                    "source_schema": schema,
                    "source_columns": fk.get("constrained_columns", []),
                    "target_table": fk.get("referred_table"),
                    "target_schema": fk.get("referred_schema") or schema,
                    "target_columns": fk.get("referred_columns", []),
                }
                normalized_fks.append(fk_record)
                relationships.append(fk_record)

            tables.append(
                {
                    "schema": schema,
                    "name": table_name,
                    "columns": columns,
                    "primary_key": pk.get("constrained_columns", []),
                    "foreign_keys": normalized_fks,
                    "indexes": [
                        {
                            "name": idx.get("name"),
                            "columns": idx.get("column_names", []),
                            "unique": bool(idx.get("unique", False)),
                        }
                        for idx in indexes
                    ],
                    "sample_rows": _sample_rows(engine, table_name, schema),
                    "row_count": _safe_row_count(engine, table_name, schema),
                }
            )

    return SchemaSnapshot(dialect=dialect, tables=tables, relationships=relationships)
