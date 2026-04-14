"""API route handlers."""

from fastapi import APIRouter, Request

from src.api.models import QueryRequest, QueryResponse
from src.rag.generator import generate_answer
from src.rag.retriever import retrieve

router = APIRouter()


@router.get("/health")
async def health(request: Request):
    count = request.app.state.collection.count()
    return {"status": "ok", "document_count": count}


@router.post("/query", response_model=QueryResponse)
async def query(body: QueryRequest, request: Request):
    docs = retrieve(
        body.query,
        request.app.state.collection,
        request.app.state.embed,
        top_k=body.top_k,
    )
    result = generate_answer(body.query, docs, request.app.state.openai_client)
    return QueryResponse(answer=result.answer, sources=result.sources, query=body.query)
