"""TDD tests for src/rag/retriever.py

Run with: uv run pytest tests/test_retriever.py -v
"""

from src.rag.retriever import retrieve, retrieve_by_vector, retrieve_at_risk_docs, RetrievedDoc, parse_doc_source

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


# ---------------------------------------------------------------------------
# Cycle 5: retrieve_at_risk_docs returns High/Critical risk application docs
# ---------------------------------------------------------------------------

def test_retrieve_at_risk_docs_returns_high_critical_risk(chroma_collection, stub_embed):
    docs = [
        "Application: AuthService\nRisk: Critical",
        "Application: ForecastTool\nRisk: High",
        "Application: BillingApp\nRisk: Low",
    ]
    metadatas = [
        {**_APP_META, "risk_rating": "Critical", "owner": "alice"},
        {**_APP_META, "risk_rating": "High", "owner": "bob"},
        {**_APP_META, "risk_rating": "Low", "owner": "carol"},
    ]
    chroma_collection.upsert(
        documents=docs,
        embeddings=stub_embed(docs),
        metadatas=metadatas,
        ids=["app-auth", "app-forecast", "app-billing"],
    )
    results = retrieve_at_risk_docs(chroma_collection)
    names = [r.metadata.get("owner") for r in results]
    assert "alice" in names
    assert "bob" in names
    assert "carol" not in names


# ---------------------------------------------------------------------------
# Cycle 6: retrieve_at_risk_docs includes apps with no owner (empty string)
# ---------------------------------------------------------------------------

def test_retrieve_at_risk_docs_includes_no_owner_apps(chroma_collection, stub_embed):
    docs = [
        "Application: ContractVault\nOwner: No named owner",
        "Application: SafeApp\nRisk: Low",
    ]
    metadatas = [
        {**_APP_META, "risk_rating": "Low", "owner": ""},
        {**_APP_META, "risk_rating": "Low", "owner": "charlie"},
    ]
    chroma_collection.upsert(
        documents=docs,
        embeddings=stub_embed(docs),
        metadatas=metadatas,
        ids=["app-contract", "app-safe"],
    )
    results = retrieve_at_risk_docs(chroma_collection)
    documents = [r.document for r in results]
    assert any("ContractVault" in d for d in documents)
    assert all("SafeApp" not in d for d in documents)


# ---------------------------------------------------------------------------
# Cycle 7: retrieve_at_risk_docs deduplicates a doc that matches both filters
# ---------------------------------------------------------------------------

def test_retrieve_at_risk_docs_deduplicates(chroma_collection, stub_embed):
    doc = "Application: ForecastTool\nRisk: High"
    chroma_collection.upsert(
        documents=[doc],
        embeddings=stub_embed([doc]),
        metadatas=[{**_APP_META, "risk_rating": "High", "owner": ""}],
        ids=["app-forecast"],
    )
    results = retrieve_at_risk_docs(chroma_collection)
    assert len(results) == 1


# ---------------------------------------------------------------------------
# Cycle 8: parse_doc_source extracts kind and name from Application prefix
# ---------------------------------------------------------------------------

def test_parse_doc_source_application():
    doc = RetrievedDoc(
        document="Application: AuthService\nRisk: Critical",
        metadata={},
        distance=0.0,
    )
    kind, name = parse_doc_source(doc)
    assert kind == "application"
    assert name == "AuthService"


# ---------------------------------------------------------------------------
# Cycle 9: parse_doc_source extracts kind and name from Product prefix
# ---------------------------------------------------------------------------

def test_parse_doc_source_product():
    doc = RetrievedDoc(
        document="Product: BrandTracking\nVendor: Salesforce",
        metadata={},
        distance=0.0,
    )
    kind, name = parse_doc_source(doc)
    assert kind == "product"
    assert name == "BrandTracking"


# ---------------------------------------------------------------------------
# Cycle 10: parse_doc_source returns None kind for unrecognised prefix
# ---------------------------------------------------------------------------

def test_parse_doc_source_unknown_prefix():
    doc = RetrievedDoc(
        document="Some other content\nno prefix here",
        metadata={},
        distance=0.0,
    )
    kind, name = parse_doc_source(doc)
    assert kind is None
    assert name == "Some other content"


# ---------------------------------------------------------------------------
# Cycle 11: retrieve_by_vector returns same results as retrieve() when the
# embedding matches what embed() would produce for the same query
# ---------------------------------------------------------------------------

def test_retrieve_by_vector_matches_retrieve(chroma_collection, stub_embed):
    docs = ["Application: AuthService\nRisk: Critical", "Product: BrandTracking"]
    chroma_collection.upsert(
        documents=docs,
        embeddings=stub_embed(docs),
        metadatas=[_APP_META, _PRODUCT_META],
        ids=["app-auth", "prod-brand"],
    )
    query = "critical applications"
    precomputed = stub_embed([query])[0]
    by_vector = retrieve_by_vector(precomputed, chroma_collection, top_k=5)
    by_retrieve = retrieve(query, chroma_collection, stub_embed, top_k=5)
    assert len(by_vector) == len(by_retrieve)
    assert [r.document for r in by_vector] == [r.document for r in by_retrieve]
