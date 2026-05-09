from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from sqlalchemy import create_engine, text
from sqlalchemy.exc import SQLAlchemyError


@dataclass
class SQLExecutionResult:
    ok: bool
    rows: list[dict[str, Any]]
    columns: list[str]
    error: str | None = None


class SQLExecutor:
    def __init__(self, connection_url: str, timeout_seconds: int) -> None:
        self.engine = create_engine(connection_url, pool_pre_ping=True)
        self.timeout_seconds = timeout_seconds

    def execute(self, sql: str) -> SQLExecutionResult:
        try:
            with self.engine.connect() as conn:
                if self.engine.dialect.name == "postgresql":
                    conn.execute(text("SET TRANSACTION READ ONLY"))
                    conn.execute(text("SET LOCAL statement_timeout = :timeout_ms"), {"timeout_ms": self.timeout_seconds * 1000})
                result = conn.execute(text(sql))
                rows = [dict(row) for row in result.mappings().all()]
                columns = list(result.keys())
                return SQLExecutionResult(ok=True, rows=rows, columns=columns)
        except SQLAlchemyError as exc:
            return SQLExecutionResult(ok=False, rows=[], columns=[], error=str(exc.__class__.__name__))
