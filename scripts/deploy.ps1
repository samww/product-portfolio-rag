[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$RepoRoot = Split-Path -Parent $PSScriptRoot

function Assert-AzSuccess([string]$Op) {
    if ($LASTEXITCODE -ne 0) { throw "az $Op failed (exit $LASTEXITCODE)" }
}

$AppName       = if ($env:APP_NAME)       { $env:APP_NAME }       else { 'portfolio-rag' }
$ResourceGroup = if ($env:RESOURCE_GROUP) { $env:RESOURCE_GROUP } else { 'rg-portfolio-rag' }
$Location      = if ($env:LOCATION)       { $env:LOCATION }       else { 'uksouth' }
$OpenAiApiKey  = if ($env:OPENAI_API_KEY) { $env:OPENAI_API_KEY } else { throw 'OPENAI_API_KEY env var is required' }
$EnvName       = "$AppName-env"

# Deterministic ACR name: alphanumeric only, max 50 chars
$AcrName   = ($AppName -replace '[^a-zA-Z0-9]', '') + 'acr'
$AcrServer = "$AcrName.azurecr.io"

Write-Host "Resource group : $ResourceGroup"
Write-Host "ACR            : $AcrServer"
Write-Host "ContainerApp   : $AppName"

# ── 1. Resource group + ACR ──────────────────────────────────────────────────
az group create --name $ResourceGroup --location $Location --output none
Assert-AzSuccess 'group create'

az acr create `
    --name $AcrName `
    --resource-group $ResourceGroup `
    --sku Basic `
    --admin-enabled true `
    --output none
Assert-AzSuccess 'acr create'

# ── 2. Build image in ACR (cloud build — no local Docker needed) ─────────────
$Tag   = (Get-Date -Format 'yyyyMMddHHmmss')
$Image = "$AcrServer/${AppName}:$Tag"

Write-Host "Building image $Image ..."
az acr build `
    --registry $AcrName `
    --resource-group $ResourceGroup `
    --image "${AppName}:$Tag" `
    $RepoRoot
Assert-AzSuccess 'acr build'

# ── 3. Get ACR admin credentials ─────────────────────────────────────────────
$AcrCreds = az acr credential show --name $AcrName | ConvertFrom-Json
$AcrUser  = $AcrCreds.username
$AcrPass  = $AcrCreds.passwords[0].value

# ── 4. Ensure Container App Environment exists ────────────────────────────────
$EnvCount = az containerapp env list --resource-group $ResourceGroup `
    --query "[?name=='$EnvName'] | length(@)" -o tsv
if ($EnvCount -eq 0) {
    Write-Host "Creating environment $EnvName ..."
    az containerapp env create `
        --name $EnvName `
        --resource-group $ResourceGroup `
        --location $Location `
        --output none
}

# ── 5. Create or update ContainerApp ─────────────────────────────────────────
$AppCount = az containerapp list --resource-group $ResourceGroup `
    --query "[?name=='$AppName'] | length(@)" -o tsv
if ($AppCount -gt 0) {
    Write-Host "Updating ContainerApp $AppName ..."
    az containerapp update `
        --name $AppName `
        --resource-group $ResourceGroup `
        --image $Image `
        --output none
} else {
    Write-Host "Creating ContainerApp $AppName ..."
    az containerapp create `
        --name $AppName `
        --resource-group $ResourceGroup `
        --environment $EnvName `
        --image $Image `
        --registry-server $AcrServer `
        --registry-username $AcrUser `
        --registry-password $AcrPass `
        --target-port 8000 `
        --ingress external `
        --min-replicas 0 `
        --max-replicas 3 `
        --output none
}

# ── 6. Secrets + env vars ─────────────────────────────────────────────────────
az containerapp secret set `
    --name $AppName `
    --resource-group $ResourceGroup `
    --secrets "openai-api-key=$OpenAiApiKey"

az containerapp update `
    --name $AppName `
    --resource-group $ResourceGroup `
    --set-env-vars "OPENAI_API_KEY=secretref:openai-api-key" `
    --output none

Write-Host ""
$Fqdn = az containerapp show --name $AppName --resource-group $ResourceGroup --query "properties.configuration.ingress.fqdn" -o tsv
Write-Host "Deployed: https://$Fqdn"
