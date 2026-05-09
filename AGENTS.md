# Agent Instructions

## Project Goal

Build and maintain an AI-powered multi-table relational database chat assistant. The assistant must dynamically inspect target database schemas, retrieve relevant schema context, detect relationships, generate safe SQL, execute read-only queries, and return useful business answers.

## Coding Conventions

- Keep backend modules small and focused.
- Add type hints for public functions and service boundaries.
- Prefer SQLAlchemy and structured parsers over string hacks.
- Keep API responses explicit and role-aware.
- Keep frontend pages clean, operational, and dashboard-oriented.
- Do not hardcode one-table logic.
- Do not assume the demo schema is the only schema.

## Testing Rules

- Add tests for schema inspection, versioning, retrieval, graph paths, SQL safety, execution, chat, history, and permissions.
- Run tests before finalizing changes:

```bash
python -m pytest
```

## Security Rules

- Never expose secrets in API responses or logs.
- Never return raw target connection URLs to the frontend.
- Treat all LLM output as untrusted.
- Validate SQL before execution.
- Use read-only database credentials in production.
- Prefer a secret manager or encrypted storage for connection credentials in production.

## SQL Safety Rules

- Allow only SELECT queries.
- Block DROP, DELETE, UPDATE, INSERT, ALTER, TRUNCATE, CREATE, GRANT, REVOKE, MERGE, CALL, EXEC, and COPY.
- Block SQL comments.
- Block multiple statements.
- Add LIMIT if missing.
- Enforce `MAX_SQL_ROWS`.
- Validate referenced table and column names against inspected schema.
- Return safe error messages.

## Dynamic Schema Rules

- Always support dynamic schema inspection.
- Always refresh schema knowledge after database changes.
- Always rebuild schema chunks from inspected metadata.
- Always build relationship context from real primary/foreign keys.
- Never write logic that only works for `customers`, `orders`, or any other single sample table.
