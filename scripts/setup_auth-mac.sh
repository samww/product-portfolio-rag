#!/usr/bin/env bash
set -euo pipefail

APP_NAME="${APP_NAME:-portfolio-rag}"
RESOURCE_GROUP="${RESOURCE_GROUP:-rg-portfolio-rag}"

# -- 1. Resolve tenant and app FQDN -------------------------------------------
TENANT_ID="$(az account show --query tenantId -o tsv)"
FQDN="$(az containerapp show \
    --name "$APP_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --query "properties.configuration.ingress.fqdn" -o tsv)"
APP_URL="https://$FQDN"

echo "Tenant   : $TENANT_ID"
echo "App URL  : $APP_URL"

# -- 2. Create or reuse Entra app registration --------------------------------
REG_NAME="${APP_NAME}-auth"
REPLY_URI="${APP_URL}/.auth/login/aad/callback"

EXISTING_ID="$(az ad app list --display-name "$REG_NAME" --query '[0].appId' -o tsv)"
if [ -n "$EXISTING_ID" ]; then
    CLIENT_ID="$EXISTING_ID"
    echo "Reusing existing app registration '$REG_NAME' (appId: $CLIENT_ID)"

    # Always reset and capture a fresh secret
    CLIENT_SECRET="$(az ad app credential reset --id "$CLIENT_ID" --query password -o tsv)"

    # Always update redirect URIs to include the current ReplyUri
    az ad app update --id "$CLIENT_ID" --web-redirect-uris "$REPLY_URI"
else
    echo "Creating app registration '$REG_NAME' ..."
    CLIENT_ID="$(az ad app create \
        --display-name "$REG_NAME" \
        --sign-in-audience AzureADMyOrg \
        --web-redirect-uris "$REPLY_URI" \
        --query appId -o tsv)"

    # Enable ID tokens - required for Easy Auth browser redirect flow
    az ad app update --id "$CLIENT_ID" --enable-id-token-issuance true

    # -- 3. Create a client secret (new registration only) --------------------
    CLIENT_SECRET="$(az ad app credential reset --id "$CLIENT_ID" --query password -o tsv)"
fi

echo "App registration client ID: $CLIENT_ID"

if [ -z "$CLIENT_SECRET" ]; then
    echo "WARNING: Reusing existing registration - client secret not rotated."
    echo "To rotate, run: az ad app credential reset --id $CLIENT_ID"
    exit 0
fi

# -- 4. Wire the Microsoft provider into Container Apps Easy Auth --------------
az containerapp auth microsoft update \
    --name "$APP_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --client-id "$CLIENT_ID" \
    --client-secret "$CLIENT_SECRET" \
    --issuer "https://login.microsoftonline.com/${TENANT_ID}/v2.0" \
    --yes

# -- 5. Enable authentication, redirect unauthenticated requests ---------------
az containerapp auth update \
    --name "$APP_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --enabled true \
    --unauthenticated-client-action RedirectToLoginPage

echo ""
echo "Easy Auth enabled. Login URL: $APP_URL"
