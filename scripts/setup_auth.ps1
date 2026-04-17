[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'

$AppName       = if ($env:APP_NAME)       { $env:APP_NAME }       else { 'portfolio-rag' }
$ResourceGroup = if ($env:RESOURCE_GROUP) { $env:RESOURCE_GROUP } else { 'rg-portfolio-rag' }

# ── 1. Resolve tenant and app FQDN ───────────────────────────────────────────
$TenantId = az account show --query tenantId -o tsv
$Fqdn     = az containerapp show `
    --name $AppName `
    --resource-group $ResourceGroup `
    --query "properties.configuration.ingress.fqdn" -o tsv
$AppUrl   = "https://$Fqdn"

Write-Host "Tenant   : $TenantId"
Write-Host "App URL  : $AppUrl"

# ── 2. Create Entra app registration ─────────────────────────────────────────
$RegName  = "$AppName-auth"
$ReplyUri = "$AppUrl/.auth/login/aad/callback"

Write-Host "Creating app registration '$RegName' ..."
$AppReg   = az ad app create `
    --display-name $RegName `
    --sign-in-audience AzureADMyOrg `
    --web-redirect-uris $ReplyUri | ConvertFrom-Json
$ClientId = $AppReg.appId

# Enable ID tokens — required for Easy Auth browser redirect flow
az ad app update --id $ClientId --enable-id-token-issuance true

# ── 3. Create a client secret ─────────────────────────────────────────────────
$SecretObj    = az ad app credential reset `
    --id $ClientId `
    --append | ConvertFrom-Json
$ClientSecret = $SecretObj.password

Write-Host "App registration client ID: $ClientId"

# ── 4. Wire the Microsoft provider into Container Apps Easy Auth ──────────────
az containerapp auth microsoft update `
    --name $AppName `
    --resource-group $ResourceGroup `
    --client-id $ClientId `
    --client-secret $ClientSecret `
    --issuer "https://login.microsoftonline.com/$TenantId/v2.0" `
    --yes

# ── 5. Enable authentication, redirect unauthenticated requests ───────────────
az containerapp auth update `
    --name $AppName `
    --resource-group $ResourceGroup `
    --enabled true `
    --unauthenticated-client-action RedirectToLoginPage

Write-Host ""
Write-Host "Easy Auth enabled. Login URL: $AppUrl"
