# Backend: Architecture & RAG Pipeline

## Stack

| Layer | Technology |
|---|---|
| Language | Python 3.12 |
| Package manager | uv (all deps, venvs, script running — never pip) |
| Web framework | FastAPI |
| LLM | OpenAI GPT-4o (generation), text-embedding-3-small (embeddings) |
| Vector store | ChromaDB — persistent, local file at `.chroma/`, single collection named `"portfolio"` |
| Document count | 44 total (30 applications + 14 products) |

**Build constraints:** No LangChain or LlamaIndex — RAG pipeline implemented directly with OpenAI SDK and ChromaDB SDK. All dependency management via `uv add`.

## Request flow

**Free-text query (`GET /query/stream` or `POST /query`):**
```
query → embed via text-embedding-3-small
      → ChromaDB: top-k application docs + top-k product docs, merged by distance
      → GPT-4o with SYSTEM_PROMPT + retrieved context
      → streamed token deltas (SSE) or full JSON
```

**Risk summary (`POST /summarise`, no body):**
```
→ ChromaDB metadata filter: High/Critical risk OR empty owner (no semantic search)
→ GPT-4o with SUMMARY_SYSTEM_PROMPT + filtered docs, response_format=SummaryReport
→ structured JSON (no streaming — structured output requires complete response)
```

## Module map

### Ingestion — `src/ingest/`

| Module | Responsibility |
|---|---|
| `_loader.py` | Reads `data/applications.json` + `data/products.json` → typed dataclass objects |
| `_joiner.py` | Enriches each product with computed fields (costs, ROI, risk, EOL, revenue at risk — see data-model.md). Also exports `compute_app_arr_at_risk` and `compute_app_product_exposures`. |
| `_chunker.py` | Formats each record as a labelled text block. First-line prefixes `"Application: "` / `"Product: "` are parsed by `retriever.parse_doc_source`. |
| `_indexer.py` | Embeds all 44 docs, upserts into `"portfolio"` collection with metadata, calls `pca.fit()`, returns `PcaArtifact`. |
| `pca.py` | `PcaArtifact`: `fit()` SVD → writes `.chroma/pca.npz` + `src/frontend/public/points.json`; `project()` applies stored components. |
| `ingestor.py` | `Ingestor` orchestrates load→enrich→chunk→index→PCA. `run(reset=False)` is a no-op if already populated. `exposures()` returns per-app exposures dict. Only public exports from `src/ingest/`. |

Entry point: `scripts/ingest.py` — ≤20 lines; constructs `chromadb.PersistentClient`, an `embed` callable, and delegates everything to `Ingestor(collection, embed).run(reset=args.reset)`.

### Query — `src/rag/`

| Module | Responsibility |
|---|---|
| `retriever.py` | `retrieve()`: embeds query, fetches top-k apps + products, merges by distance. `retrieve_at_risk_docs()`: metadata filter for High/Critical/ownerless docs. `parse_doc_source(doc)`: returns `(kind, name)` from first line; `kind` ∈ `{"application","product",None}`. |
| `prompts.py` | `SYSTEM_PROMPT`: cite app names, trace dependency chains, fallback phrase when context is insufficient. `SUMMARY_SYSTEM_PROMPT`: structured `SummaryReport` with prioritised findings. |
| `generator.py` | `generate_answer()` / `generate_answer_stream()`: free-text RAG. `generate_summary()`: structured output — `product_exposures` excluded from LLM schema and injected downstream by `SummaryService`. |

### Summary orchestration — `src/rag/summary/`

Ports-and-adapters package owning the `/summarise` composition. Pure in-process; no FastAPI, Chroma, or OpenAI awareness in the domain module.

| Module | Responsibility |
|---|---|
| `ports.py` | `AtRiskRecordsSource` and `ExposureLookup` Protocols; `StructuredAnalyst` as a `Callable[[Sequence[RetrievedDoc]], SummaryReport]` type alias |
| `service.py` | `SummaryService` — frozen dataclass with a single `run()` method: fetch records → call analyst → inject `product_exposures` into each `RiskFinding` |
| `adapters.py` | `ChromaAtRiskSource` wraps `retrieve_at_risk_docs(collection)`; `DictExposureLookup` wraps the dict returned by `Ingestor(...).exposures()` (contract: returns `[]` for unknown apps, never raises) |

### API — `src/api/`

| Module | Responsibility |
|---|---|
| `main.py` | FastAPI app + lifespan: composes `SummaryService`, loads `PcaArtifact` from `.chroma/pca.npz` (or `None`), attaches all shared state to `app.state`. |
| `routes.py` | Route handlers — access shared resources via `request.app.state`. |
| `models.py` | Pydantic request/response models for API layer |

Structured output models (`SummaryReport`, `RiskFinding`, `GovernanceGap`) live in `src/rag/models.py` — shared by the generator and the API response schema.

