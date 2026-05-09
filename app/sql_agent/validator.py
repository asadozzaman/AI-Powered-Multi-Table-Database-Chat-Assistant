from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any

import sqlglot
from sqlglot import exp


BLOCKED = re.compile(
    r"\b(DROP|DELETE|UPDATE|INSERT|ALTER|TRUNCATE|CREATE|GRANT|REVOKE|MERGE|CALL|EXEC|COPY)\b",
    re.IGNORECASE,
)
COMMENTS = re.compile(r"(--|/\*|\*/)")


@dataclass
class SQLValidationResult:
    is_safe: bool
    sql: str | None = None
    error: str | None = None
    used_tables: list[str] | None = None
    limit_applied: bool = False
    max_limit_enforced: bool = False


def _schema_maps(schema: dict[str, Any]) -> tuple[set[str], dict[str, set[str]]]:
    table_names = {table["name"] for table in schema.get("tables", [])}
    columns = {table["name"]: {c["name"] for c in table.get("columns", [])} for table in schema.get("tables", [])}
    return table_names, columns


def _sqlglot_dialect(schema: dict[str, Any]) -> str:
    dialect = schema.get("dialect") or "postgres"
    return {"postgresql": "postgres"}.get(dialect, dialect)


def validate_select_sql(sql: str, schema: dict[str, Any], max_rows: int) -> SQLValidationResult:
    candidate = sql.strip().rstrip(";")
    if not candidate:
        return SQLValidationResult(False, error="SQL is empty.")
    if COMMENTS.search(candidate):
        return SQLValidationResult(False, error="SQL comments are not allowed.")
    if ";" in candidate:
        return SQLValidationResult(False, error="Multiple SQL statements are not allowed.")
    if BLOCKED.search(candidate):
        return SQLValidationResult(False, error="Only read-only SELECT queries are allowed.")

    try:
        parsed = sqlglot.parse_one(candidate, read=_sqlglot_dialect(schema))
    except Exception as exc:
        return SQLValidationResult(False, error=f"SQL parse failed: {exc}")

    if not isinstance(parsed, exp.Select):
        return SQLValidationResult(False, error="Only SELECT queries are allowed.")

    table_names, column_map = _schema_maps(schema)
    used_tables = {table.name for table in parsed.find_all(exp.Table)}
    unknown_tables = sorted(table for table in used_tables if table not in table_names)
    if unknown_tables:
        return SQLValidationResult(False, error=f"Unknown table(s): {', '.join(unknown_tables)}")

    known_columns = set().union(*column_map.values()) if column_map else set()
    for column in parsed.find_all(exp.Column):
        column_name = column.name
        table_name = column.table
        if column_name == "*":
            continue
        if table_name and table_name in column_map and column_name not in column_map[table_name]:
            return SQLValidationResult(False, error=f"Unknown column: {table_name}.{column_name}")
        if not table_name and column_name not in known_columns:
            return SQLValidationResult(False, error=f"Unknown column: {column_name}")

    limit = parsed.args.get("limit")
    limit_applied = False
    max_limit_enforced = False
    if limit is None:
        parsed.set("limit", exp.Limit(expression=exp.Literal.number(max_rows)))
        limit_applied = True
    else:
        try:
            raw_limit = int(limit.expression.name)
        except Exception:
            raw_limit = max_rows
        if raw_limit > max_rows:
            parsed.set("limit", exp.Limit(expression=exp.Literal.number(max_rows)))
            max_limit_enforced = True

    return SQLValidationResult(
        True,
        sql=parsed.sql(dialect=_sqlglot_dialect(schema)),
        used_tables=sorted(used_tables),
        limit_applied=limit_applied,
        max_limit_enforced=max_limit_enforced,
    )
