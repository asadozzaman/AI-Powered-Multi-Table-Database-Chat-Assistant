from __future__ import annotations

from typing import Any

from fastapi import HTTPException
from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine
from sqlalchemy.exc import SQLAlchemyError


class DynamicDataService:
    """Structured CRUD operations over inspected target database tables."""

    def __init__(self, connection_url: str, schema: dict[str, Any]) -> None:
        self.engine = create_engine(connection_url, pool_pre_ping=True)
        self.schema = schema
        self.tables = {table["name"]: table for table in schema.get("tables", [])}

    def list_tables(self) -> list[dict[str, Any]]:
        return [
            {
                "name": table["name"],
                "schema": table.get("schema"),
                "columns": table.get("columns", []),
                "primary_key": table.get("primary_key", []),
                "row_count": table.get("row_count"),
            }
            for table in self.schema.get("tables", [])
        ]

    def get_rows(self, table_name: str, limit: int, offset: int) -> dict[str, Any]:
        table = self._table(table_name)
        safe_limit = max(1, min(limit, 500))
        safe_offset = max(0, offset)
        qualified = self._qualified_table(table)
        order_clause = self._order_clause(table)

        with self.engine.connect() as conn:
            rows = conn.execute(
                text(f"SELECT * FROM {qualified}{order_clause} LIMIT :limit OFFSET :offset"),
                {"limit": safe_limit, "offset": safe_offset},
            ).mappings().all()
            total = conn.execute(text(f"SELECT COUNT(*) AS row_count FROM {qualified}")).mappings().first()

        return {
            "table": table_name,
            "columns": table.get("columns", []),
            "primary_key": table.get("primary_key", []),
            "rows": [dict(row) for row in rows],
            "limit": safe_limit,
            "offset": safe_offset,
            "total": int(total["row_count"]) if total else None,
        }

    def create_row(self, table_name: str, values: dict[str, Any]) -> dict[str, Any]:
        table = self._table(table_name)
        clean_values = self._clean_values(table, values, allow_empty=False)
        qualified = self._qualified_table(table)
        columns = list(clean_values)
        column_sql = ", ".join(self._quote(col) for col in columns)
        value_sql = ", ".join(f":{col}" for col in columns)

        try:
            with self.engine.begin() as conn:
                result = conn.execute(
                    text(f"INSERT INTO {qualified} ({column_sql}) VALUES ({value_sql}) RETURNING *"),
                    clean_values,
                ).mappings().first()
                return {"table": table_name, "row": dict(result) if result else clean_values}
        except SQLAlchemyError as exc:
            raise HTTPException(status_code=400, detail=_safe_db_error(exc)) from exc

    def update_row(self, table_name: str, pk: dict[str, Any], values: dict[str, Any]) -> dict[str, Any]:
        table = self._table(table_name)
        self._validate_pk(table, pk)
        clean_values = self._clean_values(table, values, allow_empty=False)
        for pk_col in table.get("primary_key", []):
            clean_values.pop(pk_col, None)
        if not clean_values:
            raise HTTPException(status_code=400, detail="No editable values provided")

        qualified = self._qualified_table(table)
        set_sql = ", ".join(f"{self._quote(col)} = :value_{col}" for col in clean_values)
        where_sql = self._where_pk_sql(table)
        params = {f"value_{col}": value for col, value in clean_values.items()}
        params.update({f"pk_{col}": value for col, value in pk.items()})

        try:
            with self.engine.begin() as conn:
                result = conn.execute(
                    text(f"UPDATE {qualified} SET {set_sql} WHERE {where_sql} RETURNING *"),
                    params,
                ).mappings().first()
                if not result:
                    raise HTTPException(status_code=404, detail="Row not found")
                return {"table": table_name, "row": dict(result)}
        except HTTPException:
            raise
        except SQLAlchemyError as exc:
            raise HTTPException(status_code=400, detail=_safe_db_error(exc)) from exc

    def delete_row(self, table_name: str, pk: dict[str, Any]) -> dict[str, Any]:
        table = self._table(table_name)
        self._validate_pk(table, pk)
        qualified = self._qualified_table(table)
        where_sql = self._where_pk_sql(table)
        params = {f"pk_{col}": value for col, value in pk.items()}

        try:
            with self.engine.begin() as conn:
                result = conn.execute(text(f"DELETE FROM {qualified} WHERE {where_sql}"), params)
                if result.rowcount == 0:
                    raise HTTPException(status_code=404, detail="Row not found")
                return {"table": table_name, "deleted": True, "row_count": result.rowcount}
        except HTTPException:
            raise
        except SQLAlchemyError as exc:
            raise HTTPException(status_code=400, detail=_safe_db_error(exc)) from exc

    def _table(self, table_name: str) -> dict[str, Any]:
        table = self.tables.get(table_name)
        if not table:
            raise HTTPException(status_code=404, detail="Unknown table")
        return table

    def _known_columns(self, table: dict[str, Any]) -> set[str]:
        return {column["name"] for column in table.get("columns", [])}

    def _clean_values(self, table: dict[str, Any], values: dict[str, Any], allow_empty: bool) -> dict[str, Any]:
        known_columns = self._known_columns(table)
        unknown = sorted(set(values) - known_columns)
        if unknown:
            raise HTTPException(status_code=400, detail=f"Unknown column(s): {', '.join(unknown)}")
        clean_values = dict(values)
        if not clean_values and not allow_empty:
            raise HTTPException(status_code=400, detail="No values provided")
        return clean_values

    def _validate_pk(self, table: dict[str, Any], pk: dict[str, Any]) -> None:
        pk_columns = table.get("primary_key", [])
        if not pk_columns:
            raise HTTPException(status_code=400, detail="Table has no primary key; row update/delete is disabled")
        missing = [column for column in pk_columns if column not in pk]
        if missing:
            raise HTTPException(status_code=400, detail=f"Missing primary key column(s): {', '.join(missing)}")
        extra = sorted(set(pk) - set(pk_columns))
        if extra:
            raise HTTPException(status_code=400, detail=f"Unknown primary key column(s): {', '.join(extra)}")

    def _where_pk_sql(self, table: dict[str, Any]) -> str:
        return " AND ".join(f"{self._quote(col)} = :pk_{col}" for col in table.get("primary_key", []))

    def _order_clause(self, table: dict[str, Any]) -> str:
        pk_columns = table.get("primary_key", [])
        if not pk_columns:
            return ""
        return " ORDER BY " + ", ".join(self._quote(column) for column in pk_columns)

    def _qualified_table(self, table: dict[str, Any]) -> str:
        preparer = self.engine.dialect.identifier_preparer
        table_name = preparer.quote(table["name"])
        schema = table.get("schema")
        if schema:
            return f"{preparer.quote_schema(schema)}.{table_name}"
        return table_name

    def _quote(self, identifier: str) -> str:
        return self.engine.dialect.identifier_preparer.quote(identifier)


def _safe_db_error(exc: SQLAlchemyError) -> str:
    original = getattr(exc, "orig", None)
    if original:
        return str(original).splitlines()[0][:240]
    return exc.__class__.__name__
