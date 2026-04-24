"""Tests for src.ingest module boundary and chunker↔retriever prefix contract."""

import importlib
from pathlib import Path

import pytest

from src.ingest import Ingestor
from src.rag.retriever import parse_doc_source, RetrievedDoc


# ---------------------------------------------------------------------------
# Cycle 1: internal modules must not be importable by their public names
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("module", [
    "src.ingest.loader",
    "src.ingest.joiner",
    "src.ingest.chunker",
    "src.ingest.indexer",
])
def test_internal_modules_not_importable_by_public_name(module):
    with pytest.raises(ModuleNotFoundError):
        importlib.import_module(module)


# ---------------------------------------------------------------------------
# Cycle 2: chunker → parse_doc_source round-trip via Ingestor public interface
# ---------------------------------------------------------------------------
# Every document stored by Ingestor.run() must be parseable by parse_doc_source
# — sealing the "Application: " / "Product: " prefix contract end-to-end.

def test_chunk_parse_roundtrip(chroma_collection, stub_embed, tmp_path):
    ingestor = Ingestor(
        chroma_collection,
        stub_embed,
        data_dir=Path("data"),
        pca_path=tmp_path / "pca.npz",
        points_path=tmp_path / "points.json",
    )
    ingestor.run()

    raw_docs = chroma_collection.get(include=["documents"])["documents"]
    assert raw_docs, "Collection must be non-empty after run()"

    for raw in raw_docs:
        doc = RetrievedDoc(document=raw, metadata={}, distance=0.0)
        kind, name = parse_doc_source(doc)
        assert kind in ("application", "product"), (
            f"Unknown kind {kind!r} for doc starting: {raw[:60]!r}"
        )
        assert name, f"Empty name parsed from doc starting: {raw[:60]!r}"
