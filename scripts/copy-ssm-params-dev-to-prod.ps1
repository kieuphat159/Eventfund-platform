# Copy SSM parameters from dev to prod environment
# Usage: .\scripts\copy-ssm-params-dev-to-prod.ps1
#
# This script:
# 1. Fetches all parameters from /eventfund/dev/backend
# 2. Copies them to /eventfund/prod/backend
# 3. Allows overriding specific values for prod
#
# Examples:
#   .\scripts\copy-ssm-params-dev-to-prod.ps1                    # Copy all dev params to prod
#   .\scripts\copy-ssm-params-dev-to-prod.ps1 -DryRun             # Show what would be copied (no changes)

param(
    [switch]$DryRun = $false
)

$ErrorActionPreference = "Stop"

# ─── Config ──────────────────────────────────────────────────────────────────
$DEV_PREFIX  = "/eventfund/dev/backend"
$PROD_PREFIX = "/eventfund/prod/backend"
$AWS_REGION  = if ($env:AWS_REGION) { $env:AWS_REGION } else { "ap-southeast-1" }

# Parameters that should be different in prod (key -> prod_value)
$PROD_OVERRIDES = @{
    "NODE_ENV"                    = "Prod"
    "LOG_LEVEL"                   = "warn"
    "RATE_LIMIT_MAX_REQUESTS"     = "50"
    "AUTO_EVENT_LIFECYCLE_ENABLED" = "true"
    "AUTO_EVENT_LIFECYCLE_INTERVAL_MS" = "60000"
    # Add more prod-specific overrides here as needed
}

# ─── Logging helpers ─────────────────────────────────────────────────────────
function Log-Info    { param($msg) Write-Host "i  $msg" -ForegroundColor Cyan }
function Log-Success { param($msg) Write-Host "v  $msg" -ForegroundColor Green }
function Log-Warning { param($msg) Write-Host "!  $msg" -ForegroundColor Yellow }
function Log-Error   { param($msg) Write-Host "x  $msg" -ForegroundColor Red }
function Log-DryRun  { param($msg) Write-Host "~  $msg" -ForegroundColor Gray }

# ─── Validate ────────────────────────────────────────────────────────────────
if (-not (Get-Command aws -ErrorAction SilentlyContinue)) {
    Log-Error "AWS CLI not found. Install from https://aws.amazon.com/cli/"
    exit 1
}

# ─── Fetch dev parameters ────────────────────────────────────────────────────
Log-Info "Fetching parameters from: $DEV_PREFIX"

$devParams = aws ssm get-parameters-by-path `
    --path $DEV_PREFIX `
    --recursive `
    --with-decryption `
    --region $AWS_REGION `
    --query 'Parameters[*].[Name,Value,Type]' `
    --output json | ConvertFrom-Json

if (-not $devParams) {
    Log-Error "No parameters found in $DEV_PREFIX"
    exit 1
}

Log-Success "Found $($devParams.Count) parameters in dev"
Write-Host ""

# ─── Copy to prod ────────────────────────────────────────────────────────────
$copied   = 0
$skipped  = 0
$overridden = 0

foreach ($param in $devParams) {
    $devPath  = $param[0]
    $devValue = $param[1]
    $paramType = $param[2]
    
    # Extract key from path: /eventfund/dev/backend/NODE_ENV -> NODE_ENV
    $key = $devPath -replace "^$([regex]::Escape($DEV_PREFIX))/", ""
    $prodPath = "$PROD_PREFIX/$key"
    
    # Check if this parameter should be overridden for prod
    $prodValue = $devValue
    if ($PROD_OVERRIDES.ContainsKey($key)) {
        $prodValue = $PROD_OVERRIDES[$key]
        $overridden++
        Log-Warning "Override: $key = $prodValue (was: $devValue)"
    }
    
    if ($DryRun) {
        Log-DryRun "Would copy: $key = $prodValue"
    } else {
        try {
            aws ssm put-parameter `
                --name $prodPath `
                --value $prodValue `
                --type $paramType `
                --overwrite `
                --region $AWS_REGION `
                --output text 2>&1 | Out-Null
            
            Log-Success "Copied: $key"
            $copied++
        } catch {
            Log-Error "Failed to copy $key : $_"
            $skipped++
        }
    }
}

Write-Host ""
if ($DryRun) {
    Log-DryRun "DRY RUN MODE - No changes made"
    Log-Info "Would copy: $copied parameters"
    Log-Info "Would override: $overridden parameters"
} else {
    Log-Success "Done! Copied: $copied | Overridden: $overridden | Skipped: $skipped"
}

Write-Host ""
Write-Host "To verify prod parameters:"
Write-Host "  aws ssm get-parameters-by-path --path `"$PROD_PREFIX`" --with-decryption --region $AWS_REGION"

Write-Host ""
Write-Host "To compare dev vs prod:"
Write-Host "  aws ssm get-parameters-by-path --path `"$DEV_PREFIX`" --with-decryption --region $AWS_REGION --query 'Parameters[*].Name' --output text | tr ' ' '\n' | sort"
Write-Host "  aws ssm get-parameters-by-path --path `"$PROD_PREFIX`" --with-decryption --region $AWS_REGION --query 'Parameters[*].Name' --output text | tr ' ' '\n' | sort"

