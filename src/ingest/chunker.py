"""Format application and enriched product records as labelled text blocks for embedding."""

from src.ingest.loader import Application
from src.ingest.joiner import EnrichedProduct


def _app_flags(app: Application) -> str:
    flags = []
    if not app.owner.strip():
        flags.append("No named owner")
    if "end-of-life" in app.status.lower():
        flags.append("End of life")
    if app.risk_rating in ("Critical", "High"):
        flags.append(f"{app.risk_rating} risk")
    return ", ".join(flags) if flags else "None"


def chunk_application(app: Application) -> str:
    return (
        f"Application: {app.name}\n"
        f"Flags: {_app_flags(app)}\n"
        f"Division: {app.division}\n"
        f"Business Capability: {app.business_capability}\n"
        f"Technology: {app.technology_stack}\n"
        f"Owner: {app.owner or 'No named owner'}\n"
        f"Risk: {app.risk_rating}\n"
        f"Status: {app.status}\n"
        f"Annual Cost: {app.annual_cost_total}\n"
        f"Dependencies: {', '.join(app.dependencies) if app.dependencies else 'None'}\n"
        f"Dependents: {', '.join(app.dependents) if app.dependents else 'None'}\n"
        f"Notes: {app.notes}"
    )


def chunk_product(enriched: EnrichedProduct) -> str:
    p = enriched.product
    return (
        f"Product: {p.name}\n"
        f"Division: {p.division}\n"
        f"Description: {p.description}\n"
        f"ARR: {p.arr}\n"
        f"Dependent Applications: {', '.join(p.dependent_applications) if p.dependent_applications else 'None'}\n"
        f"Total App Cost: {enriched.total_app_cost}\n"
        f"ROI Ratio: {enriched.roi_ratio:.3f}\n"
        f"Highest Risk: {enriched.highest_risk}\n"
        f"Apps at Risk: {', '.join(enriched.apps_at_risk) if enriched.apps_at_risk else 'None'}\n"
        f"Apps End-of-Life: {', '.join(enriched.apps_end_of_life) if enriched.apps_end_of_life else 'None'}\n"
        f"Revenue at Risk: {enriched.revenue_at_risk}"
    )
