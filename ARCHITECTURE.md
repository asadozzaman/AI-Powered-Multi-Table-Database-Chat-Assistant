# Architecture

## Layers

The project has two database layers.

Application database:

- `users`
- `database_connections`
- `schema_versions`
- `schema_objects`
- `query_history`
- `query_feedback`

Target business database:

- External relational database selected by the user or admin
- Inspected dynamically through SQLAlchemy
- Queried through safe read-only SQL

## Workflow

1. User authenticates.
2. Admin connects or selects a target database.
3. Schema inspector extracts tables, columns, types, primary keys, foreign keys, indexes, nullability, safe row counts, and sample rows.
4. Schema metadata is hashed and versioned.
5. Schema chunks are generated for table summaries, columns, relationships, sample values, business meaning, and example question mappings.
6. The retrieval layer indexes chunks.
7. NetworkX builds a relationship graph from foreign keys.
8. User asks a question.
9. Schema-RAG retrieves relevant schema chunks.
10. Relationship graph finds join paths for retrieved tables.
11. Prompt builder sends schema, join path, safety rules, and dialect to the SQL generator.
12. SQL validator blocks unsafe SQL and validates identifiers.
13. Executor runs the SQL with row limits and timeout controls.
14. Auto-fix retries once if execution fails.
15. Response generator returns direct answer, explanation, important numbers, result table, chart config, and insight.
16. History service logs the question and result.

## Key Modules

- `app/schema_rag/inspector.py`: dynamic database inspection
- `app/schema_rag/versioning.py`: schema hash and schema diffs
- `app/schema_rag/chunker.py`: Schema-RAG chunks
- `app/schema_rag/vector_store.py`: retrieval interface
- `app/graph/relationship_graph.py`: NetworkX join path detection
- `app/sql_agent/prompt.py`: SQL generation and fix prompts
- `app/sql_agent/validator.py`: SQL safety checks
- `app/sql_agent/executor.py`: read-only query execution
- `app/sql_agent/agent.py`: end-to-end chat orchestration
- `app/response/generator.py`: answer, chart, and insight shaping

## Security Model

The SQL path is defensive by default:

- Only `SELECT` is allowed
- Destructive keywords are blocked
- Multiple statements are blocked
- SQL comments are blocked
- Unknown tables/columns are blocked
- Limits are injected or capped
- PostgreSQL execution uses read-only transaction behavior
- SQL visibility is role-gated

For production, store connection credentials in a secret manager or encrypted column instead of plaintext.
