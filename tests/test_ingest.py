"""TDD tests for the ingestion pipeline.

Run with: uv run pytest tests/test_ingest.py -v
"""

from src.ingest.loader import load_applications, load_products
from src.ingest.joiner import enrich_products
from src.ingest.chunker import chunk_application, chunk_product
from src.rag.retriever import parse_doc_source, RetrievedDoc


# ---------------------------------------------------------------------------
# Cycle 1: chunker → parse_doc_source round-trip contract
# ---------------------------------------------------------------------------
# For every Application and EnrichedProduct in the fixtures, the round-trip
# chunk_*(x) → parse_doc_source(RetrievedDoc(...)) must recover (kind, name).
# This seals the implicit prefix contract between chunker.py and retriever.py.

def test_chunk_parse_roundtrip(sample_apps_path, sample_products_path):
    apps = load_applications(sample_apps_path)
    enriched = enrich_products(load_products(sample_products_path), apps)

    for app in apps:
        doc = RetrievedDoc(document=chunk_application(app), metadata={}, distance=0.0)
        kind, name = parse_doc_source(doc)
        assert kind == "application", f"Expected 'application' for {app.name!r}, got {kind!r}"
        assert name == app.name, f"Expected {app.name!r}, got {name!r}"

    for ep in enriched:
        doc = RetrievedDoc(document=chunk_product(ep), metadata={}, distance=0.0)
        kind, name = parse_doc_source(doc)
        assert kind == "product", f"Expected 'product' for {ep.product.name!r}, got {kind!r}"
        assert name == ep.product.name, f"Expected {ep.product.name!r}, got {name!r}"
