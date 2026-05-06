#!/bin/bash
# Upload frontend .env variables to AWS Parameter Store
# Usage: ./scripts/upload-frontend-env-to-ssm.sh [env_file] [environment]
#
# Examples:
#   ./scripts/upload-frontend-env-to-ssm.sh                          # Uses frontend/.env, env=dev
#   ./scripts/upload-frontend-env-to-ssm.sh frontend/.env.prod prod  # Uses custom file, env=prod

set -euo pipefail

# ─── Config ──────────────────────────────────────────────────────────────────
ENV_FILE="${1:-frontend/.env}"
ENVIRONMENT="${2:-dev}"
SSM_PREFIX="/eventfund/${ENVIRONMENT}/frontend"
AWS_REGION="${AWS_REGION:-ap-southeast-1}"

# ─── Colors ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info()    { echo -e "${BLUE}ℹ${NC}  $1"; }
log_success() { echo -e "${GREEN}✓${NC}  $1"; }
log_warning() { echo -e "${YELLOW}⚠${NC}  $1"; }
log_error()   { echo -e "${RED}✗${NC}  $1"; }

# ─── Validate ────────────────────────────────────────────────────────────────
if ! command -v aws &>/dev/null; then
  log_error "AWS CLI not found"
  exit 1
fi

if [ ! -f "$ENV_FILE" ]; then
  log_error "Env file not found: $ENV_FILE"
  echo "  Create it by copying: cp frontend/.env.example frontend/.env"
  exit 1
fi

# ─── Upload function ─────────────────────────────────────────────────────────
upload_param() {
  local key="$1"
  local value="$2"
  local ssm_path="${SSM_PREFIX}/${key}"

  # Check if parameter exists
  if aws ssm get-parameter --name "$ssm_path" --region "$AWS_REGION" &>/dev/null 2>&1; then
    # Update existing
    aws ssm put-parameter \
      --name "$ssm_path" \
      --value "$value" \
      --type "SecureString" \
      --overwrite \
      --region "$AWS_REGION" \
      --output text > /dev/null
    log_success "Updated: $ssm_path"
  else
    # Create new
    aws ssm put-parameter \
      --name "$ssm_path" \
      --value "$value" \
      --type "SecureString" \
      --region "$AWS_REGION" \
      --output text > /dev/null
    log_success "Created: $ssm_path"
  fi
}

# ─── Main ────────────────────────────────────────────────────────────────────
log_info "Uploading frontend env to AWS Parameter Store"
log_info "  File:        $ENV_FILE"
log_info "  Environment: $ENVIRONMENT"
log_info "  SSM Prefix:  $SSM_PREFIX"
log_info "  Region:      $AWS_REGION"
echo ""

COUNT=0
SKIP=0

while IFS= read -r line || [ -n "$line" ]; do
  # Skip empty lines and comments
  [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]] && continue

  # Parse KEY=VALUE
  if [[ "$line" =~ ^([A-Za-z_][A-Za-z0-9_]*)=(.*)$ ]]; then
    KEY="${BASH_REMATCH[1]}"
    VALUE="${BASH_REMATCH[2]}"

    # Remove surrounding quotes if present
    VALUE="${VALUE%\"}"
    VALUE="${VALUE#\"}"
    VALUE="${VALUE%\'}"
    VALUE="${VALUE#\'}"

    # Skip placeholder values
    if [[ "$VALUE" =~ ^"<".*">"$ ]] || [ -z "$VALUE" ]; then
      log_warning "Skipped (placeholder/empty): $KEY"
      ((SKIP++)) || true
      continue
    fi

    upload_param "$KEY" "$VALUE"
    ((COUNT++)) || true
  fi
done < "$ENV_FILE"

echo ""
log_success "Done! Uploaded: $COUNT | Skipped: $SKIP"
echo ""
echo "To verify:"
echo "  aws ssm get-parameters-by-path --path \"$SSM_PREFIX\" --with-decryption --region $AWS_REGION"
