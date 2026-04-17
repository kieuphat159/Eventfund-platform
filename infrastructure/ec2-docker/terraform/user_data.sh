#!/bin/bash
set -e
exec > /var/log/user-data.log 2>&1

# System Update & Install
yum update -y
yum install -y docker git aws-cli unzip

systemctl start docker
systemctl enable docker

# Docker Compose v2
mkdir -p /usr/local/lib/docker/cli-plugins
curl -SL "https://github.com/docker/compose/releases/latest/download/docker-compose-linux-x86_64" \
  -o /usr/local/lib/docker/cli-plugins/docker-compose
chmod +x /usr/local/lib/docker/cli-plugins/docker-compose

# Docker Buildx
curl -SL "https://github.com/docker/buildx/releases/download/v0.19.3/buildx-v0.19.3.linux-amd64" \
  -o /usr/local/lib/docker/cli-plugins/docker-buildx
chmod +x /usr/local/lib/docker/cli-plugins/docker-buildx

# App directories
mkdir -p /app/frontend-dist
mkdir -p /app/repo

# Nginx config
cat > /app/nginx.conf << 'EOF'
server {
    listen 80;

    location / {
        root /usr/share/nginx/html;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://api:4000/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /health {
        proxy_pass http://api:4000/health;
    }

    location /api-docs {
        proxy_pass http://api:4000/api-docs;
    }
}
EOF

# Docker Compose
cat > /app/docker-compose.yml << EOF
services:
  api:
    build:
      context: /app/repo
      dockerfile: Dockerfile
      target: production
    environment:
      - USE_AWS_PARAMS=true
      - ENV=${environment}
      - AWS_REGION=${aws_region}
      - NODE_ENV=production
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:4000/health"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 40s
    volumes:
      - logs:/app/backend/logs

  frontend:
    image: nginx:alpine
    volumes:
      - /app/frontend-dist:/usr/share/nginx/html:ro
      - /app/nginx.conf:/etc/nginx/conf.d/default.conf:ro
    restart: unless-stopped
    depends_on:
      - api

  ngrok:
    image: ngrok/ngrok:latest
    command: http --domain=${ngrok_domain} frontend:80
    environment:
      - NGROK_AUTHTOKEN=${ngrok_authtoken}
    restart: unless-stopped
    depends_on:
      - frontend

volumes:
  logs:
EOF

echo "user_data complete - waiting for CI/CD to deploy app"

# Deploy script (CI/CD gọi cái này)
cat > /app/deploy.sh << 'DEPLOY'
#!/bin/bash
set -e
BRANCH=$${1:-${repo_branch}}
echo "Deploying branch: $BRANCH"

cd /app/repo
git fetch origin
git reset --hard origin/$BRANCH

cd /app
docker compose build api
docker compose up -d

echo "Deploy complete"
DEPLOY
chmod +x /app/deploy.sh
