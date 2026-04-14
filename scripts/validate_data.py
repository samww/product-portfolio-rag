"""Validate synthetic portfolio data and print a summary.

Run with: uv run python scripts/validate_data.py
"""

import json
from pathlib import Path
from collections import Counter

DATA_DIR = Path(__file__).parent.parent / "data"


def load_applications():
    return json.loads((DATA_DIR / "applications.json").read_text())


def load_products():
    return json.loads((DATA_DIR / "products.json").read_text())


def print_section(title: str) -> None:
    print(f"\n{'=' * 60}")
    print(f"  {title}")
    print(f"{'=' * 60}")


def main() -> None:
    apps = load_applications()
    products = load_products()

    # Build lookup for join
    apps_by_name = {a["name"]: a for a in apps}

    print_section("PORTFOLIO SUMMARY")
    print(f"  {len(apps)} applications across {len(set(a['division'] for a in apps))} divisions")
    print(f"  {len(products)} products")

    # --- Division breakdown ---
    print_section("APPLICATIONS BY DIVISION")
    division_counts = Counter(a["division"] for a in apps)
    for division, count in sorted(division_counts.items()):
        print(f"  {division:<25} {count} apps")

    # --- Risk breakdown ---
    print_section("APPLICATIONS BY RISK RATING")
    risk_counts = Counter(a["risk_rating"] for a in apps)
    for rating in ["Critical", "High", "Medium", "Low"]:
        count = risk_counts.get(rating, 0)
        flag = " <-- ACTION REQUIRED" if rating in ("Critical", "High") else ""
        print(f"  {rating:<12} {count}{flag}")

    # --- Status breakdown ---
    print_section("APPLICATIONS BY STATUS")
    status_counts = Counter(a["status"] for a in apps)
    for status, count in sorted(status_counts.items()):
        print(f"  {status:<25} {count}")

    # --- Ownership gaps ---
    ownerless = [a for a in apps if not a.get("owner", "").strip()]
    print_section(f"OWNERSHIP GAPS  ({len(ownerless)} applications with no named owner)")
    for app in ownerless:
        print(f"  {app['name']:<30} [{app['division']}]  Risk: {app['risk_rating']}")

    # --- Total costs ---
    total_app_cost = sum(a["annual_cost_total"] for a in apps)
    print_section("COST SUMMARY")
    print(f"  Total annual application cost:  ${total_app_cost:>15,.0f}")
    print(f"  Avg cost per application:       ${total_app_cost / len(apps):>15,.0f}")

    top_cost = sorted(apps, key=lambda a: a["annual_cost_total"], reverse=True)[:5]
    print("\n  Top 5 most expensive applications:")
    for app in top_cost:
        print(f"    {app['name']:<30} ${app['annual_cost_total']:>10,.0f}")

    # --- ARR ---
    total_arr = sum(p["arr"] for p in products)
    print_section("REVENUE SUMMARY")
    print(f"  Total ARR across all products:  ${total_arr:>15,.0f}")

    # --- ROI table ---
    print_section("ROI PREVIEW  (ARR / Total Application Cost)")
    print(f"  {'Product':<35} {'ARR':>12}  {'App Cost':>12}  {'ROI':>6}")
    print(f"  {'-'*35} {'-'*12}  {'-'*12}  {'-'*6}")

    rows = []
    for product in products:
        dep_apps = [apps_by_name[n] for n in product["dependent_applications"] if n in apps_by_name]
        total_app_cost_product = sum(a["annual_cost_total"] for a in dep_apps)
        roi = (product["arr"] / total_app_cost_product) if total_app_cost_product > 0 else 0
        rows.append((product["name"], product["arr"], total_app_cost_product, roi))

    for name, arr, cost, roi in sorted(rows, key=lambda r: r[3], reverse=True):
        print(f"  {name:<35} ${arr:>11,.0f}  ${cost:>11,.0f}  {roi:>5.2f}x")

    # --- Revenue at risk ---
    print_section("REVENUE AT RISK")
    print("  Applications with High or Critical risk rating:")
    at_risk_apps = {a["name"] for a in apps if a["risk_rating"] in ("High", "Critical")}
    arr_at_risk = 0
    seen_products = set()
    for product in products:
        if any(dep in at_risk_apps for dep in product["dependent_applications"]):
            if product["name"] not in seen_products:
                risky_deps = [d for d in product["dependent_applications"] if d in at_risk_apps]
                print(f"  {product['name']:<35} ARR: ${product['arr']:>10,.0f}  via: {', '.join(risky_deps)}")
                arr_at_risk += product["arr"]
                seen_products.add(product["name"])
    print(f"\n  Total ARR at risk:              ${arr_at_risk:>15,.0f}")

    print()


if __name__ == "__main__":
    main()
