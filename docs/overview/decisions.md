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

**Note:** The `_chunker.py` module still exists for future flexibility (e.g. if long-form documentation were added per application). It formats each record as a labelled text block, which improves embedding quality over raw JSON serialisation.

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

**Mitigation:** The model name is a single constant in `src/ingest/_indexer.py`, trivially swappable.

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

---

## ADR 6: Demo auth toggle via GitHub Actions (OIDC + custom role + two workflows)

**Status:** Accepted

**Context:**
During live demos, attendees need to access the deployed Container App URL without an Entra sign-in. The maintainer needs a way to temporarily open anonymous access and restore it afterwards, triggerable from a mobile device with minimal steps.

**Decision:** Two `workflow_dispatch` GitHub Actions workflows (`.github/workflows/demo-auth-off.yml` and `demo-auth-on.yml`) that flip Easy Auth's `unauthenticatedClientAction` between `AllowAnonymous` and `RedirectToLoginPage`. A one-time setup script (`scripts/setup_demo_auth_toggle.ps1`) creates the OIDC service principal, a least-privilege custom role, and the federated credential.

**Rationale for each choice over the rejected alternatives:**

- **GitHub Actions over a local script:** A local script requires the maintainer to have az CLI, credentials, and a laptop during a live demo. Two distinct workflow buttons in the GitHub mobile app require about five taps each — no local tooling.
- **OIDC over a client secret:** OIDC federated credentials are secretless — no credential expiry, no rotation ceremony, no secret stored anywhere. A client secret would need to be stored as a GitHub secret and rotated periodically.
- **Custom role over Contributor:** The custom role grants only `Microsoft.App/containerApps/read`, `Microsoft.App/containerApps/authConfigs/read`, and `Microsoft.App/containerApps/authConfigs/write`, scoped to the single Container App resource. Contributor would grant broad write access across the resource group, violating least-privilege.
- **`AllowAnonymous` over `--enabled false`:** Disabling Easy Auth entirely (`--enabled false`) drops the Microsoft provider configuration, making re-locking slower and riskier (requires re-running `setup_auth.ps1`). `AllowAnonymous` keeps the provider intact and makes re-locking instant — a single `az containerapp auth update` call.
- **Two workflows over one with a choice input:** On the GitHub mobile app, two distinct named buttons ("Demo - disable auth" and "Demo - enable auth") require fewer taps than selecting a workflow and then picking an input value from a dropdown.

**Trade-offs accepted:**
- The workflows must be triggered from `main` (the federated credential subject is pinned to `refs/heads/main`). Running from another branch will fail authentication.
- A brief window exists between the `auth update` call and the verify step where the state is transitioning — not a concern for demo use.

---

## ADR 7: GPT-6.1 Terra over GPT-4o, with per-endpoint reasoning effort

**Status:** Accepted

**Context:**
GPT-4o was the generation model for all three LLM calls (free-text query, streaming query, `/summarise` structured output). The GPT-6 family is now OpenAI's recommended production line. GPT-6 models are reasoning models: `temperature`/`top_p` are only accepted when reasoning effort is `none`, and only some models offer `none`.

**Decision:** Use `gpt-6.1-terra` for all generation, configured as module constants in `src/rag/generator.py`. Chat paths use `reasoning_effort="none"` and keep `temperature=0`; `/summarise` uses `reasoning_effort="low"` with no `temperature`. Stay on Chat Completions, moving `/summarise` from `beta.chat.completions.parse` to GA `chat.completions.parse`.

**Rationale for each choice over the rejected alternatives:**

- **Terra over Sol / Astra:** Terra supports effort `none`, so chat keeps deterministic sampling and low time-to-first-token. Sol and Astra have no `none` level, forcing reasoning latency onto every chat call; Astra also costs 4–5x GPT-4o. Terra ($1 / $5 per 1M tokens) is cheaper than GPT-4o ($2.50 / $10).
- **Terra over Luna:** Luna is ~10x cheaper but a weaker fit for multi-hop dependency tracing and the prioritised summary — the two behaviours the demo depends on.
- **Per-endpoint effort over a single setting:** `/summarise` is already non-streamed and does arithmetic (`total_arr_at_risk_000s`) and prioritisation across every at-risk record, so it benefits from reasoning; chat is user-facing and latency-sensitive.
- **Chat Completions over the Responses API:** Terra supports both; no tools are used, so migrating would add diff and test churn for no feature gain. Structured outputs via `chat.completions.parse` were verified live on Terra.
- **Module constants over an env var:** The model changes roughly yearly; an env var would touch compose, Container App config, deploy scripts and docs for no practical benefit.

**Trade-offs accepted:**
- `/summarise` is slower (~6s vs ~3.5s on GPT-4o in A/B) and no longer pinned to `temperature=0`.
- Terra's answers are more thorough — they trace multiple dependency paths and explicitly flag when retrieved context does not account for a stated total — at the cost of slightly longer streamed responses.
- If quality regresses, escalate in order: raise summary effort to `medium` or add `verbosity="low"` to chat → adjust `src/rag/prompts.py` → revert to GPT-4o.

---

## ADR 8: Semantic top-k retained for chat despite incomplete aggregate answers

**Status:** Accepted

**Context:**
Chat (`POST /query`, `GET /query/stream`) retrieves the top 8 applications and top 8 products by semantic similarity. That suits explanatory questions ("what is DataLicensing's dependency chain?") but not aggregate ones that need every record ("which…", "highest…", "list all…"). Records outside the top-k never reach the model, and `SYSTEM_PROMPT` correctly forbids outside knowledge, so the answer is a confident, correctly-computed result over the wrong subset.

Three of the eight suggested-query chips show this, identically on GPT-4o and GPT-6.1 Terra:

| Chip | Returned | Ground truth adds |
|---|---|---|
| Critical or High risk rating | AuthService, CallCentre Suite | ForecastTool (High) |
| Highest ROI | RetailInsights 1.59, TechnologyAdoption 1.42, BrandTracking Platform 1.36 | DataLicensing 2.90, MediaMeasurement 1.89, ConsumerPanel 1.77 lead |
| Overlapping capabilities | SegmentBuilder/PanelIQ, InsightHub/ClientPortal | ForecastTool/WorkforceModel |

Related: "total ARR at risk from AuthService" lists 8 products ($25.1m) against a stated $43.8m, because all 14 products are affected.

**Decision:** Keep semantic top-k for chat. The gap is deliberate: it is a live, reproducible demonstration of a core limitation of naive RAG, used as a talking point when presenting the project. The suggested-query chips that expose it stay unchanged.

**Fix, if the limitation is ever to be removed:** send the full corpus to generation. All 44 documents total ~28k characters (~7k tokens), roughly $0.007 per query on Terra versus ~$0.0025 today, and every product document already carries its computed ROI and revenue at risk. Query routing (classify aggregate intent → metadata filter, as `/summarise` does via `retrieve_at_risk_docs`) or structured tool calls only become worthwhile at corpus sizes that no longer fit in context. With full context, the source chips would need rethinking: "retrieved but not cited" stops meaning anything when everything is retrieved.

**Trade-offs accepted:**
- Unattended viewers of the deployed demo see incomplete answers to suggested queries without the accompanying explanation.
- `/summarise` is unaffected — it already uses a metadata filter rather than semantic search.
