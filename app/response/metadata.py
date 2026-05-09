from __future__ import annotations

import time
from typing import Any

from app.config import Settings
from app.sql_agent.validator import SQLValidationResult


def estimate_tokens(text: str | None) -> int:
    if not text:
        return 0
    return max(1, round(len(text) / 4))


def build_run_details(
    *,
    settings: Settings,
    started_at: float,
    prompt: str,
    generated_sql: str | None,
    answer: dict[str, Any],
    schema_chunks: list[dict[str, Any]],
    row_count: int,
    retry_count: int,
    execution_ok: bool,
) -> dict[str, Any]:
    input_tokens = estimate_tokens(prompt)
    output_tokens = estimate_tokens(generated_sql) + estimate_tokens(answer.get("direct_answer")) + estimate_tokens(answer.get("explanation"))
    schema_context_tokens = sum(estimate_tokens(chunk.get("text")) for chunk in schema_chunks)
    total_tokens = input_tokens + output_tokens
    estimated_cost = _estimated_cost(
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        input_rate=settings.llm_input_cost_per_1m_tokens,
        output_rate=settings.llm_output_cost_per_1m_tokens,
    )

    return {
        "provider": settings.llm_provider,
        "model": settings.llm_model,
        "token_usage": {
            "input_tokens_estimate": input_tokens,
            "output_tokens_estimate": output_tokens,
            "schema_context_tokens_estimate": schema_context_tokens,
            "total_tokens_estimate": total_tokens,
            "estimated": True,
        },
        "estimated_cost_usd": estimated_cost,
        "pricing": {
            "input_cost_per_1m_tokens": settings.llm_input_cost_per_1m_tokens,
            "output_cost_per_1m_tokens": settings.llm_output_cost_per_1m_tokens,
            "configured": settings.llm_input_cost_per_1m_tokens > 0 or settings.llm_output_cost_per_1m_tokens > 0,
        },
        "latency_ms": round((time.perf_counter() - started_at) * 1000),
        "llm_calls": 1 + retry_count,
        "auto_fix_attempts": retry_count,
        "rows_returned": row_count,
        "max_rows": settings.max_sql_rows,
        "execution_ok": execution_ok,
    }


def build_schema_sources(
    *,
    chunks: list[dict[str, Any]],
    relevant_tables: list[str],
    join_paths: list[dict[str, Any]],
    schema_hash: str,
) -> dict[str, Any]:
    return {
        "schema_hash": schema_hash,
        "tables": relevant_tables,
        "join_paths": join_paths,
        "chunks": [
            {
                "id": chunk.get("id"),
                "type": chunk.get("type"),
                "score": round(float(chunk.get("score", 0)), 4),
                "tables": chunk.get("metadata", {}).get("tables", []),
            }
            for chunk in chunks[:8]
        ],
    }


def build_sql_safety_status(validation: SQLValidationResult, *, timeout_seconds: int, read_only_connection: bool = True) -> dict[str, Any]:
    return {
        "is_select_only": validation.is_safe,
        "destructive_sql_blocked": True,
        "multiple_statements_blocked": True,
        "comments_blocked": True,
        "identifiers_validated": validation.is_safe,
        "limit_applied": validation.limit_applied,
        "max_limit_enforced": validation.max_limit_enforced,
        "timeout_seconds": timeout_seconds,
        "read_only_connection": read_only_connection,
        "used_tables": validation.used_tables or [],
        "status": "passed" if validation.is_safe else "blocked",
        "error": validation.error,
    }


def build_confidence_and_assumptions(
    *,
    question: str,
    safe_sql: str | None,
    row_count: int,
    retry_count: int,
    relevant_tables: list[str],
) -> dict[str, Any]:
    confidence = 0.88
    if row_count == 0:
        confidence -= 0.18
    if retry_count:
        confidence -= 0.1
    if not relevant_tables:
        confidence -= 0.15

    assumptions = [
        "The answer is based on the currently active inspected schema version.",
        "Only rows returned by the validated SQL query are summarized.",
    ]
    if safe_sql and "limit" in safe_sql.lower():
        assumptions.append("The result may be capped by the configured row limit.")
    if any(word in question.lower() for word in ["sales", "revenue", "total"]):
        assumptions.append("Financial totals depend on the columns selected by the SQL generator for this schema.")
    if relevant_tables:
        assumptions.append(f"Relevant table context came from: {', '.join(relevant_tables)}.")

    return {
        "score": round(max(0.1, min(confidence, 0.98)), 2),
        "label": _confidence_label(confidence),
        "assumptions": assumptions,
    }


def build_follow_up_questions(question: str, relevant_tables: list[str], columns: list[str]) -> list[str]:
    table_hint = relevant_tables[0] if relevant_tables else "these results"
    metric_hint = columns[0] if columns else "this metric"
    return [
        f"Break {metric_hint} down by month.",
        f"Show the top 10 records related to {table_hint}.",
        "Compare this with the previous period.",
        "Which segments or categories contributed the most?",
    ]


def _estimated_cost(*, input_tokens: int, output_tokens: int, input_rate: float, output_rate: float) -> float | None:
    if input_rate <= 0 and output_rate <= 0:
        return None
    cost = (input_tokens / 1_000_000 * input_rate) + (output_tokens / 1_000_000 * output_rate)
    return round(cost, 6)


def _confidence_label(score: float) -> str:
    if score >= 0.8:
        return "High"
    if score >= 0.6:
        return "Medium"
    return "Low"
