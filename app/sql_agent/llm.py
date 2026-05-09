from __future__ import annotations

import re
from typing import Any

from app.config import get_settings


def _strip_sql(text: str) -> str:
    cleaned = text.strip()
    cleaned = re.sub(r"^```(?:sql)?", "", cleaned, flags=re.IGNORECASE).strip()
    cleaned = re.sub(r"```$", "", cleaned).strip()
    return cleaned


class LLMClient:
    def generate_text(self, prompt: str) -> str:
        settings = get_settings()
        if settings.llm_provider.lower() == "gemini" and settings.gemini_api_key:
            try:
                import google.generativeai as genai

                genai.configure(api_key=settings.gemini_api_key)
                model = genai.GenerativeModel(settings.llm_model)
                response = model.generate_content(prompt)
                return _strip_sql(response.text or "")
            except Exception:
                return ""

        return ""


class SQLGenerator:
    def __init__(self, llm: LLMClient | None = None) -> None:
        self.llm = llm or LLMClient()

    def generate(self, prompt: str, question: str, tables: list[str], schema: dict[str, Any], max_rows: int) -> str:
        generated = self.llm.generate_text(prompt)
        if generated:
            return generated
        return self._fallback_sql(question, tables, schema, max_rows)

    def fix(self, prompt: str, failed_sql: str) -> str:
        generated = self.llm.generate_text(prompt)
        return generated or failed_sql

    def _fallback_sql(self, question: str, tables: list[str], schema: dict[str, Any], max_rows: int) -> str:
        """Deterministic local fallback for development without an LLM key."""

        table_map = {table["name"]: table for table in schema.get("tables", [])}
        table_name = next((table for table in tables if table in table_map), None)
        if not table_name and table_map:
            table_name = next(iter(table_map))
        if not table_name:
            return f"SELECT 1 AS result LIMIT {max_rows}"

        columns = [c["name"] for c in table_map[table_name].get("columns", [])]
        lower_question = question.lower()
        if any(word in lower_question for word in ["count", "how many", "number of"]):
            return f"SELECT COUNT(*) AS total_count FROM {table_name}"

        selected = ", ".join(columns[: min(6, len(columns))]) or "*"
        return f"SELECT {selected} FROM {table_name} LIMIT {max_rows}"
