"""TDD tests for the FastAPI endpoints.

Run with: uv run pytest tests/test_api.py -v
"""

from unittest.mock import MagicMock

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from src.api.routes import router


def _stub_openai(answer: str = "Test answer."):
    """Minimal mock OpenAI client whose chat completion returns answer."""
    choice = MagicMock()
    choice.message.content = answer
    completion = MagicMock()
    completion.choices = [choice]
    client = MagicMock()
    client.chat.completions.create.return_value = completion
    return client


@pytest.fixture
def api_client(chroma_collection, stub_embed):
    """TestClient using a lifespan-free app with injected test state."""
    test_app = FastAPI()
    test_app.include_router(router)
    test_app.state.collection = chroma_collection
    test_app.state.embed = stub_embed
    test_app.state.openai_client = _stub_openai()
    with TestClient(test_app, raise_server_exceptions=True) as c:
        yield c


# ---------------------------------------------------------------------------
# Cycle 7: GET /health returns {"status": "ok", "document_count": n}
# ---------------------------------------------------------------------------

def test_health_returns_ok(api_client, chroma_collection, stub_embed):
    # seed one document so count is predictable
    chroma_collection.upsert(
        documents=["Application: AuthService"],
        embeddings=stub_embed(["Application: AuthService"]),
        metadatas=[{"doc_type": "application", "division": "X",
                    "risk_rating": "Low", "status": "Active", "owner": "X"}],
        ids=["app-authservice"],
    )
    response = api_client.get("/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["document_count"] == 1


# ---------------------------------------------------------------------------
# Cycle 8: POST /query returns QueryResponse shape
# ---------------------------------------------------------------------------

def test_query_returns_response_shape(api_client, chroma_collection, stub_embed):
    chroma_collection.upsert(
        documents=["Application: AuthService\nRisk: Critical"],
        embeddings=stub_embed(["Application: AuthService\nRisk: Critical"]),
        metadatas=[{"doc_type": "application", "division": "X",
                    "risk_rating": "Critical", "status": "Active", "owner": "X"}],
        ids=["app-authservice"],
    )
    response = api_client.post("/query", json={"query": "Which apps are critical?"})
    assert response.status_code == 200
    body = response.json()
    assert "answer" in body
    assert "sources" in body
    assert "query" in body
    assert body["query"] == "Which apps are critical?"


# ---------------------------------------------------------------------------
# Cycle 9: POST /query returns 422 when query field is missing
# ---------------------------------------------------------------------------

def test_query_missing_field_returns_422(api_client):
    response = api_client.post("/query", json={})
    assert response.status_code == 422
