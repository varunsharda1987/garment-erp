#!/bin/bash
# ============================================
# GARMENT ERP - SSL Setup Script
# ============================================
# Sets up Let's Encrypt SSL certificate using Certbot
# Usage: ./ssl-setup.sh yourdomain.com
# ============================================

set -e

DOMAIN=$1

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

if [ -z "$DOMAIN" ]; then
  echo -e "${RED}Usage: $0 yourdomain.com${NC}"
  echo "Example: $0 erp.yourcompany.com"
  exit 1
fi

echo "============================================"
echo "  SSL Setup for: $DOMAIN"
echo "============================================"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}Please run as root (use sudo)${NC}"
  exit 1
fi

echo -e "${GREEN}Step 1: Installing Certbot...${NC}"
apt-get update
apt-get install -y certbot

echo -e "${GREEN}Step 2: Stopping any running containers...${NC}"
cd /opt/garment-erp
docker-compose -f docker-compose.prod.yml down 2>/dev/null || true

echo -e "${GREEN}Step 3: Obtaining SSL certificate...${NC}"
certbot certonly --standalone -d $DOMAIN --non-interactive --agree-tos --email admin@$DOMAIN

echo -e "${GREEN}Step 4: Creating Nginx SSL configuration...${NC}"

# Create SSL nginx config
cat > /opt/garment-erp/nginx-ssl.conf << EOF
events {
    worker_connections 1024;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    # SSL Settings
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # Gzip
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/json;

    # Redirect HTTP to HTTPS
    server {
        listen 80;
        server_name $DOMAIN;
        return 301 https://\$host\$request_uri;
    }

    # HTTPS Server
    server {
        listen 443 ssl http2;
        server_name $DOMAIN;

        ssl_certificate /etc/letsencrypt/live/$DOMAIN/fullchain.pem;
        ssl_certificate_key /etc/letsencrypt/live/$DOMAIN/privkey.pem;

        # Security headers
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-XSS-Protection "1; mode=block" always;
        add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

        # Frontend (React)
        location / {
            proxy_pass http://frontend:80;
            proxy_http_version 1.1;
            proxy_set_header Upgrade \$http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host \$host;
            proxy_cache_bypass \$http_upgrade;
        }

        # Backend API
        location /api {
            proxy_pass http://backend:5000;
            proxy_http_version 1.1;
            proxy_set_header Upgrade \$http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host \$host;
            proxy_set_header X-Real-IP \$remote_addr;
            proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto \$scheme;
            proxy_cache_bypass \$http_upgrade;

            # Increase timeouts for long-running requests
            proxy_connect_timeout 60s;
            proxy_send_timeout 60s;
            proxy_read_timeout 60s;
        }

        # Health check
        location /health {
            proxy_pass http://backend:5000/health;
        }
    }
}
EOF

echo -e "${GREEN}Step 5: Creating SSL Docker Compose override...${NC}"

cat > /opt/garment-erp/docker-compose.ssl.yml << EOF
version: '3.8'

services:
  nginx:
    image: nginx:1.25-alpine
    container_name: garment-erp-nginx
    restart: always
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx-ssl.conf:/etc/nginx/nginx.conf:ro
      - /etc/letsencrypt:/etc/letsencrypt:ro
    depends_on:
      - frontend
      - backend
    networks:
      - garment-erp-network

  frontend:
    ports: []  # Remove port mapping, nginx handles it

networks:
  garment-erp-network:
    external: true
    name: garment-erp_garment-erp-network
EOF

echo -e "${GREEN}Step 6: Setting up auto-renewal...${NC}"
# Add cron job for certificate renewal
(crontab -l 2>/dev/null; echo "0 0 1 * * certbot renew --quiet && docker-compose -f /opt/garment-erp/docker-compose.prod.yml -f /opt/garment-erp/docker-compose.ssl.yml restart nginx") | crontab -

echo ""
echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}  SSL Setup Complete!${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""
echo "To start with SSL:"
echo "  docker-compose -f docker-compose.prod.yml -f docker-compose.ssl.yml up -d"
echo ""
echo "Your site will be available at:"
echo "  https://$DOMAIN"
echo ""
echo -e "${YELLOW}Certificate will auto-renew monthly.${NC}"
