"""Entry point for the ingestion pipeline.

Usage:
    uv run python scripts/ingest.py           # skip if documents already exist
    uv run python scripts/ingest.py --reset   # force re-index
"""

import argparse
import os
import sys
from pathlib import Path

import chromadb
from dotenv import load_dotenv
from openai import OpenAI

# Allow importing src.* from project root
sys.path.insert(0, str(Path(__file__).parent.parent))

from src.ingest.chunker import chunk_application, chunk_product
from src.ingest.indexer import index_documents
from src.ingest.joiner import enrich_products
from src.ingest.loader import load_applications, load_products

DATA_DIR = Path(__file__).parent.parent / "data"
COLLECTION_NAME = "portfolio"


def build_embed_fn(openai_client: OpenAI):
    def _embed(texts: list[str]) -> list[list[float]]:
        response = openai_client.embeddings.create(
            model="text-embedding-3-small",
            input=texts,
        )
        return [item.embedding for item in response.data]
    return _embed


def main(reset: bool = False) -> None:
    load_dotenv()

    chroma_client = chromadb.PersistentClient(path=".chroma")
    collection = chroma_client.get_or_create_collection(COLLECTION_NAME)

    if collection.count() > 0 and not reset:
        print(f"Collection '{COLLECTION_NAME}' already contains {collection.count()} documents. "
              "Use --reset to force re-index.")
        return

    if reset and collection.count() > 0:
        chroma_client.delete_collection(COLLECTION_NAME)
        collection = chroma_client.create_collection(COLLECTION_NAME)
        print("Collection reset.")

    openai_client = OpenAI(api_key=os.environ["OPENAI_API_KEY"])
    embed = build_embed_fn(openai_client)

    apps = load_applications(DATA_DIR / "applications.json")
    products = load_products(DATA_DIR / "products.json")
    enriched = enrich_products(products, apps)

    docs, metadatas, ids = [], [], []

    for app in apps:
        docs.append(chunk_application(app))
        metadatas.append({
            "doc_type": "application",
            "division": app.division,
            "risk_rating": app.risk_rating,
            "status": app.status,
            "owner": app.owner,
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
        })
        ids.append(f"product-{ep.product.name.lower().replace(' ', '-')}")

    index_documents(docs, metadatas, ids, collection, embed)
    print(f"Indexed {collection.count()} documents into '{COLLECTION_NAME}'.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Ingest portfolio data into ChromaDB.")
    parser.add_argument("--reset", action="store_true", help="Force re-index.")
    args = parser.parse_args()
    main(reset=args.reset)
