"""Data integrity tests for applications.json and products.json.

Each test verifies one behavioral property of the synthetic data.
Run with: uv run pytest tests/test_data_integrity.py
"""

import json
from pathlib import Path

DATA_DIR = Path(__file__).parent.parent / "data"


def load_applications():
    return json.loads((DATA_DIR / "applications.json").read_text())


def load_products():
    return json.loads((DATA_DIR / "products.json").read_text())


# ---------------------------------------------------------------------------
# Behavior 1: applications.json contains exactly 30 records
# ---------------------------------------------------------------------------

def test_applications_count():
    apps = load_applications()
    assert len(apps) == 30


# ---------------------------------------------------------------------------
# Behavior 2: every application has all required fields
# ---------------------------------------------------------------------------

REQUIRED_APP_FIELDS = {
    "name",
    "division",
    "business_capability",
    "technology_stack",
    "owner",
    "risk_rating",
    "status",
    "annual_cost_workforce",
    "annual_cost_licenses",
    "annual_cost_cloud",
    "annual_cost_total",
    "dependencies",
    "dependents",
    "notes",
}


def test_applications_required_fields():
    apps = load_applications()
    for app in apps:
        missing = REQUIRED_APP_FIELDS - set(app.keys())
        assert not missing, f"{app.get('name', '?')} missing fields: {missing}"


# ---------------------------------------------------------------------------
# Behavior 3: all 6 divisions are represented
# ---------------------------------------------------------------------------

EXPECTED_DIVISIONS = {
    "Analytics",
    "Data Collection",
    "Client Services",
    "Finance",
    "Platform Engineering",
    "HR",
}


def test_applications_all_divisions_present():
    apps = load_applications()
    found = {app["division"] for app in apps}
    assert EXPECTED_DIVISIONS == found


# ---------------------------------------------------------------------------
# Behavior 4: annual_cost_total equals sum of the three cost fields
# ---------------------------------------------------------------------------

def test_applications_cost_totals_correct():
    apps = load_applications()
    for app in apps:
        expected = (
            app["annual_cost_workforce"]
            + app["annual_cost_licenses"]
            + app["annual_cost_cloud"]
        )
        assert app["annual_cost_total"] == expected, (
            f"{app['name']}: total {app['annual_cost_total']} != "
            f"workforce+licenses+cloud {expected}"
        )


# ---------------------------------------------------------------------------
# Behavior 5: exactly 3 applications have no named owner
# ---------------------------------------------------------------------------

def test_applications_three_ownerless():
    apps = load_applications()
    ownerless = [a for a in apps if not a.get("owner", "").strip()]
    assert len(ownerless) == 3, (
        f"Expected 3 ownerless apps, found {len(ownerless)}: "
        f"{[a['name'] for a in ownerless]}"
    )


# ---------------------------------------------------------------------------
# Behavior 6: AuthService has risk_rating "Critical"
# ---------------------------------------------------------------------------

def test_authservice_is_critical():
    apps = load_applications()
    auth = next((a for a in apps if a["name"] == "AuthService"), None)
    assert auth is not None, "AuthService not found"
    assert auth["risk_rating"] == "Critical"


# ---------------------------------------------------------------------------
# Behavior 7: products.json contains exactly 14 records
# ---------------------------------------------------------------------------

def test_products_count():
    products = load_products()
    assert len(products) == 14


# ---------------------------------------------------------------------------
# Behavior 8: every product has all required fields
# ---------------------------------------------------------------------------

REQUIRED_PRODUCT_FIELDS = {
    "name",
    "division",
    "description",
    "arr",
    "dependent_applications",
}


def test_products_required_fields():
    products = load_products()
    for product in products:
        missing = REQUIRED_PRODUCT_FIELDS - set(product.keys())
        assert not missing, f"{product.get('name', '?')} missing fields: {missing}"


# ---------------------------------------------------------------------------
# Behavior 9: revenue-at-risk scenarios are wired correctly
# ---------------------------------------------------------------------------


# ---------------------------------------------------------------------------
# Behavior 10: ownerless apps chunk with "No named owner" on Flags line
# ---------------------------------------------------------------------------

def test_ownerless_apps_chunk_flags():
    from src.ingest.loader import Application
    from src.ingest.chunker import chunk_application

    raw_apps = load_applications()
    EXPECTED_OWNERLESS = {"ContractVault", "ForecastTool", "OffboardingFlow"}

    ownerless = [a for a in raw_apps if not a.get("owner", "").strip()]
    assert {a["name"] for a in ownerless} == EXPECTED_OWNERLESS, (
        f"Expected ownerless apps {EXPECTED_OWNERLESS}, got {[a['name'] for a in ownerless]}"
    )

    for raw in ownerless:
        app = Application(
            name=raw["name"],
            division=raw["division"],
            business_capability=raw["business_capability"],
            technology_stack=raw["technology_stack"],
            owner=raw.get("owner", ""),
            risk_rating=raw["risk_rating"],
            status=raw["status"],
            annual_cost_workforce=raw["annual_cost_workforce"],
            annual_cost_licenses=raw["annual_cost_licenses"],
            annual_cost_cloud=raw["annual_cost_cloud"],
            annual_cost_total=raw["annual_cost_total"],
            dependencies=raw.get("dependencies", []),
            dependents=raw.get("dependents", []),
            notes=raw.get("notes", ""),
        )
        text = chunk_application(app)
        flags_line = next(line for line in text.splitlines() if line.startswith("Flags:"))
        assert "No named owner" in flags_line, (
            f"{raw['name']}: expected 'No named owner' in Flags line, got: {flags_line!r}"
        )



# ---------------------------------------------------------------------------
# Behavior 11: dependency graph is fully symmetric
# ---------------------------------------------------------------------------

def test_dependency_graph_is_symmetric():
    apps = load_applications()
    by_name = {a["name"]: a for a in apps}
    broken = []
    for app in apps:
        for dep_name in app.get("dependencies", []):
            dep = by_name.get(dep_name)
            if dep is None:
                broken.append(f"{app['name']} → {dep_name}: dependency not found in data")
            elif app["name"] not in dep.get("dependents", []):
                broken.append(
                    f"{app['name']} → {dep_name}: missing back-edge "
                    f"({dep_name}.dependents does not include {app['name']!r})"
                )
    assert not broken, "Asymmetric dependency edges:\n" + "\n".join(broken)


def test_revenue_at_risk_wiring():
    products = load_products()
    by_name = {p["name"]: p for p in products}

    fieldwork = by_name["FieldworkServices"]
    assert "CallCentre Suite" in fieldwork["dependent_applications"]

    tech_adoption = by_name["TechnologyAdoption"]
    assert "AuthService" in tech_adoption["dependent_applications"]

    data_licensing = by_name["DataLicensing"]
    assert "CoreDataWarehouse" in data_licensing["dependent_applications"]
