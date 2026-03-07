# How to Update Files on Synology

## Option 1: Via File Station (Web UI)

1. Open DSM → File Station
2. Navigate to `docker/garment-erp/`
3. Right-click `docker-compose.yml` → Delete
4. Upload the new `docker-compose.yml` from your PC (`deployment/synology/docker-compose.yml`)
5. Navigate to `docker/garment-erp/frontend/`
6. Right-click `nginx.conf` → Delete
7. Upload the new `nginx.conf` from your PC (`deployment/synology/frontend/nginx.conf`)

## Option 2: Via SSH

If you can SSH into Synology:

```bash
# Connect to Synology
ssh admin@192.168.1.99

# Enter password when prompted
```

Then paste these commands one by one:

### Update docker-compose.yml:
```bash
cat > /volume1/docker/garment-erp/docker-compose.yml << 'COMPOSE_EOF'
# Garment ERP - Docker Compose for Synology DS923+
#
# INSTRUCTIONS:
# 1. docker shared folder already exists on Volume 1 ✅
# 2. Upload this file to /volume1/docker/garment-erp/
# 3. Open Container Manager → Project → Create
# 4. Select this docker-compose.yml file
# 5. Click "Build" and wait for containers to start
#
# Access ERP at: http://192.168.1.99:5174
#
# NOTE: With 4GB RAM, this may be slow. Consider RAM upgrade to 16GB.

services:
  # PostgreSQL Database (Required - uses ~200-400MB RAM)
  postgres:
    image: postgres:15-alpine
    container_name: garment-erp-db
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${DB_USER:-garment_user}
      POSTGRES_PASSWORD: ${DB_PASSWORD:-GarmentERP2024!}
      POSTGRES_DB: ${DB_NAME:-garment_erp}
      PGDATA: /var/lib/postgresql/data/pgdata
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./backups:/backups
    ports:
      - "5433:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U garment_user -d garment_erp"]
      interval: 10s
      timeout: 5s
      retries: 5
    deploy:
      resources:
        limits:
          memory: 512M
        reservations:
          memory: 256M
    networks:
      - erp-network

  # Backend API (Node.js + Express + Prisma - uses ~300-500MB RAM)
  # NOTE: No external port - nginx proxies /api to this container internally
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: garment-erp-backend
    restart: unless-stopped
    depends_on:
      postgres:
        condition: service_healthy
    environment:
      NODE_ENV: production
      PORT: 5000
      DATABASE_URL: postgresql://${DB_USER:-garment_user}:${DB_PASSWORD:-GarmentERP2024!}@postgres:5432/${DB_NAME:-garment_erp}?schema=public
      JWT_SECRET: ${JWT_SECRET:-garment_erp_jwt_secret_2024_synology}
      CORS_ORIGIN: http://192.168.1.99:5174
    volumes:
      - ./uploads:/app/uploads
      - ./logs:/app/logs
    # No ports exposed externally - nginx proxies API calls
    expose:
      - "5000"
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:5000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 60s
    deploy:
      resources:
        limits:
          memory: 768M
        reservations:
          memory: 256M
    networks:
      - erp-network

  # Frontend (Nginx serving React build - uses ~50-100MB RAM)
  # NOTE: Empty VITE_API_URL = use relative paths, nginx proxies /api to backend
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
      args:
        VITE_API_URL: ""
    container_name: garment-erp-frontend
    restart: unless-stopped
    depends_on:
      backend:
        condition: service_healthy
    ports:
      - "5174:80"
    deploy:
      resources:
        limits:
          memory: 128M
        reservations:
          memory: 64M
    networks:
      - erp-network

networks:
  erp-network:
    driver: bridge

volumes:
  postgres_data:
    driver: local
COMPOSE_EOF
echo "docker-compose.yml updated!"
```

### Update nginx.conf:
```bash
cat > /volume1/docker/garment-erp/frontend/nginx.conf << 'NGINX_EOF'
# Garment ERP Frontend - Complete Nginx Configuration
# This replaces /etc/nginx/nginx.conf entirely

user  nginx;
worker_processes  auto;

error_log  /var/log/nginx/error.log notice;
pid        /var/run/nginx.pid;

events {
    worker_connections  1024;
}

http {
    # MIME types - CRITICAL for CSS/JS to work
    include       /etc/nginx/mime.types;
    default_type  application/octet-stream;

    log_format  main  '$remote_addr - $remote_user [$time_local] "$request" '
                      '$status $body_bytes_sent "$http_referer" '
                      '"$http_user_agent" "$http_x_forwarded_for"';

    access_log  /var/log/nginx/access.log  main;

    sendfile        on;
    keepalive_timeout  65;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied expired no-cache no-store private auth;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml application/javascript application/json;

    server {
        listen 80;
        server_name localhost;
        root /usr/share/nginx/html;
        index index.html;

        # Security headers
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-XSS-Protection "1; mode=block" always;

        # Cache static assets
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }

        # Handle React Router (SPA)
        location / {
            try_files $uri $uri/ /index.html;
        }

        # API reverse proxy - forwards to backend container
        location /api/ {
            proxy_pass http://backend:5000/api/;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_cache_bypass $http_upgrade;
            proxy_connect_timeout 60s;
            proxy_send_timeout 60s;
            proxy_read_timeout 60s;
        }

        # Uploads proxy - serve files from backend
        location /uploads/ {
            proxy_pass http://backend:5000/uploads/;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
        }

        # Health check endpoint
        location /health {
            access_log off;
            return 200 "OK";
            add_header Content-Type text/plain;
        }
    }
}
NGINX_EOF
echo "nginx.conf updated!"
```

### Update Dockerfile (if nginx.conf structure changed):
```bash
cat > /volume1/docker/garment-erp/frontend/Dockerfile << 'DOCKERFILE_EOF'
# Garment ERP Frontend - Production Dockerfile
# Optimized for Synology DS923+ (AMD64 architecture)

# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build arguments for API URL
ARG VITE_API_URL=http://localhost:5000

# Set environment for build
ENV VITE_API_URL=$VITE_API_URL

# Build the frontend (skip TypeScript check, use Vite directly)
RUN npx vite build

# Production stage - Nginx
FROM nginx:alpine AS production

# Copy built files to nginx
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx configuration (full nginx.conf, not just server block)
COPY nginx.conf /etc/nginx/nginx.conf

# Expose port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost/ || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
DOCKERFILE_EOF
echo "Dockerfile updated!"
```

## After Updating Files

1. Go to Container Manager → Project
2. Select **garment-erp** project
3. Click **Action** → **Stop** (if running)
4. Click **Build** to rebuild with new configuration
5. Wait for all 3 containers to start

## Why This Fix Works

The original error was:
```
Error response from daemon: driver failed programming external connectivity on endpoint garment-erp-backend
```

This happens because Synology's Docker has issues with multiple port mappings.

**Solution**: Only expose one port (5174 for frontend). Nginx proxies API calls to backend internally via the Docker network - no external port mapping needed for backend.

```
Browser → http://192.168.1.99:5174 → Nginx (frontend)
                                      │
                                      ├── Static files (React app)
                                      └── /api/* → backend:5000 (internal Docker network)
```
