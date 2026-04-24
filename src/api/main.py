"""FastAPI application entry point."""

import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path

import chromadb
import numpy as np
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.responses import FileResponse
from openai import OpenAI

from src.api.routes import router
from src.ingest import Ingestor
from src.ingest.pca import PcaArtifact
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
    embed = _build_embed(openai_client)
    app.state.openai_client = openai_client
    app.state.collection = collection
    app.state.embed = embed
    app.state.summary_service = SummaryService(
        records=ChromaAtRiskSource(collection),
        analyst=lambda docs: generate_summary(list(docs), openai_client),
        exposures=DictExposureLookup(Ingestor(collection, embed).exposures()),
    )
    pca_path = Path(".chroma/pca.npz")
    try:
        data = np.load(pca_path)
        app.state.pca_artifact = PcaArtifact(mean=data["mean"], components=data["components"])
    except Exception:
        logging.warning("PCA artifact not found — run scripts/ingest.py")
        app.state.pca_artifact = None
    yield


_STATIC_DIR = Path(__file__).parent / "static"

app = FastAPI(title="Product Portfolio RAG", lifespan=lifespan)
app.include_router(router)


@app.get("/{path:path}")
async def spa_fallback(path: str) -> FileResponse:
    candidate = _STATIC_DIR / path
    if candidate.is_file():
        return FileResponse(candidate)
    return FileResponse(_STATIC_DIR / "index.html")
