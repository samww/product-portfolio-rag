"""Embed a query and retrieve the top-k most similar documents from ChromaDB."""

from dataclasses import dataclass, field
from typing import Callable

import chromadb


@dataclass
class RetrievedDoc:
    document: str
    metadata: dict
    distance: float


def _query_where(
    query_embedding: list[float],
    collection: chromadb.Collection,
    top_k: int,
    where: dict,
) -> list[RetrievedDoc]:
    """Run a filtered ChromaDB query; returns empty list if no matching docs exist."""
    count = collection.get(where=where, include=[])
    n_results = min(top_k, len(count["ids"]))
    if n_results == 0:
        return []
    results = collection.query(
        query_embeddings=[query_embedding],
        n_results=n_results,
        where=where,
        include=["documents", "metadatas", "distances"],
    )
    return [
        RetrievedDoc(document=doc, metadata=meta, distance=dist)
        for doc, meta, dist in zip(
            results["documents"][0],
            results["metadatas"][0],
            results["distances"][0],
        )
    ]


def retrieve_at_risk_docs(collection: chromadb.Collection) -> list[RetrievedDoc]:
    """Return all application docs with High/Critical risk OR empty owner, via metadata filter."""
    high_critical = collection.get(
        where={"$and": [
            {"doc_type": {"$eq": "application"}},
            {"risk_rating": {"$in": ["High", "Critical"]}},
        ]},
        include=["documents", "metadatas"],
    )
    no_owner = collection.get(
        where={"$and": [
            {"doc_type": {"$eq": "application"}},
            {"owner": {"$eq": ""}},
        ]},
        include=["documents", "metadatas"],
    )
    seen_ids: set[str] = set()
    results: list[RetrievedDoc] = []
    for batch in (high_critical, no_owner):
        for doc_id, doc, meta in zip(batch["ids"], batch["documents"], batch["metadatas"]):
            if doc_id not in seen_ids:
                seen_ids.add(doc_id)
                results.append(RetrievedDoc(document=doc, metadata=meta, distance=0.0))
    return results


def retrieve(
    query: str,
    collection: chromadb.Collection,
    embed: Callable[[list[str]], list[list[float]]],
    top_k: int = 8,
) -> list[RetrievedDoc]:
    """Embed query and return top_k applications + top_k products, sorted by distance."""
    query_embedding = embed([query])[0]
    app_docs = _query_where(query_embedding, collection, top_k, {"doc_type": "application"})
    product_docs = _query_where(query_embedding, collection, top_k, {"doc_type": "product"})
    combined = app_docs + product_docs
    combined.sort(key=lambda d: d.distance)
    return combined
