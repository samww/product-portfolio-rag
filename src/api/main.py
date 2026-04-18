"""FastAPI application entry point."""

import os
from contextlib import asynccontextmanager
from pathlib import Path

import chromadb
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from openai import OpenAI

from src.api.routes import router
from src.ingest.joiner import compute_app_product_exposures, enrich_products
from src.ingest.loader import load_applications, load_products
from src.rag.generator import generate_summary
from src.rag.summary.adapters import ChromaAtRiskSource, DictExposureLookup
from src.rag.summary.service import SummaryService

DATA_DIR = Path(__file__).parent.parent.parent / "data"


def _build_embed(openai_client: OpenAI):
    def _embed(texts: list[str]) -> list[list[float]]:
        response = openai_client.embeddings.create(
            model="text-embedding-3-small",
            input=texts,
        )
        return [item.embedding for item in response.data]
    return _embed


@asynccontextmanager
async def lifespan(app: FastAPI):
    load_dotenv()
    openai_client = OpenAI(api_key=os.environ["OPENAI_API_KEY"])
    chroma_client = chromadb.PersistentClient(path=".chroma")
    collection = chroma_client.get_or_create_collection("portfolio")
    apps = load_applications(DATA_DIR / "applications.json")
    products = load_products(DATA_DIR / "products.json")
    enriched = enrich_products(products, apps)
    app.state.openai_client = openai_client
    app.state.collection = collection
    app.state.embed = _build_embed(openai_client)
    app.state.summary_service = SummaryService(
        records=ChromaAtRiskSource(collection),
        analyst=lambda docs: generate_summary(list(docs), openai_client),
        exposures=DictExposureLookup(compute_app_product_exposures(enriched)),
    )
    yield


_STATIC_DIR = Path(__file__).parent / "static"

app = FastAPI(title="Product Portfolio RAG", lifespan=lifespan)
app.include_router(router)
app.mount("/", StaticFiles(directory=_STATIC_DIR, html=True), name="static")
