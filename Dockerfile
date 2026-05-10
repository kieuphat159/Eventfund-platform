# syntax=docker/dockerfile:1.4

# ─── Stage 1: Install production dependencies ────────────────────────────────
FROM node:20.19.0-alpine AS deps

WORKDIR /app

# Copy root package (local dep: eventfund-ticket-platform)
COPY package.json ./

# Copy backend package manifest
COPY backend/package.json backend/package-lock.json ./backend/

# Install production deps with cache mount for faster builds
WORKDIR /app/backend
RUN --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev --ignore-scripts

WORKDIR /app

# ─── Stage 2: Production image ───────────────────────────────────────────────
FROM node:20.19.0-alpine AS production

# curl: health check
RUN apk add --no-cache curl

# Security: non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

# Copy root package.json (needed for local dep resolution)
COPY --chown=appuser:appgroup package.json ./

# Copy backend source
COPY --chown=appuser:appgroup backend/src ./backend/src

# Copy installed node_modules from deps stage
COPY --from=deps --chown=appuser:appgroup /app/backend/node_modules ./backend/node_modules

# Create logs directory with correct permissions
RUN mkdir -p /app/backend/logs && chown -R appuser:appgroup /app/backend/logs

USER appuser

WORKDIR /app/backend

# Port chỉ relevant cho api process, các process khác không dùng
# Healthcheck và CMD được định nghĩa per-process trong k8s deployment
EXPOSE 4000

STOPSIGNAL SIGTERM

CMD ["node", "src/server.js"]
