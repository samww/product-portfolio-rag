"""API route handlers."""

import json

from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse

from src.api.models import QueryRequest, QueryResponse
from src.rag.generator import generate_answer, generate_answer_stream, generate_summary
from src.rag.models import SummaryReport
from src.rag.retriever import retrieve, retrieve_at_risk_docs

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
    docs = retrieve_at_risk_docs(request.app.state.collection)
    report = generate_summary(docs, request.app.state.openai_client)
    return report


@router.get("/query/stream")
async def query_stream(query: str, top_k: int = 8, request: Request = None):
    docs = retrieve(
        query,
        request.app.state.collection,
        request.app.state.embed,
        top_k=top_k,
    )

    sources = []
    for doc in docs:
        first_line = doc.document.split("\n")[0]
        for prefix in ("Application: ", "Product: "):
            if first_line.startswith(prefix):
                sources.append(first_line[len(prefix):])
                break
        else:
            sources.append(first_line)

    context_texts = [doc.document for doc in docs]

    def event_stream():
        for token in generate_answer_stream(query, docs, request.app.state.openai_client):
            yield f"data: {token}\n\n"
        done_payload = json.dumps({"sources": sources, "context": context_texts, "query": query})
        yield f"data: [DONE] {done_payload}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")
