from sqlalchemy import create_engine, text

from app.sql_agent.executor import SQLExecutor
from app.sql_agent.validator import validate_select_sql


SCHEMA = {
    "dialect": "sqlite",
    "tables": [{"name": "customers", "columns": [{"name": "id"}, {"name": "name"}]}],
    "relationships": [],
}


def test_dangerous_sql_is_blocked():
    result = validate_select_sql("DROP TABLE customers", SCHEMA, 100)
    assert not result.is_safe


def test_safe_select_gets_limit_added():
    result = validate_select_sql("SELECT id, name FROM customers", SCHEMA, 25)
    assert result.is_safe
    assert "LIMIT 25" in result.sql.upper()


def test_sql_execution_returns_rows_with_limit(tmp_path):
    db_path = tmp_path / "target.db"
    engine = create_engine(f"sqlite:///{db_path}")
    with engine.begin() as conn:
        conn.execute(text("CREATE TABLE customers (id INTEGER PRIMARY KEY, name TEXT)"))
        conn.execute(text("INSERT INTO customers (name) VALUES ('Avery'), ('Maya')"))

    executor = SQLExecutor(f"sqlite:///{db_path}", timeout_seconds=2)
    result = executor.execute("SELECT id, name FROM customers LIMIT 1")

    assert result.ok
    assert len(result.rows) == 1
    assert result.columns == ["id", "name"]
