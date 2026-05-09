from __future__ import annotations

from typing import Any


def recommend_chart(rows: list[dict[str, Any]], columns: list[str]) -> dict[str, Any]:
    if not rows or len(columns) == 0:
        return {"type": "table", "x": None, "y": None}
    numeric_columns = [
        col for col in columns if any(isinstance(row.get(col), (int, float)) and not isinstance(row.get(col), bool) for row in rows)
    ]
    text_columns = [col for col in columns if col not in numeric_columns]
    if len(rows) <= 8 and len(numeric_columns) == 1 and text_columns:
        return {"type": "pie", "x": text_columns[0], "y": numeric_columns[0]}
    if text_columns and numeric_columns:
        return {"type": "bar", "x": text_columns[0], "y": numeric_columns[0]}
    return {"type": "table", "x": None, "y": None}


def generate_answer(question: str, rows: list[dict[str, Any]], columns: list[str]) -> dict[str, Any]:
    row_count = len(rows)
    important_numbers: dict[str, Any] = {}
    for col in columns:
        values = [row.get(col) for row in rows if isinstance(row.get(col), (int, float)) and not isinstance(row.get(col), bool)]
        if values:
            important_numbers[col] = {"min": min(values), "max": max(values), "sum": sum(values)}

    if row_count == 0:
        direct = "No matching records were found."
    elif row_count == 1 and columns:
        direct = f"Found one result for: {question}"
    else:
        direct = f"Found {row_count} rows for: {question}"

    return {
        "direct_answer": direct,
        "explanation": "The answer is based on a safe read-only SQL query over the inspected database schema.",
        "important_numbers": important_numbers,
        "trends_or_comparisons": "Review the chart recommendation for visible comparisons." if row_count > 1 else None,
        "result_table": {"columns": columns, "rows": rows},
        "chart": recommend_chart(rows, columns),
        "business_insight": _business_insight(rows, columns, important_numbers),
    }


def _business_insight(rows: list[dict[str, Any]], columns: list[str], numbers: dict[str, Any]) -> str:
    if not rows:
        return "There is no result data to interpret yet."
    if numbers:
        first_metric = next(iter(numbers))
        metric = numbers[first_metric]
        return f"{first_metric} ranges from {metric['min']} to {metric['max']}, with a total of {metric['sum']} across the returned rows."
    return f"The returned records expose {len(columns)} fields that can be filtered, grouped, or compared in follow-up questions."
