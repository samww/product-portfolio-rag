# Data Model

## Source files

| File | Contents |
|---|---|
| `data/applications.json` | 30 application records (source of truth) |
| `data/products.json` | 14 product records — ARR and dependent app name lists |
| `tests/fixtures/sample_applications.json` | 5-record subset for fast test execution |
| `tests/fixtures/sample_products.json` | 3-record subset with known ROI values for assertions |

For the full inventory of all 30 applications and 14 products, see issue #1.

## Application schema

Stored as structured text in ChromaDB. ChromaDB metadata per doc: `doc_type="application"`, `risk_rating`, `owner`.

| Field | Notes |
|---|---|
| Name | |
| Division | Analytics, Data Collection, Client Services, Finance, Platform Engineering, HR |
| Business Capability | Plain English description |
| Technology Stack | |
| Owner | Empty string for ownerless apps |
| Risk Rating | Critical / High / Medium / Low |
| Status | Active / Legacy / Sunset planned / End-of-life 2025 / End-of-life 2026 |
| Annual Cost Workforce ($000s) | |
| Annual Cost Licenses ($000s) | |
| Annual Cost Cloud ($000s) | |
| Annual Cost Total ($000s) | Sum of above three |
| Dependencies | App names this depends on |
| Dependents | App names that depend on this |
| Notes | Operational context, known issues |

## Product schema

Products are **denormalised at ingestion time** by `src/ingest/joiner.py` — dependent application details are inlined so ROI and risk queries are answered from a single retrieved document. ChromaDB metadata per doc: `doc_type="product"`.

| Field | Source |
|---|---|
| Name | products.json |
| Division | products.json |
| Description | products.json |
| ARR ($000s) | products.json |
| Dependent Applications | products.json |
| Total Application Cost ($000s) | Computed: sum of Annual Cost Total across dependent apps |
| ROI Ratio | Computed: ARR / Total Application Cost, rounded to 2dp |
| Highest Application Risk | Computed: worst risk rating across dependent apps |
| Applications At Risk | Computed: dependent apps with High or Critical risk |
| Applications End Of Life | Computed: dependent apps with EOL status |
| Revenue At Risk ($000s) | Product's full ARR, flagged when any dependent app is High/Critical/EOL |

## Key risk scenarios

Intentionally designed into the data — these drive the demo queries and the `/summarise` output:

| Scenario | Detail |
|---|---|
| Critical risk | AuthService — vendor EOL Q2 2026; directly depended on by 8 apps |
| Shared platform risk | CoreDataWarehouse has a runtime dependency on AuthService — propagates risk indirectly to 9 of 14 products |
| EOL dependency | CallCentre Suite (EOL 2026) — depended on by FieldworkServices ($1.6m ARR) |
| Ownerless apps | ContractVault, ForecastTool, OffboardingFlow — `owner` is empty string |
| Modernisation example | ReportFactory migrated 2024 from legacy Java/Oracle to Python/FastAPI; licenses fell $180k → $12k, net saving $118k/year |

**Centrepiece risk chain:** DataLicensing ($6.2m ARR) → CoreDataWarehouse → AuthService (Critical). Two-hop indirect dependency — only answerable because CoreDataWarehouse's Notes field documents its runtime dependency on AuthService.

**Total ARR with direct High/Critical exposure: ~$11.1m.**

## See also

- [Dependency graphs](dependencies.md) — Mermaid diagrams for all app-to-app and per-product dependencies
