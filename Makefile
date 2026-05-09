.PHONY: help dev prod down logs test lint migrate seed

help:   ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-18s\033[0m %s\n", $$1, $$2}'

# ---- Local development -----------------------------------------
dev:    ## Start all services (SQLite + ChromaDB, no Postgres needed)
	uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

frontend-dev:  ## Start Next.js dev server
	cd frontend && npm run dev

# ---- Docker Compose -------------------------------------------
up:     ## Start full stack with Docker Compose (dev mode)
	docker compose up --build -d

down:   ## Stop all Docker containers
	docker compose down

prod:   ## Start production stack (requires nginx/certs)
	docker compose -f docker-compose.yml -f docker-compose.prod.yml up --build -d

logs:   ## Tail API logs
	docker compose logs -f api

# ---- Database -------------------------------------------------
migrate:  ## Apply all pending Alembic migrations
	alembic upgrade head

migration:  ## Generate a new migration (set MSG variable)
	@[ -n "$(MSG)" ] || (echo "Usage: make migration MSG='add users.last_login'" && exit 1)
	alembic revision --autogenerate -m "$(MSG)"

seed:   ## Seed the sample business database
	docker compose exec business-db psql -U business_user -d business -f /docker-entrypoint-initdb.d/init.sql

# ---- Quality --------------------------------------------------
test:   ## Run backend tests
	pytest -v

lint:   ## Lint Python and TypeScript
	ruff check app/
	cd frontend && npx tsc --noEmit

install:  ## Install all dependencies
	pip install -r requirements.txt
	cd frontend && npm install
