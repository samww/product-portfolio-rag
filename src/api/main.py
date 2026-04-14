"""FastAPI application entry point."""

import os
from contextlib import asynccontextmanager

import chromadb
from dotenv import load_dotenv
from fastapi import FastAPI
from openai import OpenAI

from src.api.routes import router


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
    app.state.openai_client = openai_client
    app.state.collection = collection
    app.state.embed = _build_embed(openai_client)
    yield


app = FastAPI(title="Product Portfolio RAG", lifespan=lifespan)
app.include_router(router)
