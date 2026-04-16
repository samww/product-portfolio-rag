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
| `loader.py` | Reads `data/applications.json` + `data/products.json` → typed dataclass objects |
| `joiner.py` | For each product, looks up dependent apps and computes `total_app_cost`, `roi_ratio`, `highest_risk`, `apps_at_risk`, `apps_end_of_life`, `revenue_at_risk`. Also exports `compute_app_arr_at_risk` (total ARR at risk per app, used by ingest) and `compute_app_product_exposures` (per-app breakdown of contributing products, used by the API at startup). |
| `chunker.py` | Formats each application and enriched product record as a labelled text block for embedding |
| `indexer.py` | Initialises ChromaDB, creates/resets `"portfolio"` collection, embeds all 44 docs, stores each with a `doc_type` metadata field (`"application"` or `"product"`) |

Entry point: `scripts/ingest.py` (run with `--reset` to wipe and re-index).

### Query — `src/rag/`

| Module | Responsibility |
|---|---|
| `retriever.py` | `retrieve()`: embeds query, fetches top-k apps and top-k products separately via `_query_where()`, merges and sorts by distance. `retrieve_at_risk_docs()`: metadata filter only — returns all High/Critical risk and ownerless application docs, deduped. |
| `prompts.py` | `SYSTEM_PROMPT`: instructs model to cite app names, trace full dependency chains, respond with "I cannot determine this from the portfolio data" if context is insufficient. `SUMMARY_SYSTEM_PROMPT`: instructs model to produce a structured `SummaryReport` with prioritised findings. |
| `generator.py` | `generate_answer()`: free-text RAG call, returns `GeneratedAnswer(answer, sources)`. `generate_answer_stream()`: same but yields token deltas. `generate_summary()`: structured output via `openai.beta.chat.completions.parse` using a private `_SummaryReportLLM` schema (excludes `product_exposures` so the LLM never tries to populate it — exposures are injected deterministically by the route). |

### API — `src/api/`

| Module | Responsibility |
|---|---|
| `main.py` | FastAPI app + lifespan: loads `.env`, creates `OpenAI` client, connects `PersistentClient` at `.chroma/`, loads `data/applications.json` + `data/products.json`, computes `app_product_exposures` via `compute_app_product_exposures`, attaches all to `app.state` |
| `routes.py` | Route handlers — access shared resources via `request.app.state`. `/summarise` injects `product_exposures` into each `RiskFinding` from `app.state.app_product_exposures` after the LLM call. |
| `models.py` | Pydantic request/response models for API layer |

Structured output models (`SummaryReport`, `RiskFinding`, `GovernanceGap`) live in `src/rag/models.py` — shared by the generator and the API response schema.

## See also

- [Architecture Decision Records](decisions.md) — why ChromaDB, denormalised product docs, no chunking, text-embedding-3-small
- [API reference](api.md) — endpoint signatures, response shapes, SSE format
