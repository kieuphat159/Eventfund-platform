#!/bin/bash
# Upload backend .env variables to AWS Parameter Store
# Usage: ./scripts/upload-backend-env-to-ssm.sh [env_file] [environment]
#
# Examples:
#   ./scripts/upload-backend-env-to-ssm.sh                          # Uses backend/.env, env=dev
#   ./scripts/upload-backend-env-to-ssm.sh backend/.env.prod prod   # Uses custom file, env=prod

set -euo pipefail

# ─── Config ──────────────────────────────────────────────────────────────────
ENV_FILE="${1:-backend/.env}"
ENVIRONMENT="${2:-dev}"
SSM_PREFIX="/eventfund/${ENVIRONMENT}/backend"
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

# ─── Keys to skip (không sensitive, không cần lưu SSM) ───────────────────────
# Các key này là config thông thường, không phải secret
NON_SECRET_KEYS=(
  "PORT"
  "NODE_ENV"
  "LOG_LEVEL"
  "RATE_LIMIT_WINDOW_MS"
  "RATE_LIMIT_MAX_REQUESTS"
  "AUTH_RATE_LIMIT_MAX"
  "MIN_DEPOSIT_VND"
  "MAX_DEPOSIT_VND"
  "DEPOSIT_ORDER_EXPIRY_MINUTES"
  "EXCHANGE_RATE_CACHE_TTL"
  "EXCHANGE_RATE_FALLBACK_MAX_AGE"
  "AUTO_EVENT_LIFECYCLE_ENABLED"
  "AUTO_EVENT_LIFECYCLE_INTERVAL_MS"
  "AUTO_EVENT_LIFECYCLE_SCAN_LIMIT"
  "AUTO_TICKETING_DEFAULT_TYPE"
  "CHAIN_LOG_CHUNK_SIZE"
  "JWT_EXPIRES_IN"
  "SIWE_CHAIN_ID"
  "DELEGATED_SIG_CHAIN_ID"
  "DELEGATED_SIG_DOMAIN_NAME"
  "DELEGATED_SIG_DOMAIN_VERSION"
  "RELAYER_REQUIRE_CREATE_EVENT_SIGNATURE"
  "RELAYER_REQUIRE_ADMIN_STATUS_SIGNATURE"
  "PIMLICO_BUNDLER_URL_BASE"
  "PIMLICO_PAYMASTER_URL_BASE"
  "CONTRACTS_ARTIFACTS_DIR"
  "WEB3AUTH_NETWORK"
  "WEB3AUTH_AUTH_CONNECTION_ID"
)

is_non_secret() {
  local key="$1"
  for skip_key in "${NON_SECRET_KEYS[@]}"; do
    [[ "$key" == "$skip_key" ]] && return 0
  done
  return 1
}

# ─── Validate ────────────────────────────────────────────────────────────────
if ! command -v aws &>/dev/null; then
  log_error "AWS CLI not found"
  exit 1
fi

if [ ! -f "$ENV_FILE" ]; then
  log_error "Env file not found: $ENV_FILE"
  echo "  Create it by copying: cp backend/.env.example backend/.env"
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
log_info "Uploading backend env to AWS Parameter Store"
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

    # Skip non-secret keys
    if is_non_secret "$KEY"; then
      log_warning "Skipped (non-secret): $KEY"
      ((SKIP++)) || true
      continue
    fi

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
