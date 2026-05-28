[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'

$AppName       = if ($env:APP_NAME)       { $env:APP_NAME }       else { 'portfolio-rag' }
$ResourceGroup = if ($env:RESOURCE_GROUP) { $env:RESOURCE_GROUP } else { 'rg-portfolio-rag' }

# -- 1. Resolve identifiers --------------------------------------------------
$SubscriptionId = az account show --query id -o tsv
$TenantId       = az account show --query tenantId -o tsv
$ContainerAppId = az containerapp show --name $AppName --resource-group $ResourceGroup --query id -o tsv

Write-Host "Subscription : $SubscriptionId"
Write-Host "Tenant       : $TenantId"
Write-Host "Container App: $ContainerAppId"

# -- 2. Create or reuse Entra app registration --------------------------------
$RegName = "$AppName-demo-auth-toggle"

$Existing = az ad app list --display-name $RegName | ConvertFrom-Json
if ($Existing.Count -gt 0) {
    $ClientId = $Existing[0].appId
    Write-Host "Reusing existing app registration '$RegName' (appId: $ClientId)"
} else {
    Write-Host "Creating app registration '$RegName' ..."
    $AppReg   = az ad app create --display-name $RegName --sign-in-audience AzureADMyOrg | ConvertFrom-Json
    $ClientId = $AppReg.appId
    Write-Host "Created app registration (appId: $ClientId)"
}

# -- 3. Create or reuse service principal -------------------------------------
$SpList = az ad sp list --filter "appId eq '$ClientId'" | ConvertFrom-Json
if ($SpList.Count -gt 0) {
    $SpId = $SpList[0].id
    Write-Host "Reusing existing service principal (objectId: $SpId)"
} else {
    Write-Host "Creating service principal ..."
    $Sp   = az ad sp create --id $ClientId | ConvertFrom-Json
    $SpId = $Sp.id
    Write-Host "Created service principal (objectId: $SpId)"
}

# -- 4. Create or update custom role definition --------------------------------
$RoleName = "$AppName-demo-auth-toggle"

$ExistingRole = az role definition list --name $RoleName --custom-role-only true | ConvertFrom-Json
$TempRoleFile = [System.IO.Path]::GetTempFileName() + ".json"

if ($ExistingRole.Count -gt 0) {
    Write-Host "Updating custom role '$RoleName' ..."
    # az role definition update requires ARM field names (roleName/permissions) not the simplified create format
    $RoleDefObj = [ordered]@{
        id               = $ExistingRole[0].id
        roleName         = $RoleName
        description      = "Toggle Easy Auth unauthenticated-client-action on $AppName Container App"
        permissions      = @(
            @{
                actions    = @(
                    "Microsoft.App/containerApps/read",
                    "Microsoft.App/containerApps/authConfigs/read",
                    "Microsoft.App/containerApps/authConfigs/write"
                )
                notActions = @()
            }
        )
        assignableScopes = @($ContainerAppId)
    }
    $RoleDefObj | ConvertTo-Json -Depth 5 | Set-Content -Path $TempRoleFile -Encoding UTF8
    az role definition update --role-definition "@$TempRoleFile" | Out-Null
} else {
    Write-Host "Creating custom role '$RoleName' ..."
    $RoleDefObj = [ordered]@{
        Name             = $RoleName
        Description      = "Toggle Easy Auth unauthenticated-client-action on $AppName Container App"
        Actions          = @(
            "Microsoft.App/containerApps/read",
            "Microsoft.App/containerApps/authConfigs/read",
            "Microsoft.App/containerApps/authConfigs/write"
        )
        AssignableScopes = @($ContainerAppId)
    }
    $RoleDefObj | ConvertTo-Json -Depth 5 | Set-Content -Path $TempRoleFile -Encoding UTF8
    az role definition create --role-definition "@$TempRoleFile" | Out-Null
}

Remove-Item $TempRoleFile

# -- 5. Assign custom role to service principal --------------------------------
$ExistingAssignment = az role assignment list --assignee $SpId --role $RoleName --scope $ContainerAppId | ConvertFrom-Json
if ($ExistingAssignment.Count -gt 0) {
    Write-Host "Role assignment already exists, skipping."
} else {
    Write-Host "Assigning role '$RoleName' to service principal ..."
    az role assignment create `
        --assignee-object-id $SpId `
        --assignee-principal-type ServicePrincipal `
        --role $RoleName `
        --scope $ContainerAppId | Out-Null
}

# -- 6. Create federated credential (idempotent by name) ----------------------
$FedCredName = "github-actions-main"
$ExistingFed = az ad app federated-credential list --id $ClientId | ConvertFrom-Json
$FedExists   = $ExistingFed | Where-Object { $_.name -eq $FedCredName }

if ($FedExists) {
    Write-Host "Federated credential '$FedCredName' already exists, skipping."
} else {
    Write-Host "Creating federated credential '$FedCredName' ..."
    $TempFedFile = [System.IO.Path]::GetTempFileName() + ".json"
    $FedCredObj  = [ordered]@{
        name        = $FedCredName
        issuer      = "https://token.actions.githubusercontent.com"
        subject     = "repo:samww/product-portfolio-rag:ref:refs/heads/main"
        audiences   = @("api://AzureADTokenExchange")
        description = "GitHub Actions on main branch of samww/product-portfolio-rag"
    }
    $FedCredObj | ConvertTo-Json -Depth 5 | Set-Content -Path $TempFedFile -Encoding UTF8
    az ad app federated-credential create --id $ClientId --parameters "@$TempFedFile" | Out-Null
    Remove-Item $TempFedFile
}

# -- 7. Print output values and copy-paste commands ---------------------------
Write-Host ""
Write-Host "Setup complete. Add the following secrets to your GitHub repository:"
Write-Host ""
Write-Host "  AZURE_CLIENT_ID       = $ClientId"
Write-Host "  AZURE_TENANT_ID       = $TenantId"
Write-Host "  AZURE_SUBSCRIPTION_ID = $SubscriptionId"
Write-Host ""
Write-Host "Copy-paste gh commands:"
Write-Host ""
Write-Host "  gh secret set AZURE_CLIENT_ID       --body ""$ClientId"""
Write-Host "  gh secret set AZURE_TENANT_ID       --body ""$TenantId"""
Write-Host "  gh secret set AZURE_SUBSCRIPTION_ID --body ""$SubscriptionId"""
