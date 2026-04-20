"""PCA dimensionality reduction for embedding visualisation.

fit()     — centre embeddings, run SVD, return PcaArtifact with projected points
project() — apply stored mean/components to new embeddings
"""

from dataclasses import dataclass, field

import numpy as np


@dataclass
class PcaArtifact:
    mean: np.ndarray
    components: np.ndarray
    points: list[dict] = field(default_factory=list)


def fit(
    embeddings: list[list[float]],
    ids: list[str],
    metadatas: list[dict],
) -> PcaArtifact:
    X = np.array(embeddings, dtype=float)
    mean = X.mean(axis=0)
    X_c = X - mean
    _, _, Vt = np.linalg.svd(X_c, full_matrices=False)
    components = Vt[:3]

    projected = X_c @ components.T  # (N, 3)

    points = [
        {
            "id": ids[i],
            "doc_type": metadatas[i].get("doc_type", ""),
            "division": metadatas[i].get("division", ""),
            "name": metadatas[i].get("name", ""),
            "summary": metadatas[i].get("summary", ""),
            "risk_rating": metadatas[i].get("risk_rating", ""),
            "cost_000s": metadatas[i].get("cost_000s", 0),
            "arr_000s": metadatas[i].get("arr_000s", 0),
            "projected_xyz": projected[i].tolist(),
        }
        for i in range(len(ids))
    ]

    return PcaArtifact(mean=mean, components=components, points=points)


def project(artifact: PcaArtifact, embeddings: list[list[float]]) -> np.ndarray:
    X = np.array(embeddings, dtype=float)
    return (X - artifact.mean) @ artifact.components.T
