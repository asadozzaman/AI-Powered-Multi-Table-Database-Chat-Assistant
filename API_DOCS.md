# API Docs

Interactive OpenAPI docs are available at `/docs` when the API is running.

## Auth

### `POST /auth/register`

Create a user.

```json
{
  "email": "analyst@example.com",
  "password": "password",
  "full_name": "Analyst User",
  "role": "analyst"
}
```

### `POST /auth/login`

Returns a bearer token.

```json
{
  "email": "admin@example.com",
  "password": "admin123"
}
```

### `GET /auth/me`

Returns the current authenticated user.

## Database

### `POST /database/connect`

Admin only. Adds a target database connection and refreshes schema.

```json
{
  "name": "Warehouse",
  "connection_url": "postgresql+psycopg://user:pass@host:5432/db",
  "is_default": true
}
```

### `GET /database/status`

Returns app database and target configuration status.

### `GET /database/list`

Lists configured target database connections.

## Schema

### `GET /schema/tables`

Returns inspected table metadata for the active or selected connection.

### `GET /schema/relationships`

Returns detected foreign-key relationships.

### `POST /schema/refresh`

Admin only. Re-inspects schema, versions metadata, regenerates chunks, and reports changes.

### `GET /schema/versions`

Returns schema version records.

### `GET /schema/changes`

Returns the latest schema change summary.

## Data

Dynamic CRUD over the active inspected target database. Reads are available to authenticated users. Writes are admin-only.

### `GET /data/tables`

Returns all inspected tables with columns, primary keys, and row counts.

### `GET /data/{table_name}/rows`

Returns rows for a table.

Query parameters:

- `limit`: default `100`, capped at `500`
- `offset`: default `0`

### `POST /data/{table_name}/rows`

Admin only. Creates a row using structured column values.

```json
{
  "values": {
    "name": "New Category"
  }
}
```

### `PATCH /data/{table_name}/rows`

Admin only. Updates a row by primary key.

```json
{
  "pk": {
    "id": 1
  },
  "values": {
    "name": "Updated Category"
  }
}
```

### `DELETE /data/{table_name}/rows`

Admin only. Deletes a row by primary key.

```json
{
  "pk": {
    "id": 1
  }
}
```

## Chat

### `POST /chat/ask`

Ask a natural language question.

```json
{
  "question": "Show total sales by city",
  "connection_id": 1
}
```

Response includes:

- `direct_answer`
- `explanation`
- `important_numbers`
- `result_table`
- `chart`
- `business_insight`
- `run_details`
- `schema_sources`
- `sql_safety_status`
- `confidence`
- `follow_up_questions`
- `sql` for admin and analyst roles only

`run_details.token_usage` is estimated unless the configured provider returns exact usage. Set `LLM_INPUT_COST_PER_1M_TOKENS` and `LLM_OUTPUT_COST_PER_1M_TOKENS` to calculate `estimated_cost_usd`.

## History

### `GET /history/queries`

Admin sees all history. Analyst/viewer see their own history.

### `GET /history/{id}`

Returns one history item if permitted.

### `POST /history/{id}/feedback`

```json
{
  "rating": 5,
  "comment": "Helpful answer"
}
```

## Health

### `GET /health`

Returns `{"status": "ok"}`.
