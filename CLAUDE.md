# Product Portfolio RAG

## Stack

**Backend:** FastAPI · ChromaDB · OpenAI API · Python managed with `uv`  
**Frontend:** React 19 · TypeScript · Tailwind CSS v4 · Vite · react-router-dom · Vitest  
**Infrastructure:** Docker Compose · Azure Container Apps

## Git workflow

- Do not commit or push until the user explicitly asks.
- All slices require human verification before committing. Once TDD cycles are complete, stop and wait for the user to verify before committing, pushing, or closing the issue.

## Commands

- Run backend tests: `uv run pytest`
- Start API: `uv run uvicorn src.api.main:app --reload`
- Re-ingest data: `uv run python scripts/ingest.py --reset`
- Frontend tests: `cd src/frontend && npx vitest run` — must run from `src/frontend/`, not repo root
- Frontend dev server: `cd src/frontend && npm run dev` — must run from `src/frontend/`, not repo root
- Frontend build: `cd src/frontend && npm run build` — must run from `src/frontend/`, not repo root
- Docker build: `docker compose build`
- Docker run: `docker compose up`

## Slices

This section gives an overview of the current feature being developed. See the linked issue for full requirements and implementation decisions.

**Current feature: Deepen the ingest module (`Ingestor` class)** — #42

| # | Slice | Issue | Status |
|---|---|---|---|
| 1 | Introduce `Ingestor.run()` and migrate `scripts/ingest.py` | #43 | ✅ Done |
| 2 | Add `Ingestor.exposures()` and collapse API lifespan duplication | #44 | ✅ Done |
| 3 | Prune redundant ingest unit tests; add chunker/retriever round-trip test | #45 | ✅ Done |
| 4 | Privatize ingest internals (`_loader`, `_joiner`, `_chunker`, `_indexer`) | #46 | 🔲 Todo |

## Agent docs (load as needed)

- [Backend: architecture & RAG pipeline](docs/agent/backend.md) — stack, request flow, module map, prompt design
- [Frontend: architecture & component map](docs/agent/frontend.md) — routing, pages, components, types, test conventions, backend communication
- [Data model](docs/agent/data-model.md) — schemas, key risk scenarios, where to find full inventory
- [API reference](docs/agent/api.md) — endpoints, request/response shapes, SSE format
