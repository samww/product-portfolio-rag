"""API route handlers."""

import json

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse

from src.api.models import QueryRequest, QueryResponse
from src.rag.generator import generate_answer, generate_answer_stream
from src.rag.models import SummaryReport
from src.rag.retriever import retrieve, retrieve_by_vector, parse_doc_source
from src.ingest.pca import project

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


@router.post("/summarise", response_model=SummaryReport)
async def summarise(request: Request):
    return request.app.state.summary_service.run()


@router.get("/query/stream")
async def query_stream(query: str, top_k: int = 8, request: Request = None):
    docs = retrieve(
        query,
        request.app.state.collection,
        request.app.state.embed,
        top_k=top_k,
    )

    app_sources: list[str] = []
    product_sources: list[str] = []
    for doc in docs:
        kind, name = parse_doc_source(doc)
        if kind == "application":
            app_sources.append(name)
        elif kind == "product":
            product_sources.append(name)

    context_texts = [doc.document for doc in docs]

    def event_stream():
        for token in generate_answer_stream(query, docs, request.app.state.openai_client):
            yield f"data: {json.dumps(token)}\n\n"
        done_payload = json.dumps({
            "app_sources": app_sources,
            "product_sources": product_sources,
            "context": context_texts,
            "query": query,
        })
        yield f"data: [DONE] {done_payload}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@router.post("/embeddings/project")
async def embeddings_project(body: QueryRequest, request: Request):
    if request.app.state.pca_artifact is None:
        raise HTTPException(status_code=503, detail="PCA artifact not found — run scripts/ingest.py")
    embedding = request.app.state.embed([body.query])[0]
    xyz = project(request.app.state.pca_artifact, [embedding])[0].tolist()
    docs = retrieve_by_vector(embedding, request.app.state.collection, body.top_k)
    return {"projected_xyz": xyz, "top_k_ids": [doc.id for doc in docs]}
