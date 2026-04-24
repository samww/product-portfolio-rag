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
| `_joiner.py` | For each product, looks up dependent apps and computes `total_app_cost`, `roi_ratio`, `highest_risk`, `apps_at_risk`, `apps_end_of_life`, `revenue_at_risk`. Also exports `compute_app_arr_at_risk` (total ARR at risk per app, used by ingest) and `compute_app_product_exposures` (per-app breakdown of contributing products, used by the API at startup). |
| `_chunker.py` | Formats each application and enriched product record as a labelled text block for embedding. Prefix contract: the `"Application: "` and `"Product: "` prefixes on the first line are parsed by `retriever.parse_doc_source`. |
| `_indexer.py` | Embeds all 44 docs, upserts into the `"portfolio"` collection with metadata (`doc_type`, `division`, `risk_rating`, `status`, `owner`, `name`, `summary`), calls `pca.fit()` inline on the computed embeddings, and returns a `PcaArtifact`. |
| `pca.py` | `PcaArtifact` dataclass (`mean`, `components`, `points`). `fit(embeddings, ids, metadatas) -> PcaArtifact` — mean-centres, runs `numpy.linalg.svd`, stores 3 components and per-point projected xyz. `project(artifact, embeddings) -> np.ndarray` — applies stored mean/components to new vectors. Written to `.chroma/pca.npz` (mean + components) and `src/frontend/public/points.json` (per-point metadata) by `Ingestor.run()`. Both artifacts are wiped by `reset=True`. Public — consumed by `src/api/main.py` and `src/api/routes.py` at runtime. |
| `ingestor.py` | `Ingestor(collection, embed, *, data_dir, pca_path, points_path)` — orchestrates the full pipeline: load → enrich → chunk → index → write PCA artifacts. `run(reset=False) -> IngestResult(chunk_count, exposures)`. No-op when the collection is already populated and `reset=False`; wipes `pca.npz` and `points.json` before re-indexing when `reset=True`. `exposures() -> dict[str, list[tuple[str, int]]]` — loads apps + products from disk, runs enrichment, returns the per-app product-exposures dict; performs no Chroma or network I/O. `Ingestor` and `IngestResult` are the only public exports from `src/ingest/` (`__init__.py`). |

Entry point: `scripts/ingest.py` — ≤20 lines; constructs `chromadb.PersistentClient`, an `embed` callable, and delegates everything to `Ingestor(collection, embed).run(reset=args.reset)`.

### Query — `src/rag/`

| Module | Responsibility |
|---|---|
| `retriever.py` | `retrieve()`: embeds query, fetches top-k apps and top-k products separately via `_query_where()`, merges and sorts by distance. `retrieve_at_risk_docs()`: metadata filter only — returns all High/Critical risk and ownerless application docs, deduped. `parse_doc_source(doc)`: returns `(kind, name)` from the first line of a `RetrievedDoc`; `kind` is `"application"`, `"product"`, or `None`. Used by `generator.py` and `routes.py` to extract display names. |
| `prompts.py` | `SYSTEM_PROMPT`: instructs model to cite app names, trace full dependency chains, respond with "I cannot determine this from the portfolio data" if context is insufficient. `SUMMARY_SYSTEM_PROMPT`: instructs model to produce a structured `SummaryReport` with prioritised findings. |
| `generator.py` | `generate_answer()`: free-text RAG call, returns `GeneratedAnswer(answer, sources)`. `generate_answer_stream()`: same but yields token deltas. `generate_summary()`: structured output via `openai.beta.chat.completions.parse` using a private `_SummaryReportLLM` schema (excludes `product_exposures` so the LLM never tries to populate it — exposures are injected downstream by `SummaryService`). |

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
| `main.py` | FastAPI app + lifespan: loads `.env`, creates `OpenAI` client, connects `PersistentClient` at `.chroma/`, composes a `SummaryService` from `ChromaAtRiskSource`, a `generate_summary` lambda, and `DictExposureLookup(Ingestor(collection, embed).exposures())`, attaches client + collection + embed + `summary_service` to `app.state`. Also loads `PcaArtifact` from `.chroma/pca.npz` into `app.state.pca_artifact` (set to `None` with a warning log if missing). |
| `routes.py` | Route handlers — access shared resources via `request.app.state`. `/summarise` is a two-line delegate to `request.app.state.summary_service.run()`. |
| `models.py` | Pydantic request/response models for API layer |

Structured output models (`SummaryReport`, `RiskFinding`, `GovernanceGap`) live in `src/rag/models.py` — shared by the generator and the API response schema.

## See also

- [Architecture Decision Records](../overview/decisions.md) — why ChromaDB, denormalised product docs, no chunking, text-embedding-3-small
- [API reference](api.md) — endpoint signatures, response shapes, SSE format
