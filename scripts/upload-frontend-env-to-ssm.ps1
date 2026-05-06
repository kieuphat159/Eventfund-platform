# Upload frontend .env variables to AWS Parameter Store
# Usage: .\scripts\upload-frontend-env-to-ssm.ps1 [EnvFile] [Environment]
#
# Examples:
#   .\scripts\upload-frontend-env-to-ssm.ps1                              # Uses frontend/.env, env=dev
#   .\scripts\upload-frontend-env-to-ssm.ps1 frontend\.env.prod prod      # Uses custom file, env=prod

param(
    [string]$EnvFile     = "frontend\.env",
    [string]$Environment = "dev"
)

$ErrorActionPreference = "Stop"

# ─── Config ──────────────────────────────────────────────────────────────────
$SSM_PREFIX = "/eventfund/$Environment/frontend"
$AWS_REGION = if ($env:AWS_REGION) { $env:AWS_REGION } else { "ap-southeast-1" }

# ─── Logging helpers ─────────────────────────────────────────────────────────
function Log-Info    { param($msg) Write-Host "i  $msg" -ForegroundColor Cyan }
function Log-Success { param($msg) Write-Host "v  $msg" -ForegroundColor Green }
function Log-Warning { param($msg) Write-Host "!  $msg" -ForegroundColor Yellow }
function Log-Error   { param($msg) Write-Host "x  $msg" -ForegroundColor Red }

# ─── Validate ────────────────────────────────────────────────────────────────
if (-not (Get-Command aws -ErrorAction SilentlyContinue)) {
    Log-Error "AWS CLI not found. Install from https://aws.amazon.com/cli/"
    exit 1
}

if (-not (Test-Path $EnvFile)) {
    Log-Error "Env file not found: $EnvFile"
    Write-Host "  Create it by copying: copy frontend\.env.example frontend\.env"
    exit 1
}

# ─── Upload function ─────────────────────────────────────────────────────────
function Upload-Param {
    param([string]$Key, [string]$Value)

    $ssmPath = "$SSM_PREFIX/$Key"

    aws ssm put-parameter `
        --name $ssmPath `
        --value $Value `
        --type "SecureString" `
        --overwrite `
        --region $AWS_REGION `
        --output text 2>&1 | Out-Null

    Log-Success "Uploaded: $ssmPath"
}

# ─── Main ────────────────────────────────────────────────────────────────────
Log-Info "Uploading frontend env to AWS Parameter Store"
Log-Info "  File:        $EnvFile"
Log-Info "  Environment: $Environment"
Log-Info "  SSM Prefix:  $SSM_PREFIX"
Log-Info "  Region:      $AWS_REGION"
Write-Host ""

$count = 0
$skip  = 0

foreach ($line in Get-Content $EnvFile) {
    # Skip empty lines and comments
    if ([string]::IsNullOrWhiteSpace($line) -or $line -match '^\s*#') { continue }

    # Parse KEY=VALUE
    if ($line -match '^([A-Za-z_][A-Za-z0-9_]*)=(.*)$') {
        $key   = $Matches[1]
        $value = $Matches[2]

        # Remove surrounding quotes
        $value = $value -replace '^"(.*)"$', '$1'
        $value = $value -replace "^'(.*)'$", '$1'

        # Skip placeholder or empty values
        if ([string]::IsNullOrWhiteSpace($value) -or $value -match '^<.*>$') {
            Log-Warning "Skipped (placeholder/empty): $key"
            $skip++
            continue
        }

        Upload-Param -Key $key -Value $value
        $count++
    }
}

Write-Host ""
Log-Success "Done! Uploaded: $count | Skipped: $skip"
Write-Host ""
Write-Host "To verify:"
Write-Host "  aws ssm get-parameters-by-path --path `"$SSM_PREFIX`" --with-decryption --region $AWS_REGION"
