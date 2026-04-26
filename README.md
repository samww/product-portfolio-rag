# Product Portfolio RAG

A Retrieval-Augmented Generation application for querying an enterprise application portfolio in plain English. The system ingests structured application and product records into a vector store and answers natural language questions grounded in the actual data, with streamed responses and a structured risk summary report.

## What it does

**Free-text queries** — ask any question about the estate. Responses stream token-by-token via SSE, cite the source documents used, and expose raw retrieved context for inspection.

**Guided query chips** — eight pre-written queries grouped by theme (Risk, ROI, Governance, Explore) that walk through the most analytically interesting portfolio scenarios.

**Structured risk summary** — `POST /summarise` runs an agentic pass over all high-risk and ownerless applications and returns a machine-readable `SummaryReport`: overall health rating, prioritised risk findings with recommended actions, and governance gaps.

**3D embedding visualisation** — `/embeddings` renders all 44 documents as a 3D scatter plot (PCA-reduced from 1536-dimensional embeddings). Type a query to project it into the same space, run the RAG stream, and see lines drawn to every cited document.

The dataset is a fictional company (Pragmenta Insights) with 30 applications and 14 commercial products, designed to surface non-obvious risk. The centrepiece scenario is a two-hop indirect dependency — DataLicensing ($6.2m ARR) → CoreDataWarehouse → AuthService (Critical, vendor EOL Q2 2026). Transitive risk is resolved at ingestion time and stored in the product document; no multi-hop retrieval or LLM arithmetic at query time.

## Architecture

```mermaid
graph LR
    subgraph Ingestion
        A["data/*.json"] --> B["loader → joiner → chunker"]
        B --> C["indexer → ChromaDB"]
    end

    subgraph Query
        D["User query"] --> E["embed: text-embedding-3-small"]
        E --> F["ChromaDB: top-k apps\n+ top-k products"]
        F --> G["GPT-4o"]
        G --> H["SSE token stream\nor full JSON"]
    end

    subgraph Summarise
        I["POST /summarise"] --> J["ChromaDB metadata filter\nHigh/Critical OR ownerless"]
        J --> K["GPT-4o structured output\n(risk findings, summary, health)"]
        K --> M["Deterministic enrichment\nproduct_exposures injected\nfrom startup lookup"]
        M --> L["SummaryReport JSON"]
    end
```

## Example queries

```
Which applications are at Critical or High risk, and what is the vendor situation?
How much revenue is exposed to the AuthService risk, directly and indirectly?
Which products have the best ROI relative to their application costs?
Which applications have no named owner?
What modernisation has happened in the last two years, and what savings did it deliver?
Are there any capability overlaps between applications that could be consolidated?
```

## Stack

| Layer | Technology |
|---|---|
| Backend | Python 3.12, FastAPI, uv |
| LLM | OpenAI GPT-4o (generation), text-embedding-3-small (embeddings) |
| Vector store | ChromaDB — local file persistence at `.chroma/` |
| Frontend | React 19, TypeScript, Vite, Tailwind CSS |
| Container | Docker multi-stage build (Node 22 → Python 3.12) |
| Cloud | Azure Container Apps, az CLI, optional Easy Auth |

No LangChain or LlamaIndex — the RAG pipeline is built directly with the OpenAI SDK and ChromaDB SDK.

## Getting started

### Docker (recommended)

Requires Docker and an OpenAI API key.

```bash
echo "OPENAI_API_KEY=sk-..." > .env
docker compose up
```

On first startup the container ingests data into ChromaDB (~10 seconds). Subsequent starts skip ingest if data already exists, then serve the application at `http://localhost:8000`.

### Local development

**Prerequisites:** Python 3.12, [uv](https://docs.astral.sh/uv/), Node.js 22.

```bash
# 1. Configure environment
cp .env.example .env          # add your OPENAI_API_KEY

# 2. Install Python dependencies
uv sync

# 3. Ingest data into ChromaDB
uv run python scripts/ingest.py --reset

# 4. Start the API
uv run uvicorn src.api.main:app --reload

# 5. Start the frontend (separate terminal)
cd src/frontend
npm install
npm run dev
```

Frontend dev server: `http://localhost:5173` (proxies API calls to port 8000).
API: `http://localhost:8000`.

To force a full re-index at any point: `uv run python scripts/ingest.py --reset`

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `OPENAI_API_KEY` | Yes | Used for both embeddings (`text-embedding-3-small`) and generation (`GPT-4o`) |

## Running tests

```bash
# Backend
uv run pytest

# Frontend
cd src/frontend && npx vitest run
```

## Project structure

```
src/
  ingest/
    ingestor.py       # Ingestor class — public entrypoint orchestrating the full pipeline
    pca.py            # PCA reduction for 3D embedding visualisation
    _loader.py        # (internal) JSON → typed records
    _joiner.py        # (internal) enrich products; compute ROI, risk, ARR-at-risk, exposures
    _chunker.py       # (internal) format records as embeddable text
    _indexer.py       # (internal) embed + upsert into ChromaDB; produce PCA artifact
  rag/                # retriever, generator, prompts, models
    summary/          # SummaryService — ports & adapters for /summarise composition
  api/                # FastAPI app, routes, API-layer models
  frontend/           # React + Vite frontend
data/
  applications.json   # 30 application records (source of truth)
  products.json       # 14 product records
scripts/
  ingest.py           # ingestion entry point
  start.sh            # container entrypoint (ingests on first start; subsequent starts are no-ops)
  deploy.ps1          # deploy to Azure Container Apps
  setup_auth.ps1      # enable Easy Auth on deployed app
  validate_data.py    # validate data/*.json integrity
tests/
  fixtures/           # 5-app and 3-product subsets for fast test runs
docs/
  agent/              # concise reference docs loaded by AI agents during development
  overview/           # architecture decisions, dependency graphs
```

## Azure deployment

**Prerequisites:** [az CLI](https://learn.microsoft.com/en-us/cli/azure/install-azure-cli), an Azure subscription.

```bash
az login
az extension add --name containerapp
```

**Windows (PowerShell)**

```powershell
# Deploy (creates resource group, builds image in ACR, creates/updates Container App)
$env:OPENAI_API_KEY = "sk-..."
.\scripts\deploy.ps1

# Enable Easy Auth (idempotent — reuses existing Entra app registration on re-run)
.\scripts\setup_auth.ps1
```

**Mac / Linux (bash)**

```bash
# Deploy (creates resource group, builds image in ACR, creates/updates Container App)
export OPENAI_API_KEY="sk-..."
bash scripts/deploy-mac.sh

# Enable Easy Auth (idempotent — reuses existing Entra app registration on re-run)
bash scripts/setup_auth-mac.sh
```

`deploy` is idempotent — re-running it on an existing deployment updates the running app with a fresh image. Default app name is `portfolio-rag` in resource group `rg-portfolio-rag` (UK South); override with `APP_NAME`, `RESOURCE_GROUP`, `LOCATION` (env vars on both platforms).

## Docs

| Path | Contents |
|---|---|
| `docs/overview/decisions.md` | Architecture Decision Records — ChromaDB vs Azure AI Search, denormalised products, no chunking, embedding model choice, deterministic enrichment in `/summarise` |
| `docs/overview/dependencies.md` | Mermaid dependency diagrams for all 30 applications and 14 products |
| `docs/agent/backend.md` | Backend architecture, request flow, module map |
| `docs/agent/frontend.md` | Frontend architecture, routing, component map, test conventions |
| `docs/agent/data-model.md` | Application and product schemas, key risk scenarios |
| `docs/agent/api.md` | Endpoint signatures, request/response shapes, SSE format |
| `docs/agent/deployment.md` | Deploy script, Dockerfile constraints, Node version, MCR mirror limitations |
