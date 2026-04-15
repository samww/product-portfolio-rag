"""TDD tests for the FastAPI endpoints.

Run with: uv run pytest tests/test_api.py -v
"""

import json
from unittest.mock import MagicMock

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from src.api.routes import router


def _stub_streaming_openai(tokens: list[str]):
    """Mock OpenAI client whose streaming completion yields token chunks."""
    def make_chunk(content):
        chunk = MagicMock()
        chunk.choices[0].delta.content = content
        return chunk

    client = MagicMock()
    client.chat.completions.create.return_value = iter(make_chunk(t) for t in tokens)
    return client


@pytest.fixture
def streaming_api_client(chroma_collection, stub_embed):
    """TestClient with a streaming OpenAI stub."""
    test_app = FastAPI()
    test_app.include_router(router)
    test_app.state.collection = chroma_collection
    test_app.state.embed = stub_embed
    test_app.state.openai_client = _stub_streaming_openai(["Hello", " world"])
    with TestClient(test_app, raise_server_exceptions=True) as c:
        yield c


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


# ---------------------------------------------------------------------------
# Cycle 11: GET /query/stream returns text/event-stream content type
# ---------------------------------------------------------------------------

def test_stream_returns_event_stream_content_type(streaming_api_client, chroma_collection, stub_embed):
    chroma_collection.upsert(
        documents=["Application: AuthService\nRisk: Critical"],
        embeddings=stub_embed(["Application: AuthService\nRisk: Critical"]),
        metadatas=[{"doc_type": "application", "division": "X",
                    "risk_rating": "Critical", "status": "Active", "owner": "X"}],
        ids=["app-authservice"],
    )
    response = streaming_api_client.get("/query/stream?query=test")
    assert response.status_code == 200
    assert "text/event-stream" in response.headers["content-type"]


# ---------------------------------------------------------------------------
# Cycle 12: stream body contains SSE data: lines for each token
# ---------------------------------------------------------------------------

def test_stream_body_contains_token_events(chroma_collection, stub_embed):
    test_app = FastAPI()
    test_app.include_router(router)
    test_app.state.collection = chroma_collection
    test_app.state.embed = stub_embed
    test_app.state.openai_client = _stub_streaming_openai(["Tok1", " Tok2"])
    chroma_collection.upsert(
        documents=["Application: AuthService\nRisk: Critical"],
        embeddings=stub_embed(["Application: AuthService\nRisk: Critical"]),
        metadatas=[{"doc_type": "application", "division": "X",
                    "risk_rating": "Critical", "status": "Active", "owner": "X"}],
        ids=["app-authservice"],
    )
    with TestClient(test_app, raise_server_exceptions=True) as c:
        response = c.get("/query/stream?query=test")
    lines = response.text.splitlines()
    data_lines = [l for l in lines if l.startswith("data: ")]
    token_lines = [l for l in data_lines if not l.startswith("data: [DONE]")]
    assert "data: Tok1" in token_lines
    assert "data:  Tok2" in token_lines


# ---------------------------------------------------------------------------
# Cycle 13: final [DONE] event contains JSON with sources, context, query
# ---------------------------------------------------------------------------

def test_stream_done_event_contains_sources_context_query(chroma_collection, stub_embed):
    test_app = FastAPI()
    test_app.include_router(router)
    test_app.state.collection = chroma_collection
    test_app.state.embed = stub_embed
    test_app.state.openai_client = _stub_streaming_openai(["answer"])
    doc_text = "Application: AuthService\nRisk: Critical"
    chroma_collection.upsert(
        documents=[doc_text],
        embeddings=stub_embed([doc_text]),
        metadatas=[{"doc_type": "application", "division": "X",
                    "risk_rating": "Critical", "status": "Active", "owner": "X"}],
        ids=["app-authservice"],
    )
    with TestClient(test_app, raise_server_exceptions=True) as c:
        response = c.get("/query/stream?query=Which+apps+are+critical")
    lines = response.text.splitlines()
    done_lines = [l for l in lines if l.startswith("data: [DONE]")]
    assert done_lines, "No [DONE] event found in stream"
    payload_str = done_lines[0][len("data: [DONE] "):]
    payload = json.loads(payload_str)
    assert "sources" in payload
    assert "context" in payload
    assert "query" in payload
    assert payload["query"] == "Which apps are critical"
    assert "AuthService" in payload["sources"]
    assert doc_text in payload["context"]
