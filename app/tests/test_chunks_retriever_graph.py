from app.graph.relationship_graph import RelationshipGraph
from app.schema_rag.chunker import create_schema_chunks
from app.schema_rag.vector_store import SchemaVectorIndex


SCHEMA = {
    "dialect": "sqlite",
    "tables": [
        {
            "name": "customers",
            "columns": [{"name": "id", "type": "INTEGER"}, {"name": "city", "type": "TEXT"}],
            "primary_key": ["id"],
            "foreign_keys": [],
            "indexes": [],
            "sample_rows": [],
            "row_count": 10,
        },
        {
            "name": "orders",
            "columns": [{"name": "id", "type": "INTEGER"}, {"name": "customer_id", "type": "INTEGER"}],
            "primary_key": ["id"],
            "foreign_keys": [
                {
                    "source_table": "orders",
                    "source_columns": ["customer_id"],
                    "target_table": "customers",
                    "target_columns": ["id"],
                }
            ],
            "indexes": [],
            "sample_rows": [],
            "row_count": 20,
        },
    ],
    "relationships": [
        {
            "source_table": "orders",
            "source_columns": ["customer_id"],
            "target_table": "customers",
            "target_columns": ["id"],
        }
    ],
}


def test_schema_chunk_creation_includes_required_chunk_types():
    chunks = create_schema_chunks(SCHEMA)
    chunk_types = {chunk["type"] for chunk in chunks}
    assert {"table_summary", "column_summary", "relationship_summary", "sample_value_summary", "business_meaning_summary", "example_question_mapping"} <= chunk_types


def test_retriever_returns_relevant_schema_chunks():
    chunks = create_schema_chunks(SCHEMA)
    index = SchemaVectorIndex()
    index.upsert_schema(1, "hash", chunks)
    results = index.retrieve(1, "hash", "orders by customer city", top_k=3)
    assert results
    assert any("orders" in chunk["metadata"]["tables"] for chunk in results)


def test_join_path_finder_returns_join_conditions():
    graph = RelationshipGraph(SCHEMA)
    paths = graph.find_join_paths(["orders", "customers"])
    assert paths
    assert paths[0]["joins"][0]["condition"] == "orders.customer_id = customers.id"
