from __future__ import annotations

import hashlib
import json
from typing import Any


def canonical_schema(schema: dict[str, Any]) -> str:
    """Stable JSON representation used for schema hashing."""

    return json.dumps(schema, sort_keys=True, default=str, separators=(",", ":"))


def schema_hash(schema: dict[str, Any]) -> str:
    return hashlib.sha256(canonical_schema(schema).encode("utf-8")).hexdigest()


def diff_schemas(old: dict[str, Any] | None, new: dict[str, Any]) -> dict[str, Any]:
    if not old:
        return {"added_tables": [t["name"] for t in new.get("tables", [])], "removed_tables": [], "changed_tables": []}

    old_tables = {table["name"]: table for table in old.get("tables", [])}
    new_tables = {table["name"]: table for table in new.get("tables", [])}
    added = sorted(set(new_tables) - set(old_tables))
    removed = sorted(set(old_tables) - set(new_tables))
    changed = []

    for table_name in sorted(set(old_tables) & set(new_tables)):
        old_table = dict(old_tables[table_name])
        new_table = dict(new_tables[table_name])
        old_table.pop("sample_rows", None)
        new_table.pop("sample_rows", None)
        old_table.pop("row_count", None)
        new_table.pop("row_count", None)
        if canonical_schema(old_table) != canonical_schema(new_table):
            changed.append(table_name)

    return {"added_tables": added, "removed_tables": removed, "changed_tables": changed}
