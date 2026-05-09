from app.schema_rag.versioning import diff_schemas, schema_hash


def test_schema_hash_is_stable_for_equivalent_schema():
    schema_a = {"tables": [{"name": "customers", "columns": [{"name": "id"}]}]}
    schema_b = {"tables": [{"columns": [{"name": "id"}], "name": "customers"}]}
    assert schema_hash(schema_a) == schema_hash(schema_b)


def test_schema_change_detection_reports_added_removed_and_changed_tables():
    old = {"tables": [{"name": "customers", "columns": [{"name": "id"}]}, {"name": "orders", "columns": []}]}
    new = {"tables": [{"name": "customers", "columns": [{"name": "id"}, {"name": "email"}]}, {"name": "payments", "columns": []}]}
    diff = diff_schemas(old, new)
    assert diff["added_tables"] == ["payments"]
    assert diff["removed_tables"] == ["orders"]
    assert diff["changed_tables"] == ["customers"]
