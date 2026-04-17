# Product Portfolio RAG

## Git workflow

- Do not commit or push until the user explicitly asks.
- All slices require human verification before committing. Once TDD cycles are complete, stop and wait for the user to verify before committing, pushing, or closing the issue.

## Commands

- Run backend tests: `uv run pytest`
- Start API: `uv run uvicorn src.api.main:app --reload`
- Re-ingest data: `uv run python scripts/ingest.py --reset`
- Frontend tests: `cd src/frontend && npx vitest run`
- Frontend dev server: `cd src/frontend && npm run dev`
- Frontend build: `cd src/frontend && npm run build`
- Docker build: `docker compose build`
- Docker run: `docker compose up`

## Slices

| # | Slice | Issue |
|---|---|---|
| 1 | Project scaffolding, synthetic data, validation | #2 |
| 2 | Ingestion pipeline — load, join, chunk, index into ChromaDB | #3 |
| 3 | RAG query engine and POST /query | #4 |
| 4 | Streaming query via GET /query/stream SSE | #5 |
| 5 | Structured risk summary via POST /summarise | #6 |
| 6 | Frontend — query chips, streaming response, context panel | #7 |
| 7 | Frontend — summary report panel with health badge | #8 |
| 8 | Docker multi-stage build and container entrypoint | #9 |
| 9 | Azure deployment — `az containerapp up`, Easy Auth (`az containerapp auth microsoft update` + `az containerapp auth update`), deploy scripts | #10 |
| 10 | Documentation — README, CLAUDE.md, ADRs | #11 |

## Agent docs (load as needed)

- [Backend: architecture & RAG pipeline](docs/agent/backend.md) — stack, request flow, module map, prompt design
- [Data model](docs/agent/data-model.md) — schemas, key risk scenarios, where to find full inventory
- [API reference](docs/agent/api.md) — endpoints, request/response shapes, SSE format
