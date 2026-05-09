from sqlalchemy import create_engine, text

from app.schema_rag.inspector import inspect_database


def test_schema_inspection_extracts_tables_columns_and_foreign_keys(tmp_path):
    db_path = tmp_path / "business.db"
    engine = create_engine(f"sqlite:///{db_path}")
    with engine.begin() as conn:
        conn.execute(text("CREATE TABLE customers (id INTEGER PRIMARY KEY, name TEXT NOT NULL)"))
        conn.execute(text("CREATE TABLE orders (id INTEGER PRIMARY KEY, customer_id INTEGER NOT NULL, total NUMERIC, FOREIGN KEY(customer_id) REFERENCES customers(id))"))
        conn.execute(text("INSERT INTO customers (id, name) VALUES (1, 'Avery')"))
        conn.execute(text("INSERT INTO orders (id, customer_id, total) VALUES (1, 1, 42.5)"))

    snapshot = inspect_database(f"sqlite:///{db_path}").as_dict()

    table_names = {table["name"] for table in snapshot["tables"]}
    assert {"customers", "orders"} <= table_names
    assert any(rel["source_table"] == "orders" and rel["target_table"] == "customers" for rel in snapshot["relationships"])
    customers = next(table for table in snapshot["tables"] if table["name"] == "customers")
    assert customers["sample_rows"][0]["name"] == "Avery"
    assert customers["row_count"] == 1
