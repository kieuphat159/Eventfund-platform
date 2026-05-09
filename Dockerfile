# syntax=docker/dockerfile:1.4

# ─── Stage 1: Install production dependencies ────────────────────────────────
FROM node:20.19.0-alpine AS deps

WORKDIR /app

# Copy root package (local dep: eventfund-ticket-platform)
COPY package.json ./

# Copy backend package manifest
COPY backend/package.json backend/package-lock.json ./backend/

# Install production deps
WORKDIR /app/backend
RUN npm ci --omit=dev --ignore-scripts

WORKDIR /app

# ─── Stage 2: Production image ───────────────────────────────────────────────
FROM node:20.19.0-alpine AS production

# Install AWS CLI for Parameter Store access
RUN apk add --no-cache aws-cli curl jq

# Security: non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

# Copy root package.json (needed for local dep resolution)
COPY --chown=appuser:appgroup package.json ./

# Copy backend source
COPY --chown=appuser:appgroup backend/src ./backend/src

# Copy installed node_modules from deps stage
COPY --from=deps --chown=appuser:appgroup /app/backend/node_modules ./backend/node_modules

# Copy entrypoint script
COPY --chown=appuser:appgroup docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Create logs directory with correct permissions
RUN mkdir -p /app/backend/logs && chown -R appuser:appgroup /app/backend/logs

USER appuser

WORKDIR /app/backend

EXPOSE 4000

# Improved health check using Node.js
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:4000/health', (r) => { let d=''; r.on('data', c => d+=c); r.on('end', () => { try { const j=JSON.parse(d); process.exit(j.ok ? 0 : 1); } catch(e) { process.exit(1); }}); }).on('error', () => process.exit(1));"

STOPSIGNAL SIGTERM

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "src/server.js"]
