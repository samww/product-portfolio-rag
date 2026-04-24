"""Boundary tests for the Ingestor orchestration class.

Run with: uv run pytest tests/test_ingestor.py -v
"""

import json
from pathlib import Path

import numpy as np
import pytest

from src.ingest import Ingestor, IngestResult


# ---------------------------------------------------------------------------
# Cycle 1: run() returns an IngestResult with chunk_count > 0
# ---------------------------------------------------------------------------

def test_run_returns_ingest_result(chroma_collection, stub_embed, tmp_path):
    ingestor = Ingestor(
        chroma_collection,
        stub_embed,
        data_dir=Path("data"),
        pca_path=tmp_path / "pca.npz",
        points_path=tmp_path / "points.json",
    )
    result = ingestor.run()
    assert isinstance(result, IngestResult)
    assert result.chunk_count > 0


# ---------------------------------------------------------------------------
# Cycle 2: run() populates the Chroma collection
# ---------------------------------------------------------------------------

def test_run_populates_collection(chroma_collection, stub_embed, tmp_path):
    ingestor = Ingestor(
        chroma_collection,
        stub_embed,
        data_dir=Path("data"),
        pca_path=tmp_path / "pca.npz",
        points_path=tmp_path / "points.json",
    )
    result = ingestor.run()
    assert chroma_collection.count() == result.chunk_count


# ---------------------------------------------------------------------------
# Cycle 3: run(reset=False) is a no-op when collection already has docs
# ---------------------------------------------------------------------------

def test_run_noop_when_already_populated(chroma_collection, stub_embed, tmp_path):
    ingestor = Ingestor(
        chroma_collection,
        stub_embed,
        data_dir=Path("data"),
        pca_path=tmp_path / "pca.npz",
        points_path=tmp_path / "points.json",
    )
    first = ingestor.run()
    second = ingestor.run()
    assert chroma_collection.count() == first.chunk_count
    assert second.chunk_count == first.chunk_count


# ---------------------------------------------------------------------------
# Cycle 4: run(reset=True) wipes pca.npz and points.json before re-indexing
# ---------------------------------------------------------------------------

def test_run_reset_wipes_artifacts(chroma_collection, stub_embed, tmp_path):
    pca_path = tmp_path / "pca.npz"
    points_path = tmp_path / "points.json"
    ingestor = Ingestor(
        chroma_collection,
        stub_embed,
        data_dir=Path("data"),
        pca_path=pca_path,
        points_path=points_path,
    )
    ingestor.run()
    assert pca_path.exists()
    assert points_path.exists()

    # Simulate stale artifacts present before reset
    stale_marker = b"stale"
    pca_path.write_bytes(stale_marker)
    points_path.write_text("stale")

    ingestor.run(reset=True)

    # Artifacts must be recreated (not left as stale content)
    assert pca_path.exists()
    assert pca_path.read_bytes() != stale_marker


# ---------------------------------------------------------------------------
# Cycle 5: PCA round-trip — project first doc embedding, recover projected_xyz
# ---------------------------------------------------------------------------

def test_pca_roundtrip_first_doc(chroma_collection, stub_embed, tmp_path):
    pca_path = tmp_path / "pca.npz"
    points_path = tmp_path / "points.json"
    ingestor = Ingestor(
        chroma_collection,
        stub_embed,
        data_dir=Path("data"),
        pca_path=pca_path,
        points_path=points_path,
    )
    ingestor.run()

    npz = np.load(pca_path)
    mean = npz["mean"]
    components = npz["components"]

    points = json.loads(points_path.read_text())
    first = points[0]

    # Re-project the first doc's embedding using the stored PCA artifact
    first_embedding = np.array(stub_embed(["dummy"])[0])
    projected = (first_embedding - mean) @ components.T

    np.testing.assert_allclose(projected, first["projected_xyz"], atol=1e-6)


# ---------------------------------------------------------------------------
# Cycle 6: points.json has one entry per doc with required frontend shape
# ---------------------------------------------------------------------------

def test_points_json_shape(chroma_collection, stub_embed, tmp_path):
    points_path = tmp_path / "points.json"
    ingestor = Ingestor(
        chroma_collection,
        stub_embed,
        data_dir=Path("data"),
        pca_path=tmp_path / "pca.npz",
        points_path=points_path,
    )
    result = ingestor.run()

    points = json.loads(points_path.read_text())
    assert len(points) == result.chunk_count

    required_keys = {"id", "doc_type", "division", "name", "summary",
                     "risk_rating", "cost_000s", "arr_000s", "projected_xyz"}
    for point in points:
        assert required_keys == set(point.keys()), f"Shape mismatch: {set(point.keys())}"
        assert len(point["projected_xyz"]) == 3
