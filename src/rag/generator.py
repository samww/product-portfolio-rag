"""Generate a grounded answer from retrieved context using GPT-6.1 Terra."""

from collections.abc import Iterator
from dataclasses import dataclass

from openai import OpenAI

from pydantic import BaseModel

from src.rag.models import GovernanceGap, SummaryReport
from src.rag.prompts import SYSTEM_PROMPT, SUMMARY_SYSTEM_PROMPT
from src.rag.retriever import RetrievedDoc, parse_doc_source

CHAT_MODEL = "gpt-6.1-terra"
# Effort "none" is the only level that accepts temperature; chat keeps it for low latency.
CHAT_REASONING_EFFORT = "none"
# Summary is non-streamed and does arithmetic/prioritisation, so it trades latency for reasoning.
SUMMARY_REASONING_EFFORT = "low"


class _RiskFindingLLM(BaseModel):
    application: str
    risk_rating: str
    issue: str
    revenue_at_risk_000s: int
    recommended_action: str
    priority: str


class _SummaryReportLLM(BaseModel):
    overall_health: str
    executive_summary: str
    critical_risks: list[_RiskFindingLLM]
    governance_gaps: list[GovernanceGap]
    total_apps_reviewed: int
    total_arr_at_risk_000s: int


@dataclass
class GeneratedAnswer:
    answer: str
    sources: list[str]


def generate_answer(
    query: str,
    retrieved_docs: list[RetrievedDoc],
    openai_client: OpenAI,
) -> GeneratedAnswer:
    """Call GPT-6.1 Terra with retrieved context and return answer + source names."""
    context = "\n\n---\n\n".join(doc.document for doc in retrieved_docs)
    sources = [parse_doc_source(doc)[1] for doc in retrieved_docs]

    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": f"Context:\n{context}\n\nQuestion: {query}"},
    ]
    completion = openai_client.chat.completions.create(
        model=CHAT_MODEL,
        messages=messages,
        reasoning_effort=CHAT_REASONING_EFFORT,
        temperature=0,
    )
    answer = completion.choices[0].message.content
    return GeneratedAnswer(answer=answer, sources=sources)


def generate_summary(
    retrieved_docs: list[RetrievedDoc],
    openai_client: OpenAI,
) -> SummaryReport:
    """Call GPT-6.1 Terra with structured output (response_format) to produce a SummaryReport."""
    context = "\n\n---\n\n".join(doc.document for doc in retrieved_docs)
    completion = openai_client.chat.completions.parse(
        model=CHAT_MODEL,
        messages=[
            {"role": "system", "content": SUMMARY_SYSTEM_PROMPT},
            {"role": "user", "content": f"Portfolio data:\n{context}"},
        ],
        response_format=_SummaryReportLLM,
        reasoning_effort=SUMMARY_REASONING_EFFORT,
    )
    parsed = completion.choices[0].message.parsed
    return SummaryReport(**parsed.model_dump())


def generate_answer_stream(
    query: str,
    retrieved_docs: list[RetrievedDoc],
    openai_client: OpenAI,
) -> Iterator[str]:
    """Stream GPT-6.1 Terra token deltas for the given query and retrieved context."""
    context = "\n\n---\n\n".join(doc.document for doc in retrieved_docs)
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": f"Context:\n{context}\n\nQuestion: {query}"},
    ]
    stream = openai_client.chat.completions.create(
        model=CHAT_MODEL,
        messages=messages,
        reasoning_effort=CHAT_REASONING_EFFORT,
        temperature=0,
        stream=True,
    )
    for chunk in stream:
        delta = chunk.choices[0].delta.content
        if delta:
            yield delta
