"""TDD tests for src/rag/retriever.py

Run with: uv run pytest tests/test_retriever.py -v
"""

from src.rag.retriever import retrieve, RetrievedDoc

_APP_META = {"doc_type": "application", "division": "X", "risk_rating": "Low", "status": "Active", "owner": "X"}
_PRODUCT_META = {"doc_type": "product", "division": "X", "risk_rating": "Low", "status": "Active", "owner": ""}


# ---------------------------------------------------------------------------
# Cycle 1: retrieve returns documents from a seeded collection
# ---------------------------------------------------------------------------

def test_retrieve_returns_retrieved_docs(chroma_collection, stub_embed):
    chroma_collection.upsert(
        documents=["Application: AuthService\nRisk: Critical"],
        embeddings=stub_embed(["Application: AuthService\nRisk: Critical"]),
        metadatas=[{"doc_type": "application", "division": "Platform Engineering",
                    "risk_rating": "Critical", "status": "Active", "owner": "PE"}],
        ids=["app-authservice"],
    )
    results = retrieve("critical applications", chroma_collection, stub_embed, top_k=1)
    assert len(results) == 1
    assert isinstance(results[0], RetrievedDoc)
    assert "AuthService" in results[0].document


# ---------------------------------------------------------------------------
# Cycle 2: retrieve respects top_k per doc_type
# ---------------------------------------------------------------------------

def test_retrieve_respects_top_k(chroma_collection, stub_embed):
    app_docs = [f"Application: App{i}" for i in range(8)]
    product_docs = [f"Product: Prod{i}" for i in range(4)]
    all_docs = app_docs + product_docs
    chroma_collection.upsert(
        documents=all_docs,
        embeddings=stub_embed(all_docs),
        metadatas=[_APP_META] * 8 + [_PRODUCT_META] * 4,
        ids=[f"app-{i}" for i in range(8)] + [f"prod-{i}" for i in range(4)],
    )
    # top_k=3 → up to 3 apps + up to 3 products = at most 6
    results = retrieve("any query", chroma_collection, stub_embed, top_k=3)
    assert len(results) == 6


# ---------------------------------------------------------------------------
# Cycle 3: retrieve caps each type at its collection size
# ---------------------------------------------------------------------------

def test_retrieve_caps_at_collection_size(chroma_collection, stub_embed):
    docs = ["Application: OnlyOne"]
    chroma_collection.upsert(
        documents=docs,
        embeddings=stub_embed(docs),
        metadatas=[_APP_META],
        ids=["app-onlyone"],
    )
    # Only 1 application, no products — should return 1 total
    results = retrieve("any query", chroma_collection, stub_embed, top_k=10)
    assert len(results) == 1


# ---------------------------------------------------------------------------
# Cycle 4: retrieve queries applications and products independently
# ---------------------------------------------------------------------------

def test_retrieve_returns_both_doc_types(chroma_collection, stub_embed):
    chroma_collection.upsert(
        documents=["Application: AuthService", "Product: BrandTracking"],
        embeddings=stub_embed(["Application: AuthService", "Product: BrandTracking"]),
        metadatas=[_APP_META, _PRODUCT_META],
        ids=["app-auth", "prod-brand"],
    )
    results = retrieve("any query", chroma_collection, stub_embed, top_k=5)
    doc_types = {r.metadata["doc_type"] for r in results}
    assert doc_types == {"application", "product"}
