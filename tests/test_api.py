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
    assert 'data: "Tok1"' in token_lines
    assert 'data: " Tok2"' in token_lines


# ---------------------------------------------------------------------------
# Cycle 13: final [DONE] event contains JSON with sources, context, query
# ---------------------------------------------------------------------------

# ---------------------------------------------------------------------------
# Cycle 14: POST /summarise returns 200 with SummaryReport shape
# ---------------------------------------------------------------------------

_SUMMARY_REPORT = {
    "overall_health": "Critical",
    "executive_summary": "Two applications are at high risk.",
    "critical_risks": [
        {
            "application": "AuthService",
            "risk_rating": "Critical",
            "issue": "Vendor EOL",
            "revenue_at_risk_000s": 6200,
            "recommended_action": "Migrate immediately",
            "priority": "P1",
        }
    ],
    "governance_gaps": [
        {
            "application": "ContractVault",
            "issue": "No named owner",
            "recommended_action": "Assign an owner",
        }
    ],
    "total_apps_reviewed": 2,
    "total_arr_at_risk_000s": 6200,
}


def _stub_summary_openai(report: dict):
    from unittest.mock import MagicMock
    parsed = MagicMock()
    parsed.model_dump.return_value = report
    choice = MagicMock()
    choice.message.parsed = parsed
    completion = MagicMock()
    completion.choices = [choice]
    client = MagicMock()
    client.beta.chat.completions.parse.return_value = completion
    return client


def _make_summarise_app(chroma_collection, stub_embed):
    """Minimal app with all state /summarise needs."""
    from src.rag.models import SummaryReport
    from src.rag.summary.adapters import DictExposureLookup
    from src.rag.summary.service import SummaryService

    canned = SummaryReport(**_SUMMARY_REPORT)
    test_app = FastAPI()
    test_app.include_router(router)
    test_app.state.collection = chroma_collection
    test_app.state.embed = stub_embed
    test_app.state.summary_service = SummaryService(
        records=type("R", (), {"fetch": lambda self: []})(),
        analyst=lambda _docs: canned,
        exposures=DictExposureLookup({}),
    )
    return test_app


def test_summarise_returns_200_with_summary_report_shape(chroma_collection, stub_embed):
    test_app = _make_summarise_app(chroma_collection, stub_embed)
    doc = "Application: AuthService\nRisk: Critical"
    chroma_collection.upsert(
        documents=[doc],
        embeddings=stub_embed([doc]),
        metadatas=[{"doc_type": "application", "division": "X",
                    "risk_rating": "Critical", "status": "Active", "owner": "alice"}],
        ids=["app-auth"],
    )
    with TestClient(test_app, raise_server_exceptions=True) as c:
        response = c.post("/summarise")
    assert response.status_code == 200
    body = response.json()
    assert "overall_health" in body
    assert "executive_summary" in body
    assert "critical_risks" in body
    assert "governance_gaps" in body
    assert "total_apps_reviewed" in body
    assert "total_arr_at_risk_000s" in body


def test_summarise_overall_health_is_valid_value(chroma_collection, stub_embed):
    test_app = _make_summarise_app(chroma_collection, stub_embed)
    with TestClient(test_app, raise_server_exceptions=True) as c:
        response = c.post("/summarise")
    assert response.json()["overall_health"] in ("Healthy", "At Risk", "Critical")


def test_summarise_route_delegates_to_summary_service():
    from src.rag.models import SummaryReport
    from src.rag.summary.adapters import DictExposureLookup
    from src.rag.summary.service import SummaryService

    canned_report = SummaryReport(**_SUMMARY_REPORT)
    svc = SummaryService(
        records=type("R", (), {"fetch": lambda self: []})(),
        analyst=lambda _docs: canned_report,
        exposures=DictExposureLookup({"AuthService": [("Billing", 400)]}),
    )
    test_app = FastAPI()
    test_app.include_router(router)
    test_app.state.summary_service = svc

    with TestClient(test_app, raise_server_exceptions=True) as c:
        response = c.post("/summarise")

    assert response.status_code == 200
    risks = response.json()["critical_risks"]
    assert risks[0]["application"] == "AuthService"
    assert risks[0]["product_exposures"] == [{"product": "Billing", "arr_000s": 400}]


# ---------------------------------------------------------------------------
# Cycle 15: GET / serves the frontend HTML (static files)
# ---------------------------------------------------------------------------

def test_get_root_serves_frontend_html():
    from fastapi.testclient import TestClient
    from src.api.main import app
    client = TestClient(app, raise_server_exceptions=True)
    response = client.get("/")
    assert response.status_code == 200
    assert "text/html" in response.headers["content-type"]


def test_get_embeddings_serves_spa_html():
    from fastapi.testclient import TestClient
    from src.api.main import app
    client = TestClient(app, raise_server_exceptions=True)
    response = client.get("/embeddings")
    assert response.status_code == 200
    assert "text/html" in response.headers["content-type"]


def test_get_assets_serves_static_files():
    import os
    from pathlib import Path
    from fastapi.testclient import TestClient
    from src.api.main import app
    # Find a real asset file from the built frontend
    assets_dir = Path("src/api/static/assets")
    asset_files = list(assets_dir.glob("*.js"))
    assert asset_files, "No built JS assets found — run npm run build first"
    asset_name = asset_files[0].name
    client = TestClient(app, raise_server_exceptions=True)
    response = client.get(f"/assets/{asset_name}")
    assert response.status_code == 200


# ---------------------------------------------------------------------------
# Cycle 19: GET /points.json returns a JSON array with required fields
# ---------------------------------------------------------------------------

def test_points_json_exists_in_static_dir():
    from pathlib import Path
    points_path = Path("src/api/static/points.json")
    assert points_path.exists(), (
        "points.json not found in src/api/static/ — "
        "run: uv run python scripts/ingest.py --reset --points-path src/api/static/points.json"
    )
    data = json.loads(points_path.read_text())
    assert isinstance(data, list)
    assert len(data) > 0
    first = data[0]
    assert "id" in first
    assert "division" in first
    assert "projected_xyz" in first
    assert len(first["projected_xyz"]) == 3


def test_get_points_json_served_as_json_not_html():
    from pathlib import Path
    from fastapi.testclient import TestClient
    from src.api.main import app
    points_path = Path("src/api/static/points.json")
    if not points_path.exists():
        pytest.skip("points.json not in static dir — bake it in via Docker build or run ingestion first")
    client = TestClient(app, raise_server_exceptions=True)
    response = client.get("/points.json")
    assert response.status_code == 200
    assert "application/json" in response.headers["content-type"]
    data = response.json()
    assert isinstance(data, list)
    assert len(data) > 0


# ---------------------------------------------------------------------------
# Cycle 16: POST /embeddings/project returns 503 when pca_artifact is None
# ---------------------------------------------------------------------------

def test_embeddings_project_503_when_pca_missing(chroma_collection, stub_embed):
    test_app = FastAPI()
    test_app.include_router(router)
    test_app.state.collection = chroma_collection
    test_app.state.embed = stub_embed
    test_app.state.pca_artifact = None
    with TestClient(test_app, raise_server_exceptions=True) as c:
        response = c.post("/embeddings/project", json={"query": "test"})
    assert response.status_code == 503
    assert response.json()["detail"] == "PCA artifact not found — run scripts/ingest.py"


# ---------------------------------------------------------------------------
# Cycle 17: POST /embeddings/project returns {projected_xyz, top_k_ids} on success
# ---------------------------------------------------------------------------

def _stub_pca_artifact():
    """PcaArtifact with 8-dim mean/components matching the stub_embed dimension."""
    import numpy as np
    from src.ingest.pca import PcaArtifact
    mean = np.zeros(8)
    components = np.eye(3, 8)
    return PcaArtifact(mean=mean, components=components)


def test_embeddings_project_returns_projected_xyz_and_top_k_ids(chroma_collection, stub_embed):
    test_app = FastAPI()
    test_app.include_router(router)
    test_app.state.collection = chroma_collection
    test_app.state.embed = stub_embed
    test_app.state.pca_artifact = _stub_pca_artifact()
    doc = "Application: AuthService\nRisk: Critical"
    chroma_collection.upsert(
        documents=[doc],
        embeddings=stub_embed([doc]),
        metadatas=[{"doc_type": "application", "division": "X",
                    "risk_rating": "Critical", "status": "Active", "owner": "X"}],
        ids=["app-authservice"],
    )
    with TestClient(test_app, raise_server_exceptions=True) as c:
        response = c.post("/embeddings/project", json={"query": "critical"})
    assert response.status_code == 200
    body = response.json()
    assert "projected_xyz" in body
    assert "top_k_ids" in body
    assert len(body["projected_xyz"]) == 3
    assert isinstance(body["top_k_ids"], list)
    assert all(isinstance(i, str) for i in body["top_k_ids"])
    assert "app-authservice" in body["top_k_ids"]


# ---------------------------------------------------------------------------
# Cycle 18: embed is called exactly once per /embeddings/project request
# ---------------------------------------------------------------------------

def test_embeddings_project_calls_embed_exactly_once(chroma_collection, stub_embed):
    from unittest.mock import MagicMock
    embed_mock = MagicMock(wraps=stub_embed)
    test_app = FastAPI()
    test_app.include_router(router)
    test_app.state.collection = chroma_collection
    test_app.state.embed = embed_mock
    test_app.state.pca_artifact = _stub_pca_artifact()
    with TestClient(test_app, raise_server_exceptions=True) as c:
        c.post("/embeddings/project", json={"query": "test query"})
    assert embed_mock.call_count == 1


def test_stream_done_event_contains_sources_context_query(chroma_collection, stub_embed):
    test_app = FastAPI()
    test_app.include_router(router)
    test_app.state.collection = chroma_collection
    test_app.state.embed = stub_embed
    # Answer mentions AuthService — it should appear in app_sources
    test_app.state.openai_client = _stub_streaming_openai(["AuthService", " is critical"])
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
    assert "app_sources" in payload
    assert "product_sources" in payload
    assert "context" in payload
    assert "query" in payload
    assert payload["query"] == "Which apps are critical"
    assert "AuthService" in payload["app_sources"]
    assert doc_text in payload["context"]


def test_stream_done_includes_all_retrieved_sources(chroma_collection, stub_embed):
    """[DONE] payload must include ALL retrieved source names, cited or not."""
    test_app = FastAPI()
    test_app.include_router(router)
    test_app.state.collection = chroma_collection
    test_app.state.embed = stub_embed
    # Answer mentions only AuthService — PaymentGateway is retrieved but not cited
    test_app.state.openai_client = _stub_streaming_openai(["AuthService", " is the relevant app"])
    for doc_id, name in [("app-authservice", "AuthService"), ("app-paymentgateway", "PaymentGateway")]:
        doc_text = f"Application: {name}\nRisk: High"
        chroma_collection.upsert(
            documents=[doc_text],
            embeddings=stub_embed([doc_text]),
            metadatas=[{"doc_type": "application", "division": "X",
                        "risk_rating": "High", "status": "Active", "owner": "X"}],
            ids=[doc_id],
        )
    with TestClient(test_app, raise_server_exceptions=True) as c:
        response = c.get("/query/stream?query=test")
    done_line = next(l for l in response.text.splitlines() if l.startswith("data: [DONE]"))
    payload = json.loads(done_line[len("data: [DONE] "):])
    assert "AuthService" in payload["app_sources"]
    assert "PaymentGateway" in payload["app_sources"]


# ---------------------------------------------------------------------------
# Cycle 21: production artifacts → /health non-zero count, /embeddings/project 200
# ---------------------------------------------------------------------------

@pytest.fixture
def production_collection():
    """Real ChromaDB collection from the baked-in .chroma artifact."""
    import chromadb as _chromadb
    chroma_path = ".chroma"
    client = _chromadb.PersistentClient(path=chroma_path)
    try:
        return client.get_collection("portfolio")
    except Exception:
        pytest.skip(".chroma/portfolio collection not found — run ingestion first")


@pytest.fixture
def production_pca():
    """Real PcaArtifact loaded from .chroma/pca.npz."""
    import numpy as np
    from src.ingest.pca import PcaArtifact
    pca_path = ".chroma/pca.npz"
    try:
        data = np.load(pca_path)
        return PcaArtifact(mean=data["mean"], components=data["components"])
    except Exception:
        pytest.skip(".chroma/pca.npz not found — run ingestion first")


def test_health_document_count_nonzero_with_production_artifacts(production_collection):
    test_app = FastAPI()
    test_app.include_router(router)
    test_app.state.collection = production_collection
    test_app.state.embed = MagicMock(return_value=[[0.0] * 1536])
    test_app.state.openai_client = _stub_openai()
    with TestClient(test_app, raise_server_exceptions=True) as c:
        response = c.get("/health")
    assert response.status_code == 200
    body = response.json()
    assert body["document_count"] > 0, (
        "Production collection is empty — ingestion artefacts not baked into image"
    )


def test_embeddings_project_200_with_production_artifacts(production_collection, production_pca):
    def _real_dim_embed(texts):
        return [[0.0] * production_pca.components.shape[1]] * len(texts)

    test_app = FastAPI()
    test_app.include_router(router)
    test_app.state.collection = production_collection
    test_app.state.embed = _real_dim_embed
    test_app.state.pca_artifact = production_pca
    with TestClient(test_app, raise_server_exceptions=True) as c:
        response = c.post("/embeddings/project", json={"query": "revenue at risk"})
    assert response.status_code == 200, (
        f"Expected 200 but got {response.status_code}: {response.text}"
    )


# ---------------------------------------------------------------------------
# Cycle 22: DataLicensing document present in baked-in corpus
# ---------------------------------------------------------------------------

def test_datalicensing_document_in_production_corpus(production_collection):
    results = production_collection.get(ids=["product-datalicensing"])
    assert results["documents"], (
        "product-datalicensing not found in corpus — ingestion artefacts may be stale or missing"
    )
    doc = results["documents"][0]
    assert doc.splitlines()[0] == "Product: DataLicensing", (
        f"First line of DataLicensing doc is '{doc.splitlines()[0]}', expected 'Product: DataLicensing'"
    )


# ---------------------------------------------------------------------------
# Cycle 20: lifespan makes zero OpenAI embedding calls at startup
# ---------------------------------------------------------------------------

def test_lifespan_makes_no_embedding_calls_at_startup(monkeypatch):
    import os
    from unittest.mock import MagicMock, patch
    from fastapi.testclient import TestClient
    from src.api.main import app, lifespan

    mock_openai_instance = MagicMock()
    mock_openai_cls = MagicMock(return_value=mock_openai_instance)
    mock_chroma = MagicMock()
    mock_collection = MagicMock()
    mock_collection.count.return_value = 44
    mock_chroma.get_or_create_collection.return_value = mock_collection

    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    with patch("src.api.main.OpenAI", mock_openai_cls), \
         patch("src.api.main.chromadb.PersistentClient", return_value=mock_chroma), \
         patch("src.api.main.load_dotenv"), \
         patch("src.api.main.np.load", return_value={"mean": [0.0], "components": [[1.0]]}):
        test_app = app.__class__(lifespan=lifespan)
        with TestClient(test_app):
            pass

    assert mock_openai_instance.embeddings.create.call_count == 0, (
        "lifespan called OpenAI embeddings.create — ingestion must not run at startup"
    )
