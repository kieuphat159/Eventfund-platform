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
    echo " Loading environment variables from AWS Parameter Store..."

    if [ -z "$ENV" ]; then
        echo " ERROR: ENV variable is not set"
        exit 1
    fi

    if [ -z "$AWS_REGION" ]; then
        echo " ERROR: AWS_REGION variable is not set"
        exit 1
    fi

    # Define parameter names to fetch
    PARAM_NAMES="
        PORT
        NODE_ENV
        MONGO_DEV_URI
        MONGO_PROD_URI
        JWT_SECRET
        JWT_EXPIRES_IN
        JWT_KEY_ID
        JWT_PRIVATE_KEY_PATH
        JWT_PUBLIC_KEY_PATH
        CLOUDINARY_DEV_NAME
        CLOUDINARY_DEV_KEY
        CLOUDINARY_DEV_SECRET
        CLOUDINARY_PROD_NAME
        CLOUDINARY_PROD_KEY
        CLOUDINARY_PROD_SECRET
        SIWE_DOMAIN
        SIWE_URI
        SIWE_CHAIN_ID
        FUND_ADDRESS
        TICKET_ADDRESS
        MARKETPLACE_ADDRESS
        RPC_URL
        SEPOLIA_RPC_URL
        ETHEREUM_RPC_URL
        BSC_RPC_URL
        POLYGON_RPC_URL
        LOG_LEVEL
        RATE_LIMIT_WINDOW_MS
        RATE_LIMIT_MAX_REQUESTS
        AUTH_RATE_LIMIT_MAX
        ALLOWED_ORIGINS
        REDIS_URL
        WEB3AUTH_CLIENT_ID
        WEB3AUTH_NETWORK
        WEB3AUTH_AUTH_CONNECTION_ID
        PIMLICO_API_KEY
        PIMLICO_BUNDLER_URL_BASE
        PIMLICO_PAYMASTER_URL_BASE
        PIMLICO_SPONSORSHIP_POLICY_ID
        BACKEND_SIGNER_PRIVATE_KEY
    "

    # Fetch and export each parameter
    for PARAM_NAME in $PARAM_NAMES; do
        PARAM_PATH="/eventfund/${ENV}/${PARAM_NAME}"

        # Fetch parameter value
        VALUE=$(aws ssm get-parameter \
            --name "$PARAM_PATH" \
            --with-decryption \
            --region "$AWS_REGION" \
            --query 'Parameter.Value' \
            --output text 2>/dev/null || echo "")

        if [ -n "$VALUE" ]; then
            export "$PARAM_NAME=$VALUE"
            echo " Loaded: $PARAM_NAME"
        else
            echo "  Warning: Parameter $PARAM_PATH not found"
        fi
    done

    echo " Environment variables loaded from Parameter Store"
else
    echo "ℹ  Using local environment variables (USE_AWS_PARAMS not set to 'true')"
fi

# Execute the main command
exec "$@"
