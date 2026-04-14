"""Request and response models for the API."""

from pydantic import BaseModel


class QueryRequest(BaseModel):
    query: str
    top_k: int = 8


class QueryResponse(BaseModel):
    answer: str
    sources: list[str]
    query: str
