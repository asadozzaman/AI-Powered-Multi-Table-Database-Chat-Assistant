from functools import lru_cache
import secrets
from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime settings loaded from environment variables."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_env: str = Field(default="local", alias="APP_ENV")
    secret_key: str = Field(default="dev-secret-change-me", alias="SECRET_KEY")

    @field_validator("secret_key")
    @classmethod
    def _check_secret_key(cls, value: str, info: object) -> str:  # type: ignore[override]
        import sys
        # Allow the default only when running pytest or in local/test env
        if value == "dev-secret-change-me":
            import os
            env = os.environ.get("APP_ENV", "local")
            if env not in {"local", "test"} and "pytest" not in sys.modules:
                raise ValueError(
                    "SECRET_KEY must be changed for non-local environments. "
                    "Run: python -c \"import secrets; print(secrets.token_hex(32))\""
                )
        return value
    app_database_url: str = Field(
        default="sqlite:///./app_dev.db", alias="APP_DATABASE_URL"
    )
    target_database_url: str | None = Field(default=None, alias="TARGET_DATABASE_URL")

    openai_api_key: str | None = Field(default=None, alias="OPENAI_API_KEY")
    gemini_api_key: str | None = Field(default=None, alias="GEMINI_API_KEY")
    llm_provider: str = Field(default="gemini", alias="LLM_PROVIDER")
    llm_model: str = Field(default="gemini-2.5-flash", alias="LLM_MODEL")
    embedding_model: str = Field(default="local-hashing", alias="EMBEDDING_MODEL")

    vector_db_type: str = Field(default="chroma", alias="VECTOR_DB_TYPE")
    qdrant_url: str = Field(default="http://localhost:6333", alias="QDRANT_URL")
    chroma_path: str = Field(default="./.chroma", alias="CHROMA_PATH")

    max_sql_rows: int = Field(default=200, alias="MAX_SQL_ROWS")
    sql_timeout_seconds: int = Field(default=10, alias="SQL_TIMEOUT_SECONDS")
    llm_input_cost_per_1m_tokens: float = Field(default=0.0, alias="LLM_INPUT_COST_PER_1M_TOKENS")
    llm_output_cost_per_1m_tokens: float = Field(default=0.0, alias="LLM_OUTPUT_COST_PER_1M_TOKENS")
    access_token_minutes: int = 60 * 24

    # CORS — comma-separated list of allowed origins for production
    # Example: "https://yourdomain.com,https://admin.yourdomain.com"
    allowed_origins: str = Field(default="http://localhost:3000", alias="ALLOWED_ORIGINS")

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
