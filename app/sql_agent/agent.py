from __future__ import annotations

import time
from typing import Any

from sqlalchemy.orm import Session

from app.config import get_settings
from app.db.models import DatabaseConnection, User
from app.dependencies import can_view_sql
from app.graph.relationship_graph import RelationshipGraph
from app.history.service import log_query
from app.response.generator import generate_answer
from app.response.metadata import (
    build_confidence_and_assumptions,
    build_follow_up_questions,
    build_run_details,
    build_schema_sources,
    build_sql_safety_status,
)
from app.schema_rag.chunker import create_schema_chunks
from app.schema_rag.service import get_active_schema, refresh_schema
from app.schema_rag.vector_store import schema_index
from app.sql_agent.executor import SQLExecutor
from app.sql_agent.llm import SQLGenerator
from app.sql_agent.prompt import build_fix_prompt, build_sql_prompt
from app.sql_agent.validator import validate_select_sql


class ChatAgent:
    def __init__(self, sql_generator: SQLGenerator | None = None) -> None:
        self.sql_generator = sql_generator or SQLGenerator()

    def ask(self, db: Session, user: User, connection: DatabaseConnection, question: str) -> dict[str, Any]:
        started_at = time.perf_counter()
        settings = get_settings()
        schema_version = get_active_schema(db, connection.id) or refresh_schema(db, connection)
        schema = schema_version.metadata_json

        chunks = schema_index.retrieve(connection.id, schema_version.schema_hash, question, top_k=10)
        if not chunks:
            chunks = create_schema_chunks(schema)
            schema_index.upsert_schema(connection.id, schema_version.schema_hash, chunks)
            chunks = schema_index.retrieve(connection.id, schema_version.schema_hash, question, top_k=10)

        graph = RelationshipGraph(schema)
        relevant_tables = graph.relevant_tables_from_chunks(chunks)
        join_paths = graph.find_join_paths(relevant_tables)
        join_context = graph.join_context_text(relevant_tables)
        prompt = build_sql_prompt(question, chunks, join_context, schema["dialect"], settings.max_sql_rows)
        generated_sql = self.sql_generator.generate(prompt, question, relevant_tables, schema, settings.max_sql_rows)
        validation = validate_select_sql(generated_sql, schema, settings.max_sql_rows)
        if not validation.is_safe:
            answer = _error_answer(validation.error or "SQL validation failed.")
            _add_response_metadata(
                answer=answer,
                settings=settings,
                started_at=started_at,
                prompt=prompt,
                generated_sql=generated_sql,
                schema_chunks=chunks,
                relevant_tables=relevant_tables,
                join_paths=join_paths,
                schema_hash=schema_version.schema_hash,
                validation=validation,
                retry_count=0,
                execution_ok=False,
            )
            history = log_query(db, user.id, connection.id, question, generated_sql, None, answer, "blocked", validation.error)
            return _role_filtered_response(answer, history.id, generated_sql, None, user.role)

        executor = SQLExecutor(connection.connection_url, settings.sql_timeout_seconds)
        execution = executor.execute(validation.sql or generated_sql)

        retry_count = 0
        safe_sql = validation.sql
        while not execution.ok and retry_count < 1:
            retry_count += 1
            fix_prompt = build_fix_prompt(
                question,
                safe_sql or generated_sql,
                execution.error or "Unknown SQL error",
                chunks,
                join_context,
                schema["dialect"],
                settings.max_sql_rows,
            )
            fixed_sql = self.sql_generator.fix(fix_prompt, safe_sql or generated_sql)
            fixed_validation = validate_select_sql(fixed_sql, schema, settings.max_sql_rows)
            if not fixed_validation.is_safe:
                break
            safe_sql = fixed_validation.sql
            execution = executor.execute(safe_sql or fixed_sql)

        if not execution.ok:
            answer = _error_answer("The query could not be executed safely. Try rephrasing the question.")
            _add_response_metadata(
                answer=answer,
                settings=settings,
                started_at=started_at,
                prompt=prompt,
                generated_sql=generated_sql,
                schema_chunks=chunks,
                relevant_tables=relevant_tables,
                join_paths=join_paths,
                schema_hash=schema_version.schema_hash,
                validation=validation,
                retry_count=retry_count,
                execution_ok=False,
                safe_sql=safe_sql,
                question=question,
            )
            history = log_query(db, user.id, connection.id, question, generated_sql, safe_sql, answer, "error", execution.error)
            return _role_filtered_response(answer, history.id, generated_sql, safe_sql, user.role)

        answer = generate_answer(question, execution.rows, execution.columns)
        _add_response_metadata(
            answer=answer,
            settings=settings,
            started_at=started_at,
            prompt=prompt,
            generated_sql=generated_sql,
            schema_chunks=chunks,
            relevant_tables=relevant_tables,
            join_paths=join_paths,
            schema_hash=schema_version.schema_hash,
            validation=validation,
            retry_count=retry_count,
            execution_ok=True,
            safe_sql=safe_sql,
            question=question,
        )
        history = log_query(db, user.id, connection.id, question, generated_sql, safe_sql, answer)
        return _role_filtered_response(answer, history.id, generated_sql, safe_sql, user.role)


def _error_answer(message: str) -> dict[str, Any]:
    return {
        "direct_answer": message,
        "explanation": "No database changes were made.",
        "important_numbers": {},
        "trends_or_comparisons": None,
        "result_table": {"columns": [], "rows": []},
        "chart": {"type": "table", "x": None, "y": None},
        "business_insight": "Ask a narrower question or refresh the schema if the database changed.",
    }


def _add_response_metadata(
    *,
    answer: dict[str, Any],
    settings: Any,
    started_at: float,
    prompt: str,
    generated_sql: str | None,
    schema_chunks: list[dict[str, Any]],
    relevant_tables: list[str],
    join_paths: list[dict[str, Any]],
    schema_hash: str,
    validation: Any,
    retry_count: int,
    execution_ok: bool,
    safe_sql: str | None = None,
    question: str = "",
) -> None:
    rows = answer.get("result_table", {}).get("rows", [])
    columns = answer.get("result_table", {}).get("columns", [])
    row_count = len(rows) if isinstance(rows, list) else 0
    answer["run_details"] = build_run_details(
        settings=settings,
        started_at=started_at,
        prompt=prompt,
        generated_sql=generated_sql,
        answer=answer,
        schema_chunks=schema_chunks,
        row_count=row_count,
        retry_count=retry_count,
        execution_ok=execution_ok,
    )
    answer["schema_sources"] = build_schema_sources(
        chunks=schema_chunks,
        relevant_tables=relevant_tables,
        join_paths=join_paths,
        schema_hash=schema_hash,
    )
    answer["sql_safety_status"] = build_sql_safety_status(
        validation,
        timeout_seconds=settings.sql_timeout_seconds,
    )
    answer["confidence"] = build_confidence_and_assumptions(
        question=question,
        safe_sql=safe_sql or generated_sql,
        row_count=row_count,
        retry_count=retry_count,
        relevant_tables=relevant_tables,
    )
    answer["follow_up_questions"] = build_follow_up_questions(question, relevant_tables, columns)


def _role_filtered_response(
    answer: dict[str, Any],
    history_id: int,
    generated_sql: str | None,
    safe_sql: str | None,
    role: str,
) -> dict[str, Any]:
    response = {"history_id": history_id, **answer}
    if can_view_sql(role):
        response["sql"] = safe_sql or generated_sql
    return response
