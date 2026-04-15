"""Generate a grounded answer from retrieved context using GPT-4o."""

from collections.abc import Iterator
from dataclasses import dataclass

from openai import OpenAI

from src.rag.prompts import SYSTEM_PROMPT
from src.rag.retriever import RetrievedDoc


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
