"""TDD tests for src/ingest/pca.py pure functions.

Run with: uv run pytest tests/test_pca.py -v
"""

import numpy as np
import pytest

from src.ingest.pca import PcaArtifact, fit, project

# ---------------------------------------------------------------------------
# Shared synthetic data
# ---------------------------------------------------------------------------

N, D = 10, 8  # 10 points, 8-dimensional embeddings

_RNG = np.random.default_rng(42)
_X_RANDOM = _RNG.standard_normal((N, D)).tolist()

_IDS = [f"id-{i}" for i in range(N)]
_METADATAS = [
    {
        "doc_type": "application" if i % 2 == 0 else "product",
        "division": f"div-{i % 3}",
        "name": f"Record {i}",
        "summary": f"Summary for record {i}",
        "risk_rating": "Low",
    }
    for i in range(N)
]


# ---------------------------------------------------------------------------
# Cycle 1: fit() returns PcaArtifact with correct shapes
# ---------------------------------------------------------------------------

def test_fit_returns_pca_artifact():
    artifact = fit(_X_RANDOM, _IDS, _METADATAS)
    assert isinstance(artifact, PcaArtifact)


def test_fit_mean_shape():
    artifact = fit(_X_RANDOM, _IDS, _METADATAS)
    assert artifact.mean.shape == (D,)


def test_fit_components_shape():
    artifact = fit(_X_RANDOM, _IDS, _METADATAS)
    assert artifact.components.shape == (3, D)


def test_fit_points_length():
    artifact = fit(_X_RANDOM, _IDS, _METADATAS)
    assert len(artifact.points) == N


# ---------------------------------------------------------------------------
# Cycle 2: mean-centering correctness
# ---------------------------------------------------------------------------

def test_fit_mean_equals_column_mean():
    artifact = fit(_X_RANDOM, _IDS, _METADATAS)
    expected = np.array(_X_RANDOM).mean(axis=0)
    np.testing.assert_allclose(artifact.mean, expected)


# ---------------------------------------------------------------------------
# Cycle 3: rank-3 reconstruction bound
# ---------------------------------------------------------------------------

def test_fit_rank3_reconstruction_error_is_small():
    rng = np.random.default_rng(7)
    # Build a matrix with rank-3 signal + tiny noise so PCA should capture it well
    signal = rng.standard_normal((N, 3)) @ rng.standard_normal((3, D))
    noise = rng.standard_normal((N, D)) * 1e-3
    X = signal + noise
    ids = [f"id-{i}" for i in range(N)]
    metas = [{"doc_type": "application", "division": "x", "name": f"r{i}",
               "summary": "", "risk_rating": "Low"} for i in range(N)]

    artifact = fit(X.tolist(), ids, metas)
    projected = np.array([p["projected_xyz"] for p in artifact.points])
    reconstructed = projected @ artifact.components + artifact.mean

    relative_error = np.linalg.norm(X - reconstructed) / np.linalg.norm(X)
    assert relative_error < 0.01, f"Relative reconstruction error {relative_error:.4f} exceeds 0.01"


# ---------------------------------------------------------------------------
# Cycle 4: project() shape and consistency with fit() stored points
# ---------------------------------------------------------------------------

def test_project_returns_correct_shape():
    artifact = fit(_X_RANDOM, _IDS, _METADATAS)
    result = project(artifact, _X_RANDOM)
    assert result.shape == (N, 3)


def test_project_matches_stored_projected_xyz():
    artifact = fit(_X_RANDOM, _IDS, _METADATAS)
    result = project(artifact, _X_RANDOM)
    stored = np.array([p["projected_xyz"] for p in artifact.points])
    np.testing.assert_allclose(result, stored, atol=1e-10)


# ---------------------------------------------------------------------------
# Cycle 5: each point has all required metadata fields with correct types
# ---------------------------------------------------------------------------

_REQUIRED_FIELDS = ("id", "doc_type", "division", "name", "summary", "risk_rating", "projected_xyz")


def test_points_have_all_required_fields():
    artifact = fit(_X_RANDOM, _IDS, _METADATAS)
    for point in artifact.points:
        for field in _REQUIRED_FIELDS:
            assert field in point, f"Point missing field: {field}"


def test_points_projected_xyz_has_length_3():
    artifact = fit(_X_RANDOM, _IDS, _METADATAS)
    for point in artifact.points:
        assert len(point["projected_xyz"]) == 3


def test_points_metadata_values_match_input():
    artifact = fit(_X_RANDOM, _IDS, _METADATAS)
    for i, point in enumerate(artifact.points):
        assert point["id"] == _IDS[i]
        assert point["name"] == _METADATAS[i]["name"]
        assert point["doc_type"] == _METADATAS[i]["doc_type"]
