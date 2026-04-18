# Architecture Decision Records

Design decisions for `product-portfolio-rag`.

---

## ADR 1: ChromaDB over Azure AI Search

**Status:** Accepted

**Context:**
The vector store could be either ChromaDB (embedded, open-source) or Azure AI Search (managed service). Azure AI Search is the production-appropriate choice for an enterprise deployment. However, this is a demo project.

**Decision:** Use ChromaDB.

**Reasons:**
- ChromaDB runs inside the container with zero additional Azure resources, keeping the demo self-contained and cost-free at rest. Azure AI Search Basic tier costs ~$70/month minimum — unjustifiable for a demo that may sit idle.
- Local ChromaDB makes the repo immediately runnable with `docker compose up` and a single API key — no Azure subscription required.

**Mitigation:** The README acknowledges Azure AI Search as the production-appropriate alternative and explains the trade-off.

**Trade-offs accepted:**
- ChromaDB has no managed service guarantees, no built-in authentication, no enterprise scaling.
- Data is regenerated from JSON on the first container start (~10 second delay). Subsequent starts are no-ops because `ingest.py` upserts by ID and exits early when the collection is already populated — acceptable for a demo.

---

## ADR 2: Denormalised product documents over multi-hop retrieval

**Status:** Accepted

**Context:**
Products depend on applications. A query like *"which products are at highest financial risk?"* requires knowing both which apps each product depends on and the risk/cost of each dependent app.

Two approaches:

**Option A — Denormalised (chosen):** At ingestion time, join each product with its dependent application records. Pre-compute `total_app_cost`, `roi_ratio`, `highest_risk`, and `revenue_at_risk`. Embed each product as a single document.

**Option B — Multi-hop retrieval:** Embed products and applications separately. At query time, retrieve the product, parse its dependency list, then do a second retrieval pass for the dependent apps.

**Decision:** Option A — denormalise and pre-compute at ingestion.

**Reasons:**
- Multi-hop retrieval introduces compounding error: if the first retrieval misses a dependency, the second pass cannot recover from it.
- Pre-computed ROI and risk exposure are deterministic. LLM arithmetic across several retrieved documents is not reliable.
- Single-document retrieval gives the model all context in one window with no coordination logic.
- Ingestion cost is negligible: 44 documents, runs once at container start.

**Trade-offs accepted:**
- Product documents are larger after denormalisation (~600–900 tokens vs ~150 tokens bare). At this scale, not a concern.
- If application data changes, product documents must be re-ingested (`scripts/ingest.py --reset`).

---

## ADR 3: Single document per record (no chunking)

**Status:** Accepted

**Context:**
Each application record is ~300–500 tokens. Each denormalised product record is ~600–900 tokens.

**Decision:** No chunking. Each record is a single document in ChromaDB.

**Reasons:**
- Chunking structured application records would split fields across chunks, breaking the coherence of the record as a retrieval unit. A chunk containing only `Technology Stack` and `Risk Rating` without `Owner` and `Business Capability` is less useful than the whole record.
- Retrieval granularity should match query granularity — queries are about whole applications or whole products.
- At 44 documents, context window space is not a constraint.

**Note:** The `chunker.py` module still exists for future flexibility (e.g. if long-form documentation were added per application). It formats each record as a labelled text block, which improves embedding quality over raw JSON serialisation.

**Trade-offs accepted:**
- If records were significantly longer (e.g. full runbooks), single-document retrieval would dilute embedding quality.

---

## ADR 4: text-embedding-3-small over text-embedding-3-large or ada-002

**Status:** Accepted

**Context:**
OpenAI offers three relevant embedding models: `text-embedding-ada-002` (legacy), `text-embedding-3-small`, and `text-embedding-3-large`.

**Decision:** Use `text-embedding-3-small`.

**Reasons:**
- `text-embedding-3-small` outperforms `ada-002` on MTEB benchmarks at lower cost per token.
- At 44 documents with ~800 tokens each (~35k tokens total), the quality difference between `3-small` and `3-large` is negligible.
- `text-embedding-3-large` is 5× more expensive per token — cost-conscious model selection matters as a principle even when the absolute difference is small.
- `ada-002` is explicitly legacy as of 2024.

**Mitigation:** The model name is a single constant in `src/ingest/indexer.py`, trivially swappable.

---

## ADR 5: Deterministic enrichment for product exposures in `/summarise`

**Status:** Accepted

**Context:**
The `POST /summarise` response includes a `product_exposures` field on each risk finding — a list of products financially exposed to that application, with ARR figures. This data exists in the portfolio: each product declares which applications it depends on, and those dependencies are traversed at ingestion time to compute `revenue_at_risk`.

Two approaches for populating `product_exposures` in the summary:

**Option A — LLM inference (rejected):** Include product-application dependency data in the retrieved context and ask the LLM to produce `product_exposures` as part of its structured output.

**Option B — Deterministic enrichment (chosen):** Ask the LLM only for fields it can reliably synthesise (risk ratings, issues, recommendations). Post-hoc, inject `product_exposures` from a precomputed lookup built at startup from the raw data.

**Decision:** Option B — deterministic enrichment, applied inside `SummaryService.run()` (in `src/rag/summary/service.py`) after the structured-output analyst returns. The API route is a two-line delegate to the service; the enrichment rule has no FastAPI or Chroma awareness.

**Reasons:**
- LLMs are unreliable at precise structured lookups from text. ARR figures and product-to-application mappings are deterministic facts, not synthesis tasks. Asking the LLM to reproduce them from retrieved context produces hallucinated or misattributed figures.
- The correct values are already computed at startup in `compute_app_product_exposures` (same graph traversal used for ingestion). Reusing that output is exact and free.
- Keeping `product_exposures` out of the LLM schema (`_SummaryReportLLM`) prevents the model from attempting to fill a field it cannot fill reliably.

**Trade-offs accepted:**
- The boundary between what the LLM produced and what was deterministically computed is not visible in the API response. A code reviewer inspecting only the `SummaryReport` schema would not see it without reading `src/rag/summary/service.py` and `src/rag/generator.py`.
- This is a hybrid pipeline, not pure RAG generation. The LLM genuinely synthesises risk findings, executive summary, governance gaps, and health rating from retrieved documents. `product_exposures` is a post-hoc join, not LLM output.
