#!/bin/sh
set -e

# ─── Load environment variables from AWS Parameter Store ─────────────────────
# This script fetches secrets from AWS Systems Manager Parameter Store
# and exports them as environment variables for the Node.js application.
#
# Required environment variables:
#   - ENV: Environment name (dev, staging, prod)
#   - AWS_REGION: AWS region where parameters are stored
#   - AWS credentials (via IAM role, access keys, or profile)
#
# Parameter Store naming convention:
#   /eventfund/{ENV}/backend/{PARAMETER_NAME}
#   Example: /eventfund/dev/backend/MONGO_URI

if [ -n "$USE_AWS_PARAMS" ] && [ "$USE_AWS_PARAMS" = "true" ]; then
    echo "🔄 Loading environment variables from AWS Parameter Store..."

    if [ -z "$ENV" ]; then
        echo "❌ ERROR: ENV variable is not set"
        exit 1
    fi

    if [ -z "$AWS_REGION" ]; then
        echo "❌ ERROR: AWS_REGION variable is not set"
        exit 1
    fi

    # Fetch ALL parameters from AWS Parameter Store (no hardcoded list!)
    PARAM_PATH="/eventfund/${ENV}/backend"

    echo "📥 Fetching all parameters from: $PARAM_PATH"

    # Temp files
    TEMP_ENV="/tmp/.env.aws"
    TEMP_JSON="/tmp/.ssm.json"
    rm -f "$TEMP_ENV" "$TEMP_JSON"

    # Step 1: Fetch JSON to file (avoid pipe subshell bug in sh)
    aws ssm get-parameters-by-path \
        --path "$PARAM_PATH" \
        --recursive \
        --with-decryption \
        --region "$AWS_REGION" \
        --query 'Parameters[*].[Name,Value]' \
        --output json 2>/dev/null > "$TEMP_JSON"

    # Step 2: Parse JSON and write to env file (no pipe → runs in current shell)
    jq -r '.[] | @tsv' "$TEMP_JSON" > /tmp/.ssm.tsv
    rm -f "$TEMP_JSON"

    while IFS=$(printf '\t') read -r name value; do
        # Extract parameter name from path: /eventfund/dev/backend/MONGO_URI → MONGO_URI
        PARAM_NAME=$(echo "$name" | sed "s|^$PARAM_PATH/||")

        if [ -n "$PARAM_NAME" ] && [ -n "$value" ]; then
            echo "$PARAM_NAME=\"$value\"" >> "$TEMP_ENV"
            echo "✅ Loaded: $PARAM_NAME"
        fi
    done < /tmp/.ssm.tsv

    rm -f /tmp/.ssm.tsv

    # Step 3: Source the env file to export all variables into current shell
    if [ -f "$TEMP_ENV" ]; then
        set -a
        . "$TEMP_ENV"
        set +a
        rm -f "$TEMP_ENV"
        echo "✅ Environment variables loaded from Parameter Store"
    else
        echo "❌ ERROR: No parameters loaded from $PARAM_PATH"
        exit 1
    fi
else
    echo "ℹ️  Using local environment variables (USE_AWS_PARAMS not set to 'true')"
fi

# Execute the main command
exec "$@"
