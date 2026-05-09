from __future__ import annotations

from typing import Any

import networkx as nx


class RelationshipGraph:
    def __init__(self, schema: dict[str, Any]) -> None:
        self.schema = schema
        self.graph = nx.Graph()
        self._build()

    def _build(self) -> None:
        for table in self.schema.get("tables", []):
            self.graph.add_node(table["name"], table=table)

        for rel in self.schema.get("relationships", []):
            source = rel["source_table"]
            target = rel["target_table"]
            if source and target:
                self.graph.add_edge(source, target, relationship=rel)

    def relevant_tables_from_chunks(self, chunks: list[dict[str, Any]]) -> list[str]:
        tables: list[str] = []
        for chunk in chunks:
            for table in chunk.get("metadata", {}).get("tables", []):
                if table in self.graph and table not in tables:
                    tables.append(table)
        return tables

    def find_join_paths(self, tables: list[str]) -> list[dict[str, Any]]:
        """Find shortest relationship paths and produce SQL join context."""

        valid_tables = [table for table in tables if table in self.graph]
        paths: list[dict[str, Any]] = []
        if len(valid_tables) < 2:
            return paths

        anchor = valid_tables[0]
        for target in valid_tables[1:]:
            try:
                nodes = nx.shortest_path(self.graph, anchor, target)
            except nx.NetworkXNoPath:
                continue

            joins = []
            for left, right in zip(nodes, nodes[1:]):
                rel = self.graph.edges[left, right]["relationship"]
                source = rel["source_table"]
                target_table = rel["target_table"]
                source_cols = rel["source_columns"]
                target_cols = rel["target_columns"]
                conditions = [
                    f"{source}.{source_col} = {target_table}.{target_col}"
                    for source_col, target_col in zip(source_cols, target_cols)
                ]
                joins.append(
                    {
                        "from_table": source,
                        "to_table": target_table,
                        "condition": " AND ".join(conditions),
                    }
                )

            paths.append({"tables": nodes, "joins": joins})

        return paths

    def join_context_text(self, tables: list[str]) -> str:
        paths = self.find_join_paths(tables)
        if not paths:
            return "No foreign-key join path is required or available for the retrieved tables."

        lines = []
        for path in paths:
            lines.append(f"Join path: {' -> '.join(path['tables'])}")
            for join in path["joins"]:
                lines.append(f"Use join condition: {join['condition']}")
        return "\n".join(lines)
