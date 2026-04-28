# AWS Parameter Store Manager - PowerShell version
# Usage: .\scripts\manage-aws-env.ps1 sync dev

param(
    [Parameter(Position=0)]
    [string]$Command = "help",

    [Parameter(Position=1)]
    [string]$Environment = "dev",

    [Parameter(Position=2)]
    [string]$Key = "",

    [Parameter(Position=3)]
    [string]$Value = ""
)

$AWS_REGION = if ($env:AWS_REGION) { $env:AWS_REGION } else { "ap-southeast-1" }
$ENV_FILE = "backend\.env"

function Sync-Env {
    param([string]$Env)

    Write-Host "Syncing $ENV_FILE to AWS Parameter Store ($Env)" -ForegroundColor Cyan
    Write-Host "All parameters will be SecureString (encrypted)" -ForegroundColor Gray
    Write-Host "Existing parameters will be overwritten" -ForegroundColor Gray
    Write-Host ""

    if (-not (Test-Path $ENV_FILE)) {
        Write-Host "Error: $ENV_FILE not found" -ForegroundColor Red
        exit 1
    }

    $successCount = 0
    $failCount = 0

    Get-Content $ENV_FILE | ForEach-Object {
        $line = $_.Trim()

        if ($line -eq "" -or $line.StartsWith("#")) {
            return
        }

        if ($line -match "^([^=]+)=(.*)$") {
            $k = $matches[1].Trim()
            $v = $matches[2].Trim()

            if ($k -eq "") {
                return
            }

            $paramName = "/eventfund/$Env/$k"

            Write-Host -NoNewline "Uploading $k ... "

            $result = aws ssm put-parameter --name $paramName --value $v --type "SecureString" --region $AWS_REGION --overwrite --no-cli-pager 2>&1

            if ($LASTEXITCODE -eq 0) {
                Write-Host "OK" -ForegroundColor Green
                $script:successCount++
            }
            else {
                Write-Host "FAILED" -ForegroundColor Red
                $script:failCount++
            }
        }
    }

    Write-Host ""
    Write-Host "Done! Success: $successCount, Failed: $failCount" -ForegroundColor Green
    Write-Host "Restart container on EC2: docker compose restart api" -ForegroundColor Yellow
}

function List-Params {
    param([string]$Env)

    Write-Host "Parameters for environment: $Env" -ForegroundColor Cyan
    aws ssm get-parameters-by-path --path "/eventfund/$Env" --recursive --with-decryption --region $AWS_REGION --query 'Parameters[*].[Name,Value]' --output table
}

function Update-Param {
    param([string]$Env, [string]$K, [string]$V)

    if ($Env -eq "" -or $K -eq "" -or $V -eq "") {
        Write-Host "Usage: .\scripts\manage-aws-env.ps1 update [env] [key] [value]" -ForegroundColor Yellow
        exit 1
    }

    aws ssm put-parameter --name "/eventfund/$Env/$K" --value $V --type "SecureString" --region $AWS_REGION --overwrite --no-cli-pager

    if ($LASTEXITCODE -eq 0) {
        Write-Host "Updated $K in $Env environment" -ForegroundColor Green
    }
}

switch ($Command) {
    "sync" { Sync-Env $Environment }
    "list" { List-Params $Environment }
    "update" { Update-Param $Environment $Key $Value }
    default {
        Write-Host "AWS Parameter Store Manager" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "Usage: .\scripts\manage-aws-env.ps1 [command] [args...]"
        Write-Host ""
        Write-Host "Commands:"
        Write-Host "  sync [env]               - Sync backend\.env to AWS (default: dev)"
        Write-Host "  list [env]               - List all parameters (default: dev)"
        Write-Host "  update [env] [key] [val] - Update single parameter"
        Write-Host ""
        Write-Host "Examples:"
        Write-Host "  .\scripts\manage-aws-env.ps1 sync dev"
        Write-Host "  .\scripts\manage-aws-env.ps1 list dev"
        Write-Host "  .\scripts\manage-aws-env.ps1 update dev PORT 4000"
    }
}
