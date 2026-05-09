# Testing Guide

Use this guide to test the project at three levels: automated tests, API tests, and browser/user-flow tests.

## 1. Automated Backend Tests

Run:

```bash
python -m pytest
```

Expected result:

```text
12 passed
```

Covered areas:

- Schema inspection
- Schema hash generation
- Schema change detection
- Schema chunk creation
- Schema retriever relevance
- Join path finder
- Dangerous SQL blocking
- Safe SELECT validation
- SQL execution with limit
- Chat endpoint
- Query history logging
- Role permission logic

## 2. Frontend Build And Security Check

From `frontend/`:

```bash
npm install
npm run build
npm audit --omit=dev
```

Expected results:

- Build compiles successfully
- `npm audit --omit=dev` reports `0 vulnerabilities`

## 3. Full Docker Test

From the project root:

```bash
copy .env.example .env
docker compose up --build
```

Open:

- Frontend: `http://localhost:3000`
- API docs: `http://localhost:8000/docs`
- Health: `http://localhost:8000/health`

Login:

- Email: `admin@example.com`
- Password: `admin123`

## 4. Manual Browser Test Checklist

### Login

1. Open `http://localhost:3000/login`.
2. Login with `admin@example.com` / `admin123`.
3. Confirm you land on the Operations Dashboard.

### Operations Dashboard

1. Confirm database connection count is visible.
2. Confirm table, relationship, and query metrics are visible.
3. Confirm schema hash and last refresh information are visible.
4. Confirm production guardrails explain SQL safety, Schema-RAG, join graph, and audit trail behavior.

### Schema Explorer

1. Open `Schema`.
2. Confirm tables appear dynamically.
3. Confirm columns, data types, row counts, and primary keys are visible.
4. Confirm relationships are visible for foreign-key tables.

Expected demo tables:

- `customers`
- `products`
- `orders`
- `order_items`
- `payments`
- `categories`
- `cities`

### Data Manager

1. Login as admin.
2. Open `Data`.
3. Confirm every inspected table is listed.
4. Select a table and confirm rows are displayed.
5. Create a row in a simple lookup table such as `categories`.
6. Edit the created row.
7. Delete the created row.
8. Login as a non-admin user and confirm write APIs return `403`.

### Chat

Ask:

```text
How many customers do we have?
```

Expected:

- A direct answer
- A result table
- Chart recommendation
- Business insight
- SQL visible for admin/analyst roles
- History record saved

Try richer questions when `GEMINI_API_KEY` is configured:

```text
Show total sales by city
Which products generated the most revenue?
Break down payment amount by method
Show monthly completed order revenue
```

### History

1. Open `History`.
2. Confirm your question appears.
3. Confirm status is `success`.
4. Confirm SQL is visible for admin/analyst users.

### Admin Schema Refresh

1. Open `Admin`.
2. Click `Refresh Schema`.
3. Confirm a schema hash and change summary appear.

## 5. API Smoke Tests

Health:

```bash
curl http://localhost:8000/health
```

Login:

```bash
curl -X POST http://localhost:8000/auth/login ^
  -H "Content-Type: application/json" ^
  -d "{\"email\":\"admin@example.com\",\"password\":\"admin123\"}"
```

Use the returned token:

```bash
set TOKEN=your_token_here
```

Ask a question:

```bash
curl -X POST http://localhost:8000/chat/ask ^
  -H "Content-Type: application/json" ^
  -H "Authorization: Bearer %TOKEN%" ^
  -d "{\"question\":\"How many customers do we have?\"}"
```

Refresh schema:

```bash
curl -X POST http://localhost:8000/schema/refresh ^
  -H "Authorization: Bearer %TOKEN%"
```

## 6. Schema Change Test

1. Add a new table to the target database.
2. Click `Admin -> Refresh Schema`.
3. Open `Schema`.
4. Confirm the new table appears.
5. Open `Schema -> Versions` through the API:

```bash
curl http://localhost:8000/schema/versions -H "Authorization: Bearer %TOKEN%"
```

Expected:

- New schema version created when structure changes
- `added_tables`, `removed_tables`, or `changed_tables` reported

## 7. SQL Safety Test Ideas

Unit tests already cover dangerous SQL blocking. For manual developer testing, call `validate_select_sql` directly in Python:

```python
from app.sql_agent.validator import validate_select_sql

schema = {
    "dialect": "postgresql",
    "tables": [{"name": "customers", "columns": [{"name": "id"}, {"name": "name"}]}],
}

print(validate_select_sql("DROP TABLE customers", schema, 100))
print(validate_select_sql("SELECT id FROM customers", schema, 100))
```

Expected:

- Destructive SQL is blocked
- SELECT queries are allowed and capped with `LIMIT`

## 8. Role Testing

Create users with each role:

- `admin`: can manage connections, refresh schema, view all history, view SQL
- `analyst`: can ask questions, view own history, view SQL
- `viewer`: can ask questions, view own history, cannot view SQL

Check:

- Viewer responses do not include raw SQL
- Analyst/admin responses include raw SQL
- Only admin can refresh schema and connect databases

## 9. Troubleshooting

If running outside Docker and `.env` points to Docker hostnames like `app-db`, the API will not connect. Either run Docker Compose or use local SQLite/PostgreSQL URLs for development.

If Gemini returns a model error, set:

```env
LLM_MODEL=gemini-2.5-flash
```

If no `GEMINI_API_KEY` is configured, the app uses a deterministic local fallback. That is good for smoke tests, but richer multi-table business questions need a real LLM key.
