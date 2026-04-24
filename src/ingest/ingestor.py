"""Ingestor: single entrypoint orchestrating the full ingest pipeline."""

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Callable

import chromadb
import numpy as np

from src.ingest.chunker import chunk_application, chunk_product
from src.ingest.indexer import index_documents
from src.ingest.joiner import (
    compute_app_arr_at_risk,
    compute_app_product_exposures,
    enrich_products,
)
from src.ingest.loader import load_applications, load_products


@dataclass
class IngestResult:
    chunk_count: int
    exposures: dict[str, list[tuple[str, int]]]


class Ingestor:
    def __init__(
        self,
        collection: chromadb.Collection,
        embed: Callable[[list[str]], list[list[float]]],
        *,
        data_dir: Path = Path("data"),
        pca_path: Path | None = Path(".chroma/pca.npz"),
        points_path: Path | None = Path("src/frontend/public/points.json"),
    ) -> None:
        self._collection = collection
        self._embed = embed
        self._data_dir = data_dir
        self._pca_path = pca_path
        self._points_path = points_path

    def run(self, reset: bool = False) -> IngestResult:
        if self._collection.count() > 0 and not reset:
            exposures = self._compute_exposures()
            return IngestResult(chunk_count=self._collection.count(), exposures=exposures)

        if reset:
            if self._pca_path:
                self._pca_path.unlink(missing_ok=True)
            if self._points_path:
                self._points_path.unlink(missing_ok=True)

        apps = load_applications(self._data_dir / "applications.json")
        products = load_products(self._data_dir / "products.json")
        enriched = enrich_products(products, apps)
        arr_at_risk_by_app = compute_app_arr_at_risk(enriched)

        docs, metadatas, ids = [], [], []

        for app in apps:
            docs.append(chunk_application(app, arr_at_risk=arr_at_risk_by_app.get(app.name, 0)))
            metadatas.append({
                "doc_type": "application",
                "division": app.division,
                "risk_rating": app.risk_rating,
                "status": app.status,
                "owner": app.owner,
                "name": app.name,
                "summary": app.notes,
                "cost_000s": app.annual_cost_total,
            })
            ids.append(f"app-{app.name.lower().replace(' ', '-')}")

        for ep in enriched:
            docs.append(chunk_product(ep))
            metadatas.append({
                "doc_type": "product",
                "division": ep.product.division,
                "risk_rating": ep.highest_risk,
                "status": "Active",
                "owner": "",
                "name": ep.product.name,
                "summary": ep.product.description,
                "arr_000s": ep.product.arr,
            })
            ids.append(f"product-{ep.product.name.lower().replace(' ', '-')}")

        artifact = index_documents(docs, metadatas, ids, self._collection, self._embed)

        if self._pca_path:
            self._pca_path.parent.mkdir(parents=True, exist_ok=True)
            np.savez(self._pca_path, mean=artifact.mean, components=artifact.components)

        if self._points_path:
            self._points_path.parent.mkdir(parents=True, exist_ok=True)
            self._points_path.write_text(json.dumps(artifact.points, indent=2))

        exposures = compute_app_product_exposures(enriched)
        return IngestResult(chunk_count=len(docs), exposures=exposures)

    def _compute_exposures(self) -> dict[str, list[tuple[str, int]]]:
        apps = load_applications(self._data_dir / "applications.json")
        products = load_products(self._data_dir / "products.json")
        enriched = enrich_products(products, apps)
        return compute_app_product_exposures(enriched)
