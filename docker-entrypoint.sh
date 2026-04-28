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
#   /eventfund/{ENV}/{PARAMETER_NAME}
#   Example: /eventfund/dev/MONGO_URI

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
    PARAM_PATH="/eventfund/${ENV}"

    echo "📥 Fetching all parameters from: $PARAM_PATH"

    # Create temp env file
    TEMP_ENV="/tmp/.env.aws"
    rm -f "$TEMP_ENV"

    # Get all parameters and write to temp file
    aws ssm get-parameters-by-path \
        --path "$PARAM_PATH" \
        --recursive \
        --with-decryption \
        --region "$AWS_REGION" \
        --query 'Parameters[*].[Name,Value]' \
        --output json 2>/dev/null | \
    jq -r '.[] | @tsv' | while IFS=$'\t' read -r name value; do
        # Extract parameter name from path
        PARAM_NAME=$(echo "$name" | sed "s|^$PARAM_PATH/||")

        if [ -n "$PARAM_NAME" ] && [ -n "$value" ]; then
            # Write to temp file
            echo "$PARAM_NAME=\"$value\"" >> "$TEMP_ENV"
            echo "✅ Loaded: $PARAM_NAME"
        fi
    done

    # Source the temp file to export all variables
    if [ -f "$TEMP_ENV" ]; then
        set -a
        . "$TEMP_ENV"
        set +a
        rm -f "$TEMP_ENV"
    fi

    echo "✅ Environment variables loaded from Parameter Store"
else
    echo "ℹ️  Using local environment variables (USE_AWS_PARAMS not set to 'true')"
fi

# Execute the main command
exec "$@"
