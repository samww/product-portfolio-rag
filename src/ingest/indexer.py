"""Store documents in ChromaDB using explicitly computed OpenAI embeddings."""

from typing import Callable

import chromadb


def index_documents(
    documents: list[str],
    metadatas: list[dict],
    ids: list[str],
    collection: chromadb.Collection,
    embed: Callable[[list[str]], list[list[float]]],
) -> None:
    """Embed documents and upsert them into the ChromaDB collection.

    Args:
        documents: Text content for each document.
        metadatas: Metadata dicts (must include doc_type, division, risk_rating, status, owner).
        ids: Unique identifiers for each document.
        collection: ChromaDB collection to write into.
        embed: Callable that accepts a list of strings and returns a list of embedding vectors.
    """
    embeddings = embed(documents)
    collection.upsert(
        documents=documents,
        embeddings=embeddings,
        metadatas=metadatas,
        ids=ids,
    )
