# Deployment

## How deploys work

`scripts/deploy.ps1` (Windows) / `scripts/deploy-mac.sh` (Mac/Linux) runs `az acr build` — the Docker image is built in Azure's cloud (ACR Tasks), not locally. No local Docker daemon is required.

## Dockerfile: Node base image

**Use `node:22-slim` directly from Docker Hub.** Do not use the MCR mirror for Node.

```dockerfile
FROM node:22-slim AS frontend-build
```

### Why Node 22

`camera-controls@3.1.2` (transitive dependency of `@react-three/drei`) requires Node >= 22. Using Node 20 causes `npm ci` to fail with an `EBADENGINE` warning and broken build.

### Why not the MCR mirror

`mcr.microsoft.com/mirror/docker/library/node` only carries tags up to Node 20 — `node:22-slim` fails with `manifest unknown`. `az acr build` pulls from Docker Hub directly without rate-limit issues at personal deploy cadence.

## Deploy script

`scripts/deploy.ps1` / `scripts/deploy-mac.sh` — idempotent, re-runnable. Steps:

1. Create resource group + ACR (Basic SKU, admin enabled)
2. Build image in ACR with a timestamp tag (`yyyyMMddHHmmss`)
3. Create or update Azure Container App
4. Set `OPENAI_API_KEY` as a secret env var

Required env var: `OPENAI_API_KEY`. Optional overrides: `APP_NAME`, `RESOURCE_GROUP`, `LOCATION`.
