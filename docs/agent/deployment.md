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

## Deploy script

`scripts/deploy.ps1` / `scripts/deploy-mac.sh` -- idempotent, re-runnable. Steps:

1. Create resource group + ACR (Basic SKU, admin enabled)
2. Build image in ACR with a timestamp tag (`yyyyMMddHHmmss`), passing `OPENAI_API_KEY` as a build arg
3. Retrieve ACR admin credentials
4. Create Container App Environment if it does not already exist
5. Create or update Azure Container App (target port 8000, external ingress, 0-3 replicas)
6. Set `OPENAI_API_KEY` as a secret and wire it as an env var via `secretref`

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
