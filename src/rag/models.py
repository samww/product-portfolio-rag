"""Canonical structured output schemas used by the /summarise endpoint (Slice 6)."""

from pydantic import BaseModel


class RiskFinding(BaseModel):
    application: str
    risk_rating: str
    status: str
    affected_products: list[str]
    revenue_at_risk: int


class GovernanceGap(BaseModel):
    application: str
    issue: str


class SummaryReport(BaseModel):
    total_revenue_at_risk: int
    risk_findings: list[RiskFinding]
    governance_gaps: list[GovernanceGap]
    narrative: str
