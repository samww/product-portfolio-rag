"""Join products with their dependent application data and compute derived fields."""

from dataclasses import dataclass

from src.ingest.loader import Application, Product

_RISK_ORDER = {"Critical": 4, "High": 3, "Medium": 2, "Low": 1, "Unknown": 0}


@dataclass
class EnrichedProduct:
    product: Product
    total_app_cost: int
    roi_ratio: float
    highest_risk: str
    apps_at_risk: list[str]
    apps_end_of_life: list[str]
    revenue_at_risk: int


def enrich_products(
    products: list[Product],
    applications: list[Application],
) -> list[EnrichedProduct]:
    app_by_name = {a.name: a for a in applications}
    result = []
    for product in products:
        dep_apps = [app_by_name[n] for n in product.dependent_applications if n in app_by_name]

        total_app_cost = sum(a.annual_cost_total for a in dep_apps)
        roi_ratio = product.arr / total_app_cost if total_app_cost else 0.0

        highest_risk = max(
            (a.risk_rating for a in dep_apps),
            key=lambda r: _RISK_ORDER.get(r, 0),
            default="Unknown",
        )

        apps_at_risk = [a.name for a in dep_apps if _RISK_ORDER.get(a.risk_rating, 0) >= 3]
        apps_end_of_life = [a.name for a in dep_apps if "end-of-life" in a.status.lower()]

        is_at_risk = bool(apps_at_risk or apps_end_of_life)
        revenue_at_risk = product.arr if is_at_risk else 0

        result.append(EnrichedProduct(
            product=product,
            total_app_cost=total_app_cost,
            roi_ratio=roi_ratio,
            highest_risk=highest_risk,
            apps_at_risk=apps_at_risk,
            apps_end_of_life=apps_end_of_life,
            revenue_at_risk=revenue_at_risk,
        ))
    return result
