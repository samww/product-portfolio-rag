from typing import Callable, Protocol, Sequence

from src.rag.models import SummaryReport
from src.rag.retriever import RetrievedDoc


class AtRiskRecordsSource(Protocol):
    def fetch(self) -> Sequence[RetrievedDoc]: ...


class ExposureLookup(Protocol):
    def for_application(self, app_name: str) -> Sequence[tuple[str, int]]: ...


StructuredAnalyst = Callable[[Sequence[RetrievedDoc]], SummaryReport]
