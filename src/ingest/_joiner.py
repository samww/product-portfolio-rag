"""Join products with their dependent application data and compute derived fields."""

from dataclasses import dataclass

from src.ingest._loader import Application, Product

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


def _transitive_apps(
    start_names: list[str],
    app_by_name: dict[str, Application],
) -> list[Application]:
    """Return all applications reachable via the dependency graph (BFS)."""
    seen: dict[str, Application] = {}
    queue = list(start_names)
    while queue:
        name = queue.pop()
        if name in seen or name not in app_by_name:
            continue
        app = app_by_name[name]
        seen[name] = app
        queue.extend(app.dependencies)
    return list(seen.values())


def enrich_products(
    products: list[Product],
    applications: list[Application],
) -> list[EnrichedProduct]:
    app_by_name = {a.name: a for a in applications}
    result = []
    for product in products:
        direct_apps = [app_by_name[n] for n in product.dependent_applications if n in app_by_name]
        all_apps = _transitive_apps(product.dependent_applications, app_by_name)

        # Cost metrics use direct deps only to avoid double-counting shared infrastructure
        total_app_cost = sum(a.annual_cost_total for a in direct_apps)
        roi_ratio = product.arr / total_app_cost if total_app_cost else 0.0

        # Risk metrics use the full transitive closure
        highest_risk = max(
            (a.risk_rating for a in all_apps),
            key=lambda r: _RISK_ORDER.get(r, 0),
            default="Unknown",
        )
        apps_at_risk = [a.name for a in all_apps if _RISK_ORDER.get(a.risk_rating, 0) >= 3]
        apps_end_of_life = [a.name for a in all_apps if "end-of-life" in a.status.lower()]

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


def compute_app_product_exposures(
    enriched_products: list[EnrichedProduct],
) -> dict[str, list[tuple[str, int]]]:
    """Return per-app list of (product_name, arr_000s) sorted by descending ARR."""
    exposures: dict[str, list[tuple[str, int]]] = {}
    for ep in enriched_products:
        if ep.revenue_at_risk > 0:
            for app_name in ep.apps_at_risk:
                exposures.setdefault(app_name, []).append(
                    (ep.product.name, ep.revenue_at_risk // 1000)
                )
    for app_name in exposures:
        exposures[app_name].sort(key=lambda x: x[1], reverse=True)
    return exposures


def compute_app_arr_at_risk(enriched_products: list[EnrichedProduct]) -> dict[str, int]:
    """Return total ARR at risk per application, summed across all products that carry the app in apps_at_risk."""
    arr_by_app: dict[str, int] = {}
    for ep in enriched_products:
        if ep.revenue_at_risk > 0:
            for app_name in ep.apps_at_risk:
                arr_by_app[app_name] = arr_by_app.get(app_name, 0) + ep.revenue_at_risk
    return arr_by_app
