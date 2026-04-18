"""Boundary tests for SummaryService — pure in-process, no FastAPI/Chroma/OpenAI."""

from src.rag.models import GovernanceGap, ProductExposure, RiskFinding, SummaryReport
from src.rag.retriever import RetrievedDoc
from src.rag.summary.service import SummaryService
from src.rag.summary.ports import ExposureLookup


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _risk(app: str) -> RiskFinding:
    return RiskFinding(
        application=app,
        risk_rating="High",
        issue="test issue",
        revenue_at_risk_000s=100,
        recommended_action="fix it",
        priority="P1",
    )


def _report(*apps: str) -> SummaryReport:
    return SummaryReport(
        overall_health="Poor",
        executive_summary="summary",
        critical_risks=[_risk(a) for a in apps],
        governance_gaps=[],
        total_apps_reviewed=len(apps),
        total_arr_at_risk_000s=100 * len(apps),
    )


class StubRecords:
    def fetch(self) -> list[RetrievedDoc]:
        return []


class DictExposureLookup:
    def __init__(self, data: dict[str, list[tuple[str, int]]]):
        self._data = data

    def for_application(self, app_name: str) -> list[tuple[str, int]]:
        return self._data.get(app_name, [])


def _service(report: SummaryReport, exposures: dict[str, list[tuple[str, int]]]) -> SummaryService:
    return SummaryService(
        records=StubRecords(),
        analyst=lambda _docs: report,
        exposures=DictExposureLookup(exposures),
    )


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

def test_exposures_are_injected_into_risk_findings():
    svc = _service(_report("AuthService"), {"AuthService": [("Billing", 400)]})
    result = svc.run()
    assert result.critical_risks[0].product_exposures == [
        ProductExposure(product="Billing", arr_000s=400)
    ]


def test_unknown_application_gets_empty_exposures():
    svc = _service(_report("UnknownApp"), {})
    result = svc.run()
    assert result.critical_risks[0].product_exposures == []


def test_multiple_exposures_per_application():
    svc = _service(_report("AuthService"), {"AuthService": [("Billing", 400), ("Payments", 200), ("Analytics", 50)]})
    result = svc.run()
    assert result.critical_risks[0].product_exposures == [
        ProductExposure(product="Billing", arr_000s=400),
        ProductExposure(product="Payments", arr_000s=200),
        ProductExposure(product="Analytics", arr_000s=50),
    ]


def test_critical_risks_order_preserved():
    svc = _service(_report("AppA", "AppB", "AppC"), {"AppA": [("P1", 10)], "AppC": [("P2", 20)]})
    result = svc.run()
    assert [r.application for r in result.critical_risks] == ["AppA", "AppB", "AppC"]


def test_governance_gaps_passthrough():
    base = _report("AuthService")
    gap = GovernanceGap(application="AuthService", issue="no owner", recommended_action="assign one")
    report_with_gap = base.model_copy(update={"governance_gaps": [gap]})
    svc = _service(report_with_gap, {})
    result = svc.run()
    assert result.governance_gaps == [gap]
    assert result.overall_health == "Poor"
    assert result.executive_summary == "summary"
    assert result.total_apps_reviewed == 1
    assert result.total_arr_at_risk_000s == 100


def test_empty_critical_risks():
    svc = _service(_report(), {})
    result = svc.run()
    assert result.critical_risks == []
