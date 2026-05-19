# Deployment

## ASCII-only rule for scripts

All deploy and auth scripts must use standard ASCII characters only. Do not use Unicode box-drawing characters, em dashes, curly quotes, or any non-ASCII characters in `.ps1` or `.sh` scripts. Non-ASCII characters cause encoding errors on some terminals and editors.

## How deploys work

`scripts/deploy.ps1` (Windows) / `scripts/deploy-mac.sh` (Mac/Linux) runs `az acr build` -- the Docker image is built in Azure's cloud (ACR Tasks), not locally. No local Docker daemon is required.

## Dockerfile: Node base image

**Use `node:22-slim` directly from Docker Hub.** Do not use the MCR mirror for Node.

```dockerfile
FROM node:22-slim AS frontend-build
```

### Why Node 22

`camera-controls@3.1.2` (transitive dependency of `@react-three/drei`) requires Node >= 22. Using Node 20 causes `npm ci` to fail with an `EBADENGINE` warning and broken build.

### Why not the MCR mirror

`mcr.microsoft.com/mirror/docker/library/node` only carries tags up to Node 20 -- `node:22-slim` fails with `manifest unknown`. `az acr build` pulls from Docker Hub directly without rate-limit issues at personal deploy cadence.

## Ingestion is build-time only

All three ingestion artifacts (ChromaDB collection, `.chroma/pca.npz`, `src/api/static/points.json`) are baked into the Docker image at build time. The runtime entrypoint (`scripts/start.sh`) is a single `exec uvicorn` line — it does not call `ingest.py` or make any OpenAI embedding calls on startup. `OPENAI_API_KEY` must be available at image build time (passed as `--build-arg`) so `scripts/ingest.py` can call the embedding API.

### Dockerfile stage layout

The Python side is split into three stages so the build-time `OPENAI_API_KEY` never appears in the final image:

1. `python-base` — installs Python deps, copies source, data, and the built frontend.
2. `ingest` — `FROM python-base`, declares `ARG OPENAI_API_KEY`, runs `scripts/ingest.py`. Isolated so BuildKit only records the build-arg into this stage's layer history.
3. `runtime` — `FROM python-base` (the final image). No `ARG OPENAI_API_KEY`. Receives only the ingest artifacts via `COPY --from=ingest /app/.chroma` and `COPY --from=ingest /app/src/api/static/points.json`.

Verify the final image is clean with:

```
docker history --no-trunc <image> | grep -i OPENAI || echo OK
docker run --rm --entrypoint env <image> | grep -i OPENAI || echo OK
```

Both should print `OK`. If you add a new build-time step that needs `OPENAI_API_KEY`, put it in the `ingest` stage — never in `runtime`.

## Deploy script

`scripts/deploy.ps1` / `scripts/deploy-mac.sh` -- idempotent, re-runnable. Steps:

1. Create resource group + ACR (Basic SKU, admin enabled)
2. Build image in ACR with a timestamp tag (`yyyyMMddHHmmss`), passing `OPENAI_API_KEY` as a build arg (required for build-time ingestion)
3. Retrieve ACR admin credentials
4. Create Container App Environment if it does not already exist
5. Create or update Azure Container App (target port 8000, external ingress, 0-3 replicas)
6. Set `OPENAI_API_KEY` as a secret and wire it as an env var via `secretref` (required at runtime for LLM generation calls)

Required env var: `OPENAI_API_KEY`. Optional overrides: `APP_NAME`, `RESOURCE_GROUP`, `LOCATION`.

## Auth script

`scripts/setup_auth.ps1` / `scripts/setup_auth-mac.sh` -- configures Azure AD Easy Auth on an already-deployed Container App. Steps:

1. Resolve tenant ID and app FQDN from the live Container App
2. Create or reuse an Entra app registration (`<APP_NAME>-auth`)
   - **Existing registration**: always resets the client secret and updates the redirect URI
   - **New registration**: creates the app, enables ID token issuance, then creates a client secret
3. Wire the Microsoft provider into Container Apps Easy Auth with the client ID, secret, and issuer URL
4. Enable authentication and redirect unauthenticated requests to the login page

Required: the Container App must already be deployed. Optional overrides: `APP_NAME`, `RESOURCE_GROUP`.
