from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from app.data.service import DynamicDataService
from app.db.models import Base, DatabaseConnection, User
from app.db.session import get_db
from app.dependencies import get_current_user
from app.routes.data import router as data_router
from app.schema_rag.inspector import inspect_database


def _target_db(tmp_path):
    target_path = tmp_path / "target_crud.db"
    engine = create_engine(f"sqlite:///{target_path}")
    with engine.begin() as conn:
        conn.execute(text("CREATE TABLE customers (id INTEGER PRIMARY KEY, name TEXT NOT NULL, segment TEXT NOT NULL)"))
        conn.execute(text("INSERT INTO customers (name, segment) VALUES ('Avery', 'Enterprise'), ('Maya', 'SMB')"))
    return f"sqlite:///{target_path}"


def test_dynamic_data_service_crud_roundtrip(tmp_path):
    connection_url = _target_db(tmp_path)
    schema = inspect_database(connection_url).as_dict()
    service = DynamicDataService(connection_url, schema)

    tables = service.list_tables()
    assert tables[0]["name"] == "customers"

    created = service.create_row("customers", {"name": "Rafi", "segment": "SMB"})
    assert created["row"]["name"] == "Rafi"

    rows = service.get_rows("customers", limit=10, offset=0)
    rafi = next(row for row in rows["rows"] if row["name"] == "Rafi")

    updated = service.update_row("customers", {"id": rafi["id"]}, {"segment": "Consumer"})
    assert updated["row"]["segment"] == "Consumer"

    deleted = service.delete_row("customers", {"id": rafi["id"]})
    assert deleted["deleted"] is True


def test_data_routes_allow_reads_and_restrict_writes_to_admin(tmp_path):
    connection_url = _target_db(tmp_path)
    app_engine = create_engine(f"sqlite:///{tmp_path / 'app_crud.db'}")
    Base.metadata.create_all(app_engine)
    Session = sessionmaker(bind=app_engine, expire_on_commit=False)
    db = Session()
    viewer = User(email="viewer@example.com", full_name="Viewer", role="viewer", hashed_password="x")
    admin = User(email="admin@example.com", full_name="Admin", role="admin", hashed_password="x")
    connection = DatabaseConnection(name="target", dialect="sqlite", connection_url=connection_url, is_default=True)
    db.add_all([viewer, admin, connection])
    db.commit()
    db.refresh(viewer)
    db.refresh(admin)

    api = FastAPI()
    api.include_router(data_router)

    def override_db():
        session = Session()
        try:
            yield session
        finally:
            session.close()

    api.dependency_overrides[get_db] = override_db
    api.dependency_overrides[get_current_user] = lambda: viewer
    client = TestClient(api)

    read_response = client.get("/data/customers/rows")
    assert read_response.status_code == 200
    assert len(read_response.json()["rows"]) == 2

    denied_response = client.post("/data/customers/rows", json={"values": {"name": "Nope", "segment": "SMB"}})
    assert denied_response.status_code == 403

    api.dependency_overrides[get_current_user] = lambda: admin
    allowed_response = client.post("/data/customers/rows", json={"values": {"name": "Nadia", "segment": "SMB"}})
    assert allowed_response.status_code == 200
    assert allowed_response.json()["row"]["name"] == "Nadia"
