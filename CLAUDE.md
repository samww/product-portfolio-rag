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
All frontend commands must run from `src/frontend/`, not repo root:
- Frontend tests: `cd src/frontend && npx vitest run`
- Frontend dev server: `cd src/frontend && npm run dev`
- Frontend build: `cd src/frontend && npm run build`
- Docker build: `docker compose build`
- Docker run: `docker compose up`

## Slices

No feature currently in progress.

## Agent docs (load as needed)

- [Backend: architecture & RAG pipeline](docs/agent/backend.md) — stack, request flow, module map, prompt design
- [Frontend: architecture & component map](docs/agent/frontend.md) — routing, pages, components, types, test conventions, backend communication
- [Data model](docs/agent/data-model.md) — schemas, key risk scenarios, where to find full inventory
- [API reference](docs/agent/api.md) — endpoints, request/response shapes, SSE format
- [Deployment](docs/agent/deployment.md) — deploy script, Dockerfile constraints, Node version requirements, MCR mirror limitations
