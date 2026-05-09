# AI-Powered Multi-Table Database Chatbot

<p align="center">
  <img src="https://img.shields.io/badge/FastAPI-0.110+-009688?style=for-the-badge&logo=fastapi&logoColor=white" />
  <img src="https://img.shields.io/badge/Next.js-16-black?style=for-the-badge&logo=next.js&logoColor=white" />
  <img src="https://img.shields.io/badge/Python-3.11+-3776AB?style=for-the-badge&logo=python&logoColor=white" />
  <img src="https://img.shields.io/badge/Google_Gemini-AI-4285F4?style=for-the-badge&logo=google&logoColor=white" />
  <img src="https://img.shields.io/badge/Docker-Compose-2496ED?style=for-the-badge&logo=docker&logoColor=white" />
  <img src="https://img.shields.io/badge/License-MIT-green?style=for-the-badge" />
</p>

<p align="center">
  Ask plain-English questions about your business database — get SQL, answers, and charts.<br/>
  No SQL knowledge required. Works with any relational schema.
</p>

---

## What This Is

Most internal reporting tools either require SQL expertise or are locked to a fixed dashboard that nobody updates. This project sits in the middle: it lets non-technical users ask questions like *"Which city had the most orders last month?"* or *"Show me the top 5 products by revenue"* and get a correct SQL query, a human-readable answer, and an auto-generated chart — all without writing a single line of SQL.

The engine is built on Schema-RAG: instead of feeding the entire database schema into the LLM context on every request (expensive and slow), it embeds schema chunks into a vector store and retrieves only the relevant pieces for each question. A NetworkX relationship graph then figures out the shortest JOIN path between any two tables automatically. The LLM generates the query; a safety validator blocks anything destructive before it ever touches the database.

I built this because the teams I've worked with spend hours writing ad-hoc queries for questions that get asked every week. This is the tool I wanted to exist.

---

## Table of Contents

- [Features](#features)
- [System Architecture](#system-architecture)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Database Design](#database-design)
- [AI / RAG Workflow](#ai--rag-workflow)
- [API Reference](#api-reference)
- [Installation — Local Dev](#installation--local-dev)
- [Installation — Docker Full Stack](#installation--docker-full-stack)
- [Environment Variables](#environment-variables)
- [Example Queries](#example-queries)
- [Business Use Cases](#business-use-cases)
- [Security](#security)
- [Running Tests](#running-tests)
- [Future Work](#future-work)
- [Challenges I Ran Into](#challenges-i-ran-into)
- [About the Author](#about-the-author)

---

## Features

### Core Functionality
- 🤖 **Natural language → SQL** via Google Gemini (OpenAI-compatible fallback included)
- 🧠 **Schema-RAG** — vector-embedded schema chunks, only relevant context retrieved per query
- 🔗 **FK-aware JOIN discovery** — NetworkX graph finds multi-table JOIN paths automatically
- 🛡 **SQL safety validator** — blocks DROP, DELETE, UPDATE, comments, multi-statement attacks
- 🔄 **Auto-fix retry** — if generated SQL fails, the LLM gets one attempt to self-correct with the error
- 📊 **Smart chart selection** — bar charts, pie/donut charts, or data tables chosen based on result shape

### User Experience
- 💬 Chat interface with suggestion chips and follow-up question buttons
- 📋 One-click SQL copy with clipboard confirmation
- 👍/👎 Answer feedback (thumbs up/down) stored per query
- 📜 Full query history with status filtering, SQL preview, and search
- 🗄 In-app data manager — browse tables, add/edit/delete rows, filter results
- 🔍 Schema explorer — searchable accordion view with column types, PKs, FKs

### Platform
- 🔐 JWT authentication with three roles: `admin`, `analyst`, `viewer`
- ⚡ Rate limiting on login (10 attempts / 60s per IP)
- 🌐 Multi-database: connect any SQLite or PostgreSQL database via settings UI
- 🐳 Docker Compose full stack (API + Frontend + Qdrant + two Postgres DBs + Nginx)
- 📦 Alembic database migrations
- 🏥 `/health` endpoint with DB connectivity check and uptime

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Browser (Next.js)                        │
│  Chat UI  │  Data Manager  │  Schema Explorer  │  History       │
└─────────────────────────┬───────────────────────────────────────┘
                          │ HTTPS (via Nginx in prod)
┌─────────────────────────▼───────────────────────────────────────┐
│                     FastAPI Backend                             │
│                                                                 │
│  ┌──────────┐   ┌──────────────┐   ┌────────────────────────┐  │
│  │  Auth    │   │ Schema RAG   │   │    SQL Agent           │  │
│  │  (JWT)   │   │  Inspector   │   │  ┌──────────────────┐  │  │
│  └──────────┘   │  Chunker     │   │  │  LLM (Gemini)    │  │  │
│                 │  Embedder    │   │  │  Validator       │  │  │
│  ┌──────────┐   └──────┬───────┘   │  │  Executor        │  │  │
│  │ Response │          │           │  │  Auto-Fix Retry  │  │  │
│  │Generator │   ┌──────▼───────┐   │  └──────────────────┘  │  │
│  │ (Charts/ │   │ Vector Store │   └────────────────────────┘  │
│  │  Answer) │   │(Chroma/Qdrant│                               │
│  └──────────┘   └──────────────┘   ┌────────────────────────┐  │
│                                    │  Relationship Graph    │  │
│  ┌──────────────────────────────┐  │  (NetworkX shortest    │  │
│  │  App DB (SQLite / Postgres)  │  │   path JOIN discovery) │  │
│  │  Users, History, Connections │  └────────────────────────┘  │
│  └──────────────────────────────┘                              │
│  ┌──────────────────────────────┐                              │
│  │  Business DB (any Postgres   │                              │
│  │  or SQLite the user connects)│                              │
│  └──────────────────────────────┘                              │
└─────────────────────────────────────────────────────────────────┘
```

The two databases are intentionally separate. The app database stores users, sessions, and query history. The business database is the one users actually ask questions about — and they can swap it out through the settings page without restarting anything.

---

## Tech Stack

| Layer | Technology | Why |
|---|---|---|
| **Frontend** | Next.js 16 (App Router) + React 19 + TypeScript | File-based routing, server components, type safety |
| **Styling** | Pure CSS custom properties (no Tailwind) | Full control over design tokens, no purge config |
| **Charts** | Recharts + Lucide icons | Composable charts, consistent iconography |
| **Backend** | FastAPI (Python 3.11) | Async, auto-docs, Pydantic v2 validation |
| **ORM** | SQLAlchemy 2.0 (Mapped syntax) | Modern typed ORM, Alembic migration support |
| **Auth** | JWT (python-jose) + bcrypt | Stateless, role-based, rate-limited |
| **LLM** | Google Gemini (gemini-1.5-flash default) | Cost-effective, strong SQL reasoning |
| **Embeddings** | Google text-embedding-004 | Same API key, high quality |
| **Vector Store** | ChromaDB (dev) / Qdrant (prod) | Local-first default, scalable production path |
| **Graph** | NetworkX | Simple, powerful shortest-path JOIN discovery |
| **SQL Parser** | sqlglot | DB-agnostic AST parsing for safety checks |
| **Migrations** | Alembic | Schema versioning for production |
| **Containers** | Docker Compose | One-command full stack |
| **Proxy** | Nginx (SSL termination) | Production-grade HTTP→HTTPS, WebSocket support |

---

## Project Structure

```
AI power MultitableChatbot/
│
├── app/                          # FastAPI backend
│   ├── main.py                   # App factory, middleware, router registration
│   ├── config.py                 # Pydantic Settings with env validation
│   ├── dependencies.py           # Shared FastAPI dependencies (auth, roles)
│   ├── db/
│   │   └── session.py            # SQLAlchemy engine + session factory
│   ├── models/                   # SQLAlchemy ORM models
│   │   ├── user.py               # User, role, hashed_password
│   │   ├── connection.py         # Database connections (name, url, type)
│   │   └── history.py            # QueryHistory with feedback column
│   ├── routes/
│   │   ├── auth.py               # Login, token refresh, rate limiting
│   │   ├── chat.py               # Main /ask endpoint
│   │   ├── connections.py        # CRUD for DB connections
│   │   ├── data.py               # Table browse, row CRUD
│   │   ├── history.py            # Query history + feedback
│   │   ├── schema.py             # Schema introspection endpoint
│   │   ├── admin.py              # Schema refresh, system stats
│   │   └── health.py             # Health check with DB probe
│   ├── schema_rag/
│   │   ├── inspector.py          # Inspect any database schema dynamically
│   │   ├── chunker.py            # 6 chunk types per table for RAG
│   │   ├── embedder.py           # Embed chunks → vector store
│   │   └── retriever.py          # Semantic search over schema chunks
│   ├── graph/
│   │   └── relationship_graph.py # NetworkX FK graph + JOIN path discovery
│   ├── sql_agent/
│   │   ├── llm.py                # LLM client (Gemini + fallback)
│   │   ├── prompt.py             # Prompt templates
│   │   ├── validator.py          # SQL safety: block destructive + inject LIMIT
│   │   └── executor.py           # Safe query execution + auto-fix retry
│   ├── response/
│   │   ├── generator.py          # Chart type selection + answer generation
│   │   └── metadata.py           # Run details, confidence, follow-up questions
│   └── tests/
│       ├── test_sql_safety_executor.py
│       ├── test_schema_rag.py
│       └── ...
│
├── frontend/                     # Next.js frontend
│   ├── app/
│   │   ├── layout.tsx            # Root layout with Nav + ToastProvider
│   │   ├── globals.css           # Design system (CSS custom properties)
│   │   ├── login/page.tsx        # Auth page
│   │   ├── dashboard/page.tsx    # KPI cards + recent activity
│   │   ├── chat/page.tsx         # Main chat interface
│   │   ├── data/page.tsx         # Table data manager
│   │   ├── history/page.tsx      # Query history
│   │   ├── schema/page.tsx       # Schema explorer
│   │   ├── settings/page.tsx     # DB connection manager
│   │   └── admin/page.tsx        # Admin controls
│   └── components/
│       ├── Nav.tsx               # Sidebar navigation + mobile drawer
│       └── ui/
│           ├── Alert.tsx         # Info/success/warning/error alerts
│           ├── Badge.tsx         # Status badges (5 variants)
│           ├── ConfirmDialog.tsx # Modal confirmation (replaces window.confirm)
│           ├── EmptyState.tsx    # Empty state with icon + CTA
│           ├── Skeleton.tsx      # Shimmer loading skeletons
│           └── Toast.tsx         # Toast notification system
│
├── alembic/                      # Database migrations
│   ├── env.py
│   └── versions/
│
├── nginx/
│   └── nginx.conf                # Reverse proxy + SSL config
│
├── sample_db/
│   └── init.sql                  # Sample 7-table business database
│
├── docker-compose.yml            # Development stack
├── docker-compose.prod.yml       # Production overrides
├── Dockerfile                    # Multi-stage API image
├── Makefile                      # Developer workflow shortcuts
├── requirements.txt
├── alembic.ini
├── pytest.ini
└── .env.example
```

---

## Database Design

The sample business database ships with 7 related tables that demonstrate the multi-table JOIN capability. The schema is intentionally realistic — it mirrors what you'd find in a mid-sized e-commerce or retail operation.

```
cities
  └─── customers (city_id → cities.id)
         └─── orders (customer_id → customers.id)
                └─── order_items (order_id → orders.id)
                │      └─── products (product_id → products.id)
                │              └─── categories (category_id → categories.id)
                └─── payments (order_id → orders.id)
```

| Table | Rows (sample) | Purpose |
|---|---|---|
| `cities` | ~20 | City reference data (name, country, population) |
| `customers` | ~200 | Customers with city FK |
| `categories` | ~10 | Product categories |
| `products` | ~50 | Products with price, category FK |
| `orders` | ~500 | Orders with status, date, customer FK |
| `order_items` | ~1,500 | Line items with quantity, unit_price |
| `payments` | ~500 | Payment records with method and amount |

This structure lets you ask questions that span 4–5 tables — e.g. *"What payment method is most popular in cities with population over 1 million?"* — and the system resolves the JOIN path automatically.

You can swap this out for any PostgreSQL or SQLite database through the Settings page without touching the code.

---

## AI / RAG Workflow

This is the most technically interesting part of the project. Here's exactly what happens when a user submits a question:

```
User question: "Which 5 customers spent the most last year?"

Step 1 — Schema Retrieval
  ├─ Question is embedded using text-embedding-004
  ├─ Vector search against pre-embedded schema chunks
  └─ Returns: customers (id, name, city_id), orders (customer_id, total_amount, order_date),
              order_items (order_id, quantity, unit_price), relationship summaries

Step 2 — JOIN Path Discovery
  ├─ Relationship graph: customers — orders — order_items
  └─ Shortest path: customers → orders (via customer_id)

Step 3 — SQL Generation
  ├─ Prompt: schema context + JOIN paths + question + safety rules
  ├─ LLM: Gemini generates parameterized SQL
  └─ Output: SELECT c.name, SUM(oi.quantity * oi.unit_price) AS total_spent
             FROM customers c JOIN orders o ON o.customer_id = c.id
             JOIN order_items oi ON oi.order_id = o.id
             WHERE o.order_date >= '2024-01-01'
             GROUP BY c.id ORDER BY total_spent DESC LIMIT 5

Step 4 — Safety Validation
  ├─ Pattern check: no DROP/DELETE/UPDATE/INSERT
  ├─ sqlglot AST parse: validate table + column names against schema
  ├─ LIMIT enforcement: inject LIMIT if missing, cap at 500
  └─ PASS → proceed to execution

Step 5 — Execution + Auto-fix
  ├─ Execute against business DB
  ├─ If error → feed error + original SQL back to LLM for 1 retry
  └─ Return rows

Step 6 — Response Generation
  ├─ Chart selection: 5 rows, 1 text + 1 numeric → bar chart
  ├─ Answer: "Alice Johnson leads with $12,450 in purchases..."
  ├─ Follow-up questions: ["Which city do top spenders come from?", ...]
  └─ Confidence score + schema sources used
```

### Schema Chunk Types

For each table, the chunker creates 6 chunk types embedded separately into the vector store:

| Chunk Type | Content |
|---|---|
| `table_summary` | Table name, row count, purpose description |
| `column_summary` | All columns with types, nullable, defaults |
| `sample_value_summary` | Actual sample values from top 3 rows |
| `business_meaning_summary` | Business-language description of the table |
| `example_question_mapping` | Example questions this table can answer |
| `relationship_summary` | FK relationships to other tables |

This granularity means a question about revenue retrieves `order_items.column_summary` but not unrelated `cities.sample_value_summary`, keeping token usage low and context precision high.

---

## API Reference

All endpoints are prefixed with `/api/v1` (or just `/` when running locally without Nginx).

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/auth/login` | — | Get JWT token (rate limited) |
| `GET` | `/health` | — | Health check + uptime |
| `POST` | `/chat/ask` | ✅ any | Submit a natural language question |
| `GET` | `/connections` | ✅ any | List database connections |
| `POST` | `/connections` | ✅ admin | Add a new connection |
| `DELETE` | `/connections/{id}` | ✅ admin | Remove a connection |
| `GET` | `/data/tables` | ✅ any | List tables in connected DB |
| `GET` | `/data/tables/{name}/rows` | ✅ any | Get paginated rows |
| `POST` | `/data/tables/{name}/rows` | ✅ analyst | Insert a row |
| `PUT` | `/data/tables/{name}/rows/{pk}` | ✅ analyst | Update a row |
| `DELETE` | `/data/tables/{name}/rows/{pk}` | ✅ admin | Delete a row |
| `GET` | `/history` | ✅ any | Query history (filtered by role) |
| `POST` | `/history/{id}/feedback` | ✅ any | Submit thumbs up/down |
| `GET` | `/schema` | ✅ any | Full schema introspection |
| `POST` | `/admin/refresh-schema` | ✅ admin | Re-embed schema into vector store |

Swagger UI available at `http://localhost:8000/docs`.

---

## Installation — Local Dev

Quickest path to a running instance. Uses SQLite for both databases — no Docker required.

### Prerequisites

- Python 3.11+
- Node.js 18+
- A Google Gemini API key ([get one free at Google AI Studio](https://aistudio.google.com/))

### 1. Clone the repo

```bash
git clone https://github.com/asadozzaman/ai-multitable-chatbot.git
cd ai-multitable-chatbot
```

### 2. Backend setup

```bash
# Create and activate virtual environment
python -m venv .venv

# Windows
.venv\Scripts\activate
# macOS / Linux
# source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Open .env and set GEMINI_API_KEY at minimum
```

### 3. Frontend setup

```bash
cd frontend
npm install
cd ..
```

### 4. Initialize the database

```bash
# Apply Alembic migrations (creates tables in app.db)
alembic upgrade head
```

### 5. Start the servers

Open two terminals:

```bash
# Terminal 1 — API
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Terminal 2 — Frontend
cd frontend && npm run dev
```

Or with Make:

```bash
make dev           # starts the API
make frontend-dev  # starts the frontend (separate terminal)
```

### 6. Login

Navigate to `http://localhost:3000` and log in with the admin credentials you set in `.env` (`ADMIN_EMAIL` / `ADMIN_PASSWORD`).

---

## Installation — Docker Full Stack

Full production-like stack: two Postgres databases, Qdrant vector store, Nginx reverse proxy.

### Prerequisites

- Docker Desktop with Compose v2

### 1. Configure environment

```bash
cp .env.example .env
# Edit .env — at minimum set GEMINI_API_KEY, SECRET_KEY, and DB passwords
```

Generate a secure secret key:

```bash
python -c "import secrets; print(secrets.token_hex(32))"
```

### 2. Start dev stack

```bash
docker compose up --build -d

# Check logs
docker compose logs -f api
```

This starts:
- `api` — FastAPI on port 8000
- `frontend` — Next.js on port 3000
- `app-db` — PostgreSQL (app data) on port 5432
- `business-db` — PostgreSQL (business data) on port 5433
- `qdrant` — Vector store on port 6333

### 3. Seed the sample database

```bash
make seed
# or manually:
docker compose exec business-db psql -U business_user -d business -f /docker-entrypoint-initdb.d/init.sql
```

### 4. Production deployment

```bash
# Place SSL certs
mkdir -p nginx/certs
cp your-cert.pem nginx/certs/cert.pem
cp your-key.pem nginx/certs/key.pem

# Update nginx/nginx.conf — replace 'yourdomain.com' with your domain
# Update docker-compose.prod.yml — set NEXT_PUBLIC_API_BASE_URL

# Start production stack
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

---

## Environment Variables

Copy `.env.example` to `.env`. Required variables are marked with `*`.

| Variable | Default | Description |
|---|---|---|
| `GEMINI_API_KEY` * | — | Google Gemini API key |
| `SECRET_KEY` * | `dev-secret-change-me` | JWT signing secret (must change in prod) |
| `APP_ENV` | `local` | `local` / `production` |
| `APP_DATABASE_URL` | `sqlite:///./app.db` | App DB connection string |
| `BUSINESS_DATABASE_URL` | `sqlite:///./browser_business.db` | Business DB connection string |
| `VECTOR_DB_TYPE` | `chroma` | `chroma` or `qdrant` |
| `QDRANT_URL` | `http://localhost:6333` | Qdrant endpoint (if using Qdrant) |
| `LLM_PROVIDER` | `gemini` | `gemini` or `openai` |
| `OPENAI_API_KEY` | — | Required if `LLM_PROVIDER=openai` |
| `ALLOWED_ORIGINS` | `http://localhost:3000` | Comma-separated CORS origins |
| `ADMIN_EMAIL` | `admin@example.com` | Initial admin account email |
| `ADMIN_PASSWORD` | — | Initial admin account password |

> The `SECRET_KEY` validator raises an error at startup if it's left as the default in non-local environments. This prevents the most common production security mistake.

---

## Example Queries

These all work against the sample business database out of the box:

| Question | Tables Touched | Chart |
|---|---|---|
| Which 5 customers spent the most this year? | customers, orders, order_items | Bar |
| What's the revenue breakdown by product category? | categories, products, order_items | Pie |
| Show me monthly order counts for 2024 | orders | Bar |
| Which city has the highest average order value? | cities, customers, orders | Bar |
| What payment methods do customers in London prefer? | cities, customers, orders, payments | Pie |
| Which products have never been ordered? | products, order_items | Table |
| What's the average time between customer signup and first order? | customers, orders | Table |

---

## Business Use Cases

**Retail / E-commerce teams** — Sales ops can query order trends, customer segments, and inventory gaps without waiting for a data engineer to write reports.

**Operations managers** — Anyone who needs a quick number for a meeting can just ask instead of opening a spreadsheet or filing a ticket.

**Data onboarding** — New team members can explore the database schema through natural conversation rather than reading documentation that's always out of date.

**Multiple business databases** — The connection manager supports adding any number of databases. You could point it at a legacy SQLite export in the morning and a staging Postgres DB in the afternoon.

---

## Security

**SQL Safety Validator** — Every generated query goes through a two-stage check before execution:
1. Regex scan for `DROP`, `DELETE`, `UPDATE`, `INSERT`, `ALTER`, `TRUNCATE`, `--`, `/*`
2. sqlglot AST parse to validate that every table and column name actually exists in the schema

If either check fails, the query is rejected with an explanation — not a raw error stack trace.

**LIMIT enforcement** — Queries without a LIMIT get one injected automatically (default 100). Queries with a LIMIT over 500 get it capped. This prevents full-table scans from happening by accident or by abuse.

**JWT + RBAC** — Three roles: `viewer` (read-only history/schema), `analyst` (can add/edit rows), `admin` (full access including schema refresh and user management). Tokens expire and are verified on every request.

**Rate limiting** — Login endpoint allows 10 attempts per IP per 60-second window. In-process counter — fine for single-instance deployment. For multi-instance, swap the dict for Redis.

**CORS** — The `ALLOWED_ORIGINS` env var replaces the development wildcard. Set it to your production domain before deploying.

**Secret key validation** — The app refuses to start with the default `SECRET_KEY` in any non-local environment.

---

## Running Tests

```bash
# Run all tests
pytest -v

# Run a specific test file
pytest app/tests/test_sql_safety_executor.py -v

# With coverage
pytest --cov=app --cov-report=term-missing
```

The test suite covers:
- SQL safety validator (dangerous queries blocked, safe queries pass)
- LIMIT injection and capping
- Schema RAG chunking and retrieval
- Auth token generation and validation
- Health check endpoint

---

## Future Work

Things I'd add with more time, roughly in priority order:

- **Streaming responses** — Stream LLM output token-by-token so users see the answer build in real time
- **Redis-backed rate limiting** — Current in-process dict doesn't survive restarts or work in multi-instance deployments
- **Query caching** — Cache identical questions (same hash) for a configurable TTL to save API costs
- **CSV / Excel export** — Export button on query results for sharing data outside the tool
- **Scheduled reports** — Recurring queries (weekly revenue summary, monthly churn) delivered by email
- **More LLM providers** — Anthropic Claude, Azure OpenAI, local models via Ollama
- **Schema change detection** — Detect when business DB schema changes and auto-trigger re-embedding
- **Slack / Teams integration** — Ask questions directly from a slash command

---

## Challenges I Ran Into

**Getting JOIN paths right without hallucination** — The biggest early failure was the LLM inventing table relationships that didn't exist. The NetworkX graph solved this: instead of asking the LLM to figure out JOINs, we give it the exact path derived from actual foreign keys. The LLM just has to use it.

**Context length vs. precision tradeoff** — Dumping the full schema into every prompt was fast to implement but expensive and imprecise. Schema-RAG with 6 chunk types per table gave much better retrieval precision. The key insight was that `sample_value_summary` chunks are what actually help the LLM understand data values (e.g., status is `'pending'` not `1`).

**SQL safety without breaking legitimate queries** — The first safety validator was too aggressive and blocked valid CASE WHEN expressions and subqueries. Switching from pure regex to sqlglot AST parsing made it possible to distinguish structure from content.

**React key warnings in table rows** — Using `<>` shorthand fragments inside `tbody.map()` caused React console warnings because fragment shorthand can't take a `key` prop. Fixed by importing `Fragment` and using `<Fragment key={row.id}>` explicitly.

**CORS in production** — Hardcoding `allow_origins=["*"]` is fine for local dev but a real problem in production. Added `ALLOWED_ORIGINS` as a comma-separated env var parsed into a list, with a startup validator that rejects the dev wildcard in production mode.

---

## About the Author

**Md. Asadozzaman**
Full-stack developer with a focus on AI/ML-integrated applications and data engineering.

- GitHub: [@asadozzaman](https://github.com/asadozzaman)
- Email: faysalcomputervision@gmail.com

I built this project to scratch a real itch — the gap between "we have all this data in the database" and "anyone on the team can actually use it." If you're working on something similar or want to collaborate, feel free to reach out.

---

## License

MIT License. See `LICENSE` for details.

---

<p align="center">
  If this project helped you, a ⭐ on GitHub is always appreciated.
</p>
