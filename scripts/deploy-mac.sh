#!/usr/bin/env bash
set -euo pipefail

APP_NAME="${APP_NAME:-portfolio-rag}"
RESOURCE_GROUP="${RESOURCE_GROUP:-rg-portfolio-rag}"
LOCATION="${LOCATION:-uksouth}"
OPENAI_API_KEY="${OPENAI_API_KEY:?OPENAI_API_KEY env var is required}"
ENV_NAME="${APP_NAME}-env"

# Deterministic ACR name: alphanumeric only, max 50 chars
ACR_NAME="$(echo "$APP_NAME" | tr -cd '[:alnum:]')acr"
ACR_SERVER="${ACR_NAME}.azurecr.io"

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "Resource group : $RESOURCE_GROUP"
echo "ACR            : $ACR_SERVER"
echo "ContainerApp   : $APP_NAME"

# ── 1. Resource group + ACR ──────────────────────────────────────────────────
az group create --name "$RESOURCE_GROUP" --location "$LOCATION" --output none

az acr create \
    --name "$ACR_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --sku Basic \
    --admin-enabled true \
    --output none

# ── 2. Build image in ACR (cloud build — no local Docker needed) ─────────────
TAG="$(date -u '+%Y%m%d%H%M%S')"
IMAGE="${ACR_SERVER}/${APP_NAME}:${TAG}"

echo "Building image $IMAGE ..."
az acr build \
    --registry "$ACR_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --image "${APP_NAME}:${TAG}" \
    "$REPO_ROOT"

# ── 3. Get ACR admin credentials ─────────────────────────────────────────────
ACR_USER="$(az acr credential show --name "$ACR_NAME" --query username -o tsv)"
ACR_PASS="$(az acr credential show --name "$ACR_NAME" --query 'passwords[0].value' -o tsv)"

# ── 4. Ensure Container App Environment exists ────────────────────────────────
ENV_COUNT="$(az containerapp env list --resource-group "$RESOURCE_GROUP" \
    --query "[?name=='${ENV_NAME}'] | length(@)" -o tsv)"
if [ "$ENV_COUNT" -eq 0 ]; then
    echo "Creating environment $ENV_NAME ..."
    az containerapp env create \
        --name "$ENV_NAME" \
        --resource-group "$RESOURCE_GROUP" \
        --location "$LOCATION" \
        --output none
fi

# ── 5. Create or update ContainerApp ─────────────────────────────────────────
APP_COUNT="$(az containerapp list --resource-group "$RESOURCE_GROUP" \
    --query "[?name=='${APP_NAME}'] | length(@)" -o tsv)"
if [ "$APP_COUNT" -gt 0 ]; then
    echo "Updating ContainerApp $APP_NAME ..."
    az containerapp update \
        --name "$APP_NAME" \
        --resource-group "$RESOURCE_GROUP" \
        --image "$IMAGE" \
        --output none
else
    echo "Creating ContainerApp $APP_NAME ..."
    az containerapp create \
        --name "$APP_NAME" \
        --resource-group "$RESOURCE_GROUP" \
        --environment "$ENV_NAME" \
        --image "$IMAGE" \
        --registry-server "$ACR_SERVER" \
        --registry-username "$ACR_USER" \
        --registry-password "$ACR_PASS" \
        --target-port 8000 \
        --ingress external \
        --min-replicas 0 \
        --max-replicas 3 \
        --output none
fi

# ── 6. Secrets + env vars ─────────────────────────────────────────────────────
az containerapp secret set \
    --name "$APP_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --secrets "openai-api-key=${OPENAI_API_KEY}"

az containerapp update \
    --name "$APP_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --set-env-vars "OPENAI_API_KEY=secretref:openai-api-key" \
    --output none

echo ""
FQDN="$(az containerapp show --name "$APP_NAME" --resource-group "$RESOURCE_GROUP" \
    --query "properties.configuration.ingress.fqdn" -o tsv)"
echo "Deployed: https://$FQDN"
