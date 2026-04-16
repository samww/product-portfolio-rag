"""Generate a grounded answer from retrieved context using GPT-4o."""

from collections.abc import Iterator
from dataclasses import dataclass

from openai import OpenAI

from pydantic import BaseModel

from src.rag.models import GovernanceGap, SummaryReport
from src.rag.prompts import SYSTEM_PROMPT, SUMMARY_SYSTEM_PROMPT
from src.rag.retriever import RetrievedDoc


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
    """Call GPT-4o with retrieved context and return answer + source names."""
    context = "\n\n---\n\n".join(doc.document for doc in retrieved_docs)
    sources = []
    for doc in retrieved_docs:
        first_line = doc.document.split("\n")[0]
        for prefix in ("Application: ", "Product: "):
            if first_line.startswith(prefix):
                sources.append(first_line[len(prefix):])
                break
        else:
            sources.append(first_line)

    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": f"Context:\n{context}\n\nQuestion: {query}"},
    ]
    completion = openai_client.chat.completions.create(
        model="gpt-4o",
        messages=messages,
    )
    answer = completion.choices[0].message.content
    return GeneratedAnswer(answer=answer, sources=sources)


def generate_summary(
    retrieved_docs: list[RetrievedDoc],
    openai_client: OpenAI,
) -> SummaryReport:
    """Call GPT-4o with structured output (response_format) to produce a SummaryReport."""
    context = "\n\n---\n\n".join(doc.document for doc in retrieved_docs)
    completion = openai_client.beta.chat.completions.parse(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": SUMMARY_SYSTEM_PROMPT},
            {"role": "user", "content": f"Portfolio data:\n{context}"},
        ],
        response_format=_SummaryReportLLM,
    )
    parsed = completion.choices[0].message.parsed
    return SummaryReport(**parsed.model_dump())


def generate_answer_stream(
    query: str,
    retrieved_docs: list[RetrievedDoc],
    openai_client: OpenAI,
) -> Iterator[str]:
    """Stream GPT-4o token deltas for the given query and retrieved context."""
    context = "\n\n---\n\n".join(doc.document for doc in retrieved_docs)
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": f"Context:\n{context}\n\nQuestion: {query}"},
    ]
    stream = openai_client.chat.completions.create(
        model="gpt-4o",
        messages=messages,
        stream=True,
    )
    for chunk in stream:
        delta = chunk.choices[0].delta.content
        if delta:
            yield delta
