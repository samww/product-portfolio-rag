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

Write-Host "=== Slice 10: Build-time ingestion ==="
Write-Host ""

Write-Host "start.sh"
Assert-NotContains `
    "start.sh: does not run ingestion at runtime" `
    "scripts/start.sh" `
    "ingest\.py"

Write-Host ""
Write-Host "Dockerfile"
Assert-Contains `
    "Dockerfile: declares OPENAI_API_KEY build arg" `
    "Dockerfile" `
    "ARG OPENAI_API_KEY"

Assert-Contains `
    "Dockerfile: runs ingestion at build time" `
    "Dockerfile" `
    "RUN.*uv run python.*ingest\.py"

Write-Host ""
Write-Host "deploy.ps1 (build-arg)"
Assert-Contains `
    "deploy.ps1: passes OPENAI_API_KEY as build-arg to az acr build" `
    "scripts/deploy.ps1" `
    "--build-arg.*OPENAI_API_KEY|OPENAI_API_KEY.*--build-arg"

Write-Host ""
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
Write-Host "deploy.ps1 (behavioural)"

function New-MockAzDir {
    param([int]$AcrBuildExitCode = 0)
    $TempDir = [IO.Path]::Combine([IO.Path]::GetTempPath(), [IO.Path]::GetRandomFileName())
    $null = New-Item -ItemType Directory -Path $TempDir
    $LogFile = "$TempDir\az_calls.log"

    # PowerShell mock: logs every call, returns configured exit code for acr build
    $mockPs1 = @"
param([Parameter(ValueFromRemainingArguments=`$true)][string[]]`$a)
Add-Content '$LogFile' (`$a -join ' ')
if (`$a[0] -eq 'acr' -and `$a[1] -eq 'build') { exit $AcrBuildExitCode }
if (`$a[0] -eq 'acr' -and `$a[1] -eq 'credential') {
    Write-Output '{"username":"u","passwords":[{"value":"p"}]}'
    exit 0
}
if (`$a[0] -eq 'containerapp') {
    if (`$a[1] -eq 'env' -and `$a[2] -eq 'list') { Write-Output '0'; exit 0 }
    if (`$a[1] -eq 'list') { Write-Output '0'; exit 0 }
    if (`$a[1] -eq 'show') { Write-Output 'fqdn.example.com'; exit 0 }
    exit 0
}
exit 0
"@
    Set-Content -Path "$TempDir\az_mock.ps1" -Value $mockPs1 -Encoding UTF8

    @'
@echo off
powershell.exe -NoProfile -NonInteractive -File "%~dp0az_mock.ps1" %*
exit /b %ERRORLEVEL%
'@ | Set-Content -Path "$TempDir\az.cmd" -Encoding Ascii

    return @{ Dir = $TempDir; Log = $LogFile }
}

$RepoRoot  = (Get-Location).Path
$DeployPs1 = "$RepoRoot\scripts\deploy.ps1"

# ── Behavioural test 1: halts on acr build failure ────────────────────────────
$mock1 = New-MockAzDir -AcrBuildExitCode 2
$cmd1  = "`$env:PATH='$($mock1.Dir);'+`$env:PATH; `$env:OPENAI_API_KEY='k'; Set-Location '$RepoRoot'; try { & '$DeployPs1' } catch { exit 1 }; exit 0"
$proc1 = Start-Process powershell.exe `
    -ArgumentList @('-NoProfile', '-NonInteractive', '-Command', $cmd1) `
    -Wait -PassThru -NoNewWindow `
    -RedirectStandardOutput "$($mock1.Dir)\out.txt" `
    -RedirectStandardError  "$($mock1.Dir)\err.txt"
$calls1  = if (Test-Path $mock1.Log) { Get-Content $mock1.Log } else { @() }
$caUsed1 = $calls1 | Where-Object { $_ -match '^containerapp (update|create)' }
if ($proc1.ExitCode -ne 0 -and -not $caUsed1) {
    Pass-Test "deploy.ps1: exits non-zero and skips containerapp on acr build failure"
} else {
    $why = if ($proc1.ExitCode -eq 0) { "exit code was 0" } else { "containerapp was called after failed build" }
    Fail-Test "deploy.ps1: exits non-zero and skips containerapp on acr build failure  ($why)"
}
Remove-Item $mock1.Dir -Recurse -Force -ErrorAction SilentlyContinue

# ── Behavioural test 2: build context anchored to repo root ───────────────────
$mock2    = New-MockAzDir -AcrBuildExitCode 0
$fakeWdir = [IO.Path]::Combine([IO.Path]::GetTempPath(), [IO.Path]::GetRandomFileName())
$null     = New-Item -ItemType Directory -Path $fakeWdir
$cmd2     = "`$env:PATH='$($mock2.Dir);'+`$env:PATH; `$env:OPENAI_API_KEY='k'; Set-Location '$fakeWdir'; try { & '$DeployPs1' } catch {}; exit 0"
$proc2 = Start-Process powershell.exe `
    -ArgumentList @('-NoProfile', '-NonInteractive', '-Command', $cmd2) `
    -Wait -PassThru -NoNewWindow `
    -RedirectStandardOutput "$($mock2.Dir)\out.txt" `
    -RedirectStandardError  "$($mock2.Dir)\err.txt"
$calls2     = if (Test-Path $mock2.Log) { Get-Content $mock2.Log } else { @() }
$buildCall2 = $calls2 | Where-Object { $_ -match '^acr build' } | Select-Object -First 1
if ($buildCall2 -and ($buildCall2 -match [regex]::Escape($RepoRoot))) {
    Pass-Test "deploy.ps1: build context is anchored to repo root regardless of working directory"
} else {
    Fail-Test "deploy.ps1: build context is anchored to repo root regardless of working directory  (build call: $buildCall2)"
}
Remove-Item $mock2.Dir -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item $fakeWdir -Recurse -Force -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "Results: $Pass passed, $Fail failed"

if ($Errors.Count -gt 0) {
    Write-Host ""
    Write-Host "Failures:"
    $Errors | ForEach-Object { Write-Host "  - $_" }
    exit 1
}
