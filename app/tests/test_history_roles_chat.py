from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from app.db.models import Base, DatabaseConnection, QueryHistory, User
from app.db.session import get_db
from app.dependencies import can_view_all_history, can_view_sql, get_current_user
from app.history.service import log_query
from app.routes.chat import router as chat_router


def test_role_permission_logic():
    assert can_view_sql("admin")
    assert can_view_sql("analyst")
    assert not can_view_sql("viewer")
    assert can_view_all_history("admin")
    assert not can_view_all_history("analyst")


def test_query_history_logging(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'app.db'}")
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    db = Session()
    history = log_query(db, 1, 1, "question", "SELECT 1", "SELECT 1 LIMIT 10", {"ok": True})
    assert history.id
    assert db.query(QueryHistory).count() == 1


def test_chat_endpoint_uses_dynamic_schema_and_logs_history(tmp_path):
    target_path = tmp_path / "target.db"
    target_engine = create_engine(f"sqlite:///{target_path}")
    with target_engine.begin() as conn:
        conn.execute(text("CREATE TABLE customers (id INTEGER PRIMARY KEY, name TEXT)"))
        conn.execute(text("INSERT INTO customers (name) VALUES ('Avery'), ('Maya')"))

    app_engine = create_engine(f"sqlite:///{tmp_path / 'app_chat.db'}")
    Base.metadata.create_all(app_engine)
    Session = sessionmaker(bind=app_engine, expire_on_commit=False)
    db = Session()
    user = User(email="viewer@example.com", full_name="Viewer", role="viewer", hashed_password="x")
    connection = DatabaseConnection(name="target", dialect="sqlite", connection_url=f"sqlite:///{target_path}", is_default=True)
    db.add_all([user, connection])
    db.commit()
    db.refresh(user)

    api = FastAPI()
    api.include_router(chat_router)

    def override_db():
        session = Session()
        try:
            yield session
        finally:
            session.close()

    api.dependency_overrides[get_db] = override_db
    api.dependency_overrides[get_current_user] = lambda: user

    client = TestClient(api)
    response = client.post("/chat/ask", json={"question": "count customers"})

    assert response.status_code == 200
    data = response.json()
    assert data["result_table"]["rows"][0]["total_count"] == 2
    assert "sql" not in data
    assert data["run_details"]["rows_returned"] == 1
    assert data["schema_sources"]["tables"]
    assert data["sql_safety_status"]["status"] == "passed"
    assert data["confidence"]["assumptions"]
    assert data["follow_up_questions"]
