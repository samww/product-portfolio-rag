"""Store documents in ChromaDB using explicitly computed OpenAI embeddings."""

from typing import Callable

import chromadb

from src.ingest.pca import PcaArtifact, fit


def index_documents(
    documents: list[str],
    metadatas: list[dict],
    ids: list[str],
    collection: chromadb.Collection,
    embed: Callable[[list[str]], list[list[float]]],
) -> PcaArtifact:
    """Embed documents, upsert into ChromaDB, fit PCA, and return the artifact.

    metadatas must include: doc_type, division, risk_rating, status, owner, name, summary.
    """
    embeddings = embed(documents)
    collection.upsert(
        documents=documents,
        embeddings=embeddings,
        metadatas=metadatas,
        ids=ids,
    )
    return fit(embeddings, ids, metadatas)
