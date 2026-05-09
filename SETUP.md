# Setup

## Requirements

- Python 3.11+
- Node.js 22+
- Docker and Docker Compose
- PostgreSQL for non-Docker local development

## Environment

Create `.env` from `.env.example`.

Important variables:

- `APP_DATABASE_URL`: database for application metadata
- `TARGET_DATABASE_URL`: external business database to chat with
- `GEMINI_API_KEY`: optional; enables Gemini SQL generation
- `LLM_PROVIDER`: currently `gemini` or local fallback
- `LLM_MODEL`: Gemini model name, defaulting to `gemini-2.5-flash`
- `EMBEDDING_MODEL`: configurable placeholder for embedding provider
- `VECTOR_DB_TYPE`: `chroma` or `qdrant` target; MVP uses a deterministic local retrieval facade
- `MAX_SQL_ROWS`: maximum result rows
- `SQL_TIMEOUT_SECONDS`: query timeout

## Docker

```bash
docker compose up --build
```

The compose stack starts:

- `app-db` on host port `5433`
- `business-db` on host port `5434`
- `qdrant` on host port `6333`
- `api` on host port `8000`
- `frontend` on host port `3000`

## Frontend

```bash
cd frontend
npm install
npm run dev
```

Set `NEXT_PUBLIC_API_BASE_URL=http://localhost:8000` if the API runs elsewhere.

## Demo Questions

- `How many customers do we have?`
- `Show total sales by city`
- `Which products generated the most revenue?`
- `Break down payment amount by method`
- `Show monthly completed order revenue`
