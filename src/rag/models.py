"""Canonical structured output schemas used by the /summarise endpoint (Slice 5)."""

from pydantic import BaseModel


class RiskFinding(BaseModel):
    application: str
    risk_rating: str
    issue: str
    revenue_at_risk_000s: int
    recommended_action: str
    priority: str


class GovernanceGap(BaseModel):
    application: str
    issue: str
    recommended_action: str


class SummaryReport(BaseModel):
    overall_health: str
    executive_summary: str
    critical_risks: list[RiskFinding]
    governance_gaps: list[GovernanceGap]
    total_apps_reviewed: int
    total_arr_at_risk_000s: int
