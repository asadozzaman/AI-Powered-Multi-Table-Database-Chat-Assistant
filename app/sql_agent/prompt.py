from __future__ import annotations

from typing import Any


def build_sql_prompt(
    question: str,
    schema_chunks: list[dict[str, Any]],
    join_context: str,
    dialect: str,
    max_rows: int,
) -> str:
    context = "\n\n".join(f"[{chunk['type']}] {chunk['text']}" for chunk in schema_chunks)
    return f"""
You generate read-only SQL for a relational database.

User question:
{question}

Database dialect:
{dialect}

Relevant schema context:
{context}

Relationship and join path context:
{join_context}

Safety rules:
- Return exactly one SQL statement.
- The SQL must be SELECT-only.
- Do not include comments, markdown, prose, DDL, DML, permissions, temp tables, or multiple statements.
- Use only tables and columns in the provided schema context.
- Prefer explicit JOIN clauses when multiple tables are needed.
- Include LIMIT {max_rows} unless the query aggregates to one small result set.

Output SQL only.
""".strip()


def build_fix_prompt(
    question: str,
    failed_sql: str,
    error: str,
    schema_chunks: list[dict[str, Any]],
    join_context: str,
    dialect: str,
    max_rows: int,
) -> str:
    base = build_sql_prompt(question, schema_chunks, join_context, dialect, max_rows)
    return f"""
{base}

The previous SQL failed.
Failed SQL:
{failed_sql}

Database error:
{error}

Return a corrected SQL statement only.
""".strip()
