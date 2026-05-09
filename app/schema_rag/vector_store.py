from __future__ import annotations

import math
import re
from collections import Counter
from typing import Any


TOKEN_RE = re.compile(r"[A-Za-z0-9_]+")


def _tokens(text: str) -> list[str]:
    return [token.lower() for token in TOKEN_RE.findall(text)]


def _score(query: str, document: str) -> float:
    q = Counter(_tokens(query))
    d = Counter(_tokens(document))
    if not q or not d:
        return 0.0
    overlap = sum(q[t] * d.get(t, 0) for t in q)
    q_norm = math.sqrt(sum(v * v for v in q.values()))
    d_norm = math.sqrt(sum(v * v for v in d.values()))
    return overlap / (q_norm * d_norm)


class SchemaVectorIndex:
    """Small lexical vector facade with the same retrieval contract as a vector DB.

    Chroma/Qdrant can be added behind this interface; the MVP keeps a deterministic
    local retriever so tests and demos run without external embedding services.
    """

    def __init__(self) -> None:
        self._chunks: dict[tuple[int, str], list[dict[str, Any]]] = {}

    def upsert_schema(self, connection_id: int, schema_hash: str, chunks: list[dict[str, Any]]) -> None:
        self._chunks[(connection_id, schema_hash)] = chunks

    def retrieve(self, connection_id: int, schema_hash: str, query: str, top_k: int = 8) -> list[dict[str, Any]]:
        chunks = self._chunks.get((connection_id, schema_hash), [])
        ranked = sorted(
            ({**chunk, "score": _score(query, chunk["text"])} for chunk in chunks),
            key=lambda chunk: chunk["score"],
            reverse=True,
        )
        useful = [chunk for chunk in ranked if chunk["score"] > 0]
        return (useful or ranked)[:top_k]


schema_index = SchemaVectorIndex()
