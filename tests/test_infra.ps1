Set-Location (Split-Path -Parent $PSScriptRoot)

$Pass = 0
$Fail = 0
$Errors = @()

function Pass-Test($desc) { Write-Host "  PASS: $desc"; $script:Pass++ }
function Fail-Test($desc) { Write-Host "  FAIL: $desc"; $script:Fail++; $script:Errors += $desc }

function Assert-Contains($desc, $file, $pattern) {
    if (Test-Path $file) {
        if ((Get-Content $file -Raw) -match $pattern) {
            Pass-Test $desc
        } else {
            Fail-Test "$desc  (pattern '$pattern' not found in $file)"
        }
    } else {
        Fail-Test "$desc  ($file not found)"
    }
}

function Assert-NotContains($desc, $file, $pattern) {
    if (Test-Path $file) {
        if ((Get-Content $file -Raw) -notmatch $pattern) {
            Pass-Test $desc
        } else {
            Fail-Test "$desc  (pattern '$pattern' should not appear in $file)"
        }
    } else {
        Fail-Test "$desc  ($file not found)"
    }
}

Write-Host "=== Slice 9: Azure deployment ==="
Write-Host ""

Write-Host "deploy.ps1"
Assert-Contains `
    "deploy.ps1: uses az containerapp up --source" `
    "scripts/deploy.ps1" `
    "az containerapp up"

Assert-Contains `
    "deploy.ps1: sets external ingress on port 8000" `
    "scripts/deploy.ps1" `
    "--ingress external.*--target-port 8000|--target-port 8000.*--ingress external"

Assert-Contains `
    "deploy.ps1: stores OPENAI_API_KEY via az containerapp secret set" `
    "scripts/deploy.ps1" `
    "az containerapp secret set"

Assert-Contains `
    "deploy.ps1: references secret via secretref in env var" `
    "scripts/deploy.ps1" `
    "secretref:openai-api-key"

Assert-NotContains `
    "deploy.ps1: does not use az deployment group create (Bicep removed)" `
    "scripts/deploy.ps1" `
    "az deployment group create"

Write-Host ""
Write-Host "setup_auth.ps1"
Assert-Contains `
    "setup_auth.ps1: uses az containerapp auth microsoft enable" `
    "scripts/setup_auth.ps1" `
    "az containerapp auth microsoft enable"

Assert-Contains `
    "setup_auth.ps1: uses --new-app-registration (one-shot App Registration)" `
    "scripts/setup_auth.ps1" `
    "--new-app-registration"

Assert-NotContains `
    "setup_auth.ps1: does not manually create App Registration (handled by CLI)" `
    "scripts/setup_auth.ps1" `
    "az ad app create"

Write-Host ""
Write-Host "Results: $Pass passed, $Fail failed"

if ($Errors.Count -gt 0) {
    Write-Host ""
    Write-Host "Failures:"
    $Errors | ForEach-Object { Write-Host "  - $_" }
    exit 1
}
