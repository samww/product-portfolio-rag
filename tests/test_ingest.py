"""TDD tests for the ingestion pipeline (loader, joiner, chunker, indexer).

Run with: uv run pytest tests/test_ingest.py -v
"""

from pathlib import Path

from src.ingest.loader import load_applications, load_products, Application, Product
from src.ingest.joiner import enrich_products, EnrichedProduct
from src.ingest.chunker import chunk_application, chunk_product
from src.ingest.indexer import index_documents


# ---------------------------------------------------------------------------
# Cycle 1: loader reads applications
# ---------------------------------------------------------------------------

def test_load_applications_returns_correct_count(sample_apps_path):
    apps = load_applications(sample_apps_path)
    assert len(apps) == 5


def test_load_applications_returns_application_dataclasses(sample_apps_path):
    apps = load_applications(sample_apps_path)
    assert all(isinstance(a, Application) for a in apps)


# ---------------------------------------------------------------------------
# Cycle 2: loader reads products
# ---------------------------------------------------------------------------

def test_load_products_returns_correct_count(sample_products_path):
    products = load_products(sample_products_path)
    assert len(products) == 3


def test_load_products_returns_product_dataclasses(sample_products_path):
    products = load_products(sample_products_path)
    assert all(isinstance(p, Product) for p in products)


# ---------------------------------------------------------------------------
# Cycle 3: joiner computes total_app_cost
# ---------------------------------------------------------------------------
# TechnologyAdoption depends on CallCentre Suite (610000) + AuthService (665000)
# => total_app_cost = 1_275_000

def test_enrich_products_total_app_cost(sample_apps_path, sample_products_path):
    apps = load_applications(sample_apps_path)
    products = load_products(sample_products_path)
    enriched = enrich_products(products, apps)
    tech = next(e for e in enriched if e.product.name == "TechnologyAdoption")
    assert tech.total_app_cost == 1_275_000


# ---------------------------------------------------------------------------
# Cycle 4: joiner computes roi_ratio
# ---------------------------------------------------------------------------
# TechnologyAdoption: arr=3_300_000, total_app_cost=1_275_000 => ~2.588

def test_enrich_products_roi_ratio(sample_apps_path, sample_products_path):
    apps = load_applications(sample_apps_path)
    products = load_products(sample_products_path)
    enriched = enrich_products(products, apps)
    tech = next(e for e in enriched if e.product.name == "TechnologyAdoption")
    assert abs(tech.roi_ratio - 3_300_000 / 1_275_000) < 0.001


# ---------------------------------------------------------------------------
# Cycle 5: joiner identifies highest_risk
# ---------------------------------------------------------------------------
# TechnologyAdoption depends on AuthService (Critical) and CallCentre Suite (High)
# => highest_risk = "Critical"

def test_enrich_products_highest_risk(sample_apps_path, sample_products_path):
    apps = load_applications(sample_apps_path)
    products = load_products(sample_products_path)
    enriched = enrich_products(products, apps)
    tech = next(e for e in enriched if e.product.name == "TechnologyAdoption")
    assert tech.highest_risk == "Critical"


# ---------------------------------------------------------------------------
# Cycle 6: joiner flags apps_end_of_life
# ---------------------------------------------------------------------------
# TechnologyAdoption depends on CallCentre Suite (status="End-of-life 2026")

def test_enrich_products_apps_end_of_life(sample_apps_path, sample_products_path):
    apps = load_applications(sample_apps_path)
    products = load_products(sample_products_path)
    enriched = enrich_products(products, apps)
    tech = next(e for e in enriched if e.product.name == "TechnologyAdoption")
    assert tech.apps_end_of_life == ["CallCentre Suite"]


# ---------------------------------------------------------------------------
# Cycle 7: joiner computes revenue_at_risk
# ---------------------------------------------------------------------------
# TechnologyAdoption has at-risk apps => revenue_at_risk = arr = 3_300_000
# CorporateReporting depends only on InsightHub (Low, Active) => revenue_at_risk = 0

def test_enrich_products_revenue_at_risk_when_at_risk(sample_apps_path, sample_products_path):
    apps = load_applications(sample_apps_path)
    products = load_products(sample_products_path)
    enriched = enrich_products(products, apps)
    tech = next(e for e in enriched if e.product.name == "TechnologyAdoption")
    assert tech.revenue_at_risk == 3_300_000


def test_enrich_products_revenue_at_risk_zero_when_safe():
    # Construct a product whose entire transitive dep chain is Low risk / Active
    safe_app = Application(
        name="SafeApp", division="X", business_capability="X", technology_stack="X",
        owner="X", risk_rating="Low", status="Active",
        annual_cost_workforce=0, annual_cost_licenses=0, annual_cost_cloud=0,
        annual_cost_total=100_000, dependencies=[], dependents=[], notes="",
    )
    safe_product = Product(name="SafeProduct", division="X", description="X",
                           arr=500_000, dependent_applications=["SafeApp"])
    enriched = enrich_products([safe_product], [safe_app])
    assert enriched[0].revenue_at_risk == 0


# ---------------------------------------------------------------------------
# Cycle 8: chunker formats application as labelled text block
# ---------------------------------------------------------------------------

def test_chunk_application_contains_all_labels(sample_apps_path):
    apps = load_applications(sample_apps_path)
    auth = next(a for a in apps if a.name == "AuthService")
    text = chunk_application(auth)
    for label in ["Application:", "Flags:", "Division:", "Business Capability:", "Technology:",
                  "Owner:", "Risk:", "Status:", "Annual Cost:", "Notes:"]:
        assert label in text, f"Missing label '{label}' in application chunk"


def test_chunk_application_contains_field_values(sample_apps_path):
    apps = load_applications(sample_apps_path)
    auth = next(a for a in apps if a.name == "AuthService")
    text = chunk_application(auth)
    assert "AuthService" in text
    assert "Critical" in text
    assert "Platform Engineering" in text


# ---------------------------------------------------------------------------
# Cycle 9: chunker formats enriched product as labelled text block
# ---------------------------------------------------------------------------

def test_chunk_product_contains_all_labels(sample_apps_path, sample_products_path):
    apps = load_applications(sample_apps_path)
    products = load_products(sample_products_path)
    enriched = enrich_products(products, apps)
    tech = next(e for e in enriched if e.product.name == "TechnologyAdoption")
    text = chunk_product(tech)
    for label in ["Product:", "Division:", "Description:", "ARR:", "Dependent Applications:",
                  "Total App Cost:", "ROI Ratio:", "Highest Risk:", "Apps at Risk:",
                  "Apps End-of-Life:", "Revenue at Risk:"]:
        assert label in text, f"Missing label '{label}' in product chunk"


def test_chunk_product_contains_field_values(sample_apps_path, sample_products_path):
    apps = load_applications(sample_apps_path)
    products = load_products(sample_products_path)
    enriched = enrich_products(products, apps)
    tech = next(e for e in enriched if e.product.name == "TechnologyAdoption")
    text = chunk_product(tech)
    assert "TechnologyAdoption" in text
    assert "3300000" in text or "3,300,000" in text or "3_300_000" in text


# ---------------------------------------------------------------------------
# Cycle 9b: chunker sets "No named owner" on Flags line for empty-owner apps
# ---------------------------------------------------------------------------

def test_chunk_application_no_named_owner_flag_when_owner_empty(sample_apps_path):
    apps = load_applications(sample_apps_path)
    forecast = next(a for a in apps if a.name == "ForecastTool")
    text = chunk_application(forecast)
    flags_line = next(line for line in text.splitlines() if line.startswith("Flags:"))
    assert "No named owner" in flags_line, (
        f"Expected 'No named owner' in Flags line, got: {flags_line!r}"
    )


# ---------------------------------------------------------------------------
# Cycle 10: indexer stores documents with correct metadata fields
# ---------------------------------------------------------------------------

def test_index_documents_stores_metadata_fields(chroma_collection, stub_embed):
    docs = ["Application: AuthService\nRisk: Critical"]
    metadatas = [{"doc_type": "application", "division": "Platform Engineering",
                  "risk_rating": "Critical", "status": "Active", "owner": "Platform Engineering"}]
    ids = ["app-authservice"]
    index_documents(docs, metadatas, ids, chroma_collection, stub_embed)
    result = chroma_collection.get(ids=["app-authservice"], include=["metadatas"])
    stored = result["metadatas"][0]
    for field in ("doc_type", "division", "risk_rating", "status", "owner"):
        assert field in stored, f"Missing metadata field: {field}"


# ---------------------------------------------------------------------------
# Cycle 11: indexer stores the correct number of documents
# ---------------------------------------------------------------------------

def test_index_documents_stores_correct_count(chroma_collection, stub_embed):
    docs = [f"doc {i}" for i in range(5)]
    metadatas = [{"doc_type": "application", "division": "X",
                  "risk_rating": "Low", "status": "Active", "owner": "X"} for _ in docs]
    ids = [f"id-{i}" for i in range(5)]
    index_documents(docs, metadatas, ids, chroma_collection, stub_embed)
    assert chroma_collection.count() == 5
