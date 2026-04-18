from dataclasses import dataclass

import chromadb

from src.rag.retriever import RetrievedDoc, retrieve_at_risk_docs


@dataclass(frozen=True)
class DictExposureLookup:
    _data: dict[str, list[tuple[str, int]]]

    def for_application(self, app_name: str) -> list[tuple[str, int]]:
        return self._data.get(app_name, [])


@dataclass(frozen=True)
class ChromaAtRiskSource:
    _collection: chromadb.Collection

    def fetch(self) -> list[RetrievedDoc]:
        return retrieve_at_risk_docs(self._collection)
