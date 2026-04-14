"""Shared fixtures for ingestion pipeline tests."""

import uuid
from pathlib import Path

import chromadb
import pytest

FIXTURES_DIR = Path(__file__).parent / "fixtures"

_EMBEDDING_DIM = 8


@pytest.fixture
def sample_apps_path():
    return FIXTURES_DIR / "sample_applications.json"


@pytest.fixture
def sample_products_path():
    return FIXTURES_DIR / "sample_products.json"


@pytest.fixture
def chroma_collection():
    """In-memory ChromaDB collection for testing (isolated per test)."""
    client = chromadb.EphemeralClient()
    return client.create_collection(f"test_{uuid.uuid4().hex}")


@pytest.fixture
def stub_embed():
    """Deterministic embedding function: returns a fixed-length vector for any text."""
    def _embed(texts: list[str]) -> list[list[float]]:
        return [[float(i % _EMBEDDING_DIM) for i in range(_EMBEDDING_DIM)] for _ in texts]
    return _embed
