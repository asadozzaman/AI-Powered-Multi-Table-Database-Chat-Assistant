from __future__ import annotations

from typing import Any


def _column_names(table: dict[str, Any]) -> str:
    return ", ".join(f"{c['name']} ({c['type']})" for c in table.get("columns", []))


def create_schema_chunks(schema: dict[str, Any]) -> list[dict[str, Any]]:
    """Create Schema-RAG chunks for tables, columns, relationships, values, meaning, and examples."""

    chunks: list[dict[str, Any]] = []
    relationships = schema.get("relationships", [])

    for table in schema.get("tables", []):
        table_name = table["name"]
        columns = table.get("columns", [])
        pk = ", ".join(table.get("primary_key", [])) or "none declared"
        fk_lines = [
            f"{rel['source_table']}.{','.join(rel['source_columns'])} references "
            f"{rel['target_table']}.{','.join(rel['target_columns'])}"
            for rel in table.get("foreign_keys", [])
        ]

        chunks.append(
            {
                "id": f"{table_name}:table-summary",
                "type": "table_summary",
                "text": (
                    f"Table {table_name} has {len(columns)} columns, primary key {pk}, "
                    f"approximately {table.get('row_count')} rows. Columns: {_column_names(table)}."
                ),
                "metadata": {"tables": [table_name], "columns": [c["name"] for c in columns]},
            }
        )
        chunks.append(
            {
                "id": f"{table_name}:column-summary",
                "type": "column_summary",
                "text": "\n".join(
                    f"Column {table_name}.{c['name']} stores {c['type']} values; "
                    f"nullable={c.get('nullable', True)}."
                    for c in columns
                ),
                "metadata": {"tables": [table_name], "columns": [c["name"] for c in columns]},
            }
        )
        chunks.append(
            {
                "id": f"{table_name}:sample-values",
                "type": "sample_value_summary",
                "text": f"Sample rows from {table_name}: {table.get('sample_rows', [])}",
                "metadata": {"tables": [table_name]},
            }
        )
        chunks.append(
            {
                "id": f"{table_name}:business-meaning",
                "type": "business_meaning_summary",
                "text": (
                    f"Business meaning for {table_name}: infer metrics and dimensions from columns "
                    f"{', '.join(c['name'] for c in columns)}. Use this table only when the question "
                    f"mentions these entities or related metrics."
                ),
                "metadata": {"tables": [table_name]},
            }
        )
        chunks.append(
            {
                "id": f"{table_name}:example-question",
                "type": "example_question_mapping",
                "text": (
                    f"Questions about counts, totals, trends, breakdowns, or lists involving {table_name} "
                    f"may need table {table_name} and columns {_column_names(table)}."
                ),
                "metadata": {"tables": [table_name]},
            }
        )

        if fk_lines:
            chunks.append(
                {
                    "id": f"{table_name}:relationship-summary",
                    "type": "relationship_summary",
                    "text": f"Relationships for {table_name}: " + "; ".join(fk_lines),
                    "metadata": {"tables": [table_name]},
                }
            )

    for rel in relationships:
        chunks.append(
            {
                "id": (
                    f"relationship:{rel['source_table']}:{'-'.join(rel['source_columns'])}:"
                    f"{rel['target_table']}:{'-'.join(rel['target_columns'])}"
                ),
                "type": "relationship_summary",
                "text": (
                    f"Join {rel['source_table']} to {rel['target_table']} using "
                    f"{rel['source_table']}.{', '.join(rel['source_columns'])} = "
                    f"{rel['target_table']}.{', '.join(rel['target_columns'])}."
                ),
                "metadata": {"tables": [rel["source_table"], rel["target_table"]]},
            }
        )

    return chunks
