# Deployment Guide - Kashaya Fabs Garment ERP

**Last Updated:** November 22, 2025
**Version:** 1.1.0

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Docker Deployment](#docker-deployment)
3. [Manual Deployment](#manual-deployment)
4. [PM2 Process Management](#pm2-process-management)
5. [Environment Configuration](#environment-configuration)
6. [Security Checklist](#security-checklist)
7. [Monitoring & Maintenance](#monitoring--maintenance)
8. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Software

- **Node.js:** v18 or higher
- **PostgreSQL:** v15 or higher
- **npm:** v9 or higher
- **Docker:** v20+ (for Docker deployment)
- **Docker Compose:** v2.0+ (for Docker deployment)
- **PM2:** v5+ (for manual deployment)

### Recommended

- **Nginx:** v1.24+ (reverse proxy)
- **Redis:** v7+ (caching - optional)
- **Linux Server:** Ubuntu 22.04 LTS or similar

---

## Docker Deployment

### Quick Start (Recommended for Production)

**1. Clone the repository:**
```bash
git clone https://github.com/varunsharda1987/garment-erp.git
cd garment-erp
```

**2. Create environment file:**
```bash
cp .env.docker.example .env.docker
```

**3. Edit .env.docker with production values:**
```bash
nano .env.docker
```

**Critical settings to change:**
- `DB_PASSWORD` - Strong database password
- `JWT_SECRET` - Generate using: `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`
- `FRONTEND_URL` - Your production domain
- `VITE_API_URL` - Your production backend API URL

**4. Build and start services:**
```bash
docker-compose --env-file .env.docker up -d
```

**5. Run database migrations:**
```bash
docker-compose exec backend npx prisma migrate deploy
```

**6. (Optional) Seed initial data:**
```bash
docker-compose exec backend npm run seed
```

**7. Verify deployment:**
```bash
# Check all services are running
docker-compose ps

# Check logs
docker-compose logs -f

# Test backend health
curl http://localhost:5000/health

# Test frontend health
curl http://localhost/health
```

### Docker Commands

```bash
# Start all services
docker-compose up -d

# Stop all services
docker-compose down

# View logs
docker-compose logs -f [service-name]

# Restart a service
docker-compose restart [service-name]

# Rebuild and restart
docker-compose up -d --build

# Scale backend instances
docker-compose up -d --scale backend=3

# Clean up everything (including volumes)
docker-compose down -v

# Enter a container shell
docker-compose exec backend sh
docker-compose exec postgres psql -U postgres -d garment_erp
```

### Docker Compose Services

| Service | Port | Description |
|---------|------|-------------|
| postgres | 5432 | PostgreSQL database |
| backend | 5000 | Node.js/Express API |
| frontend | 80 | Nginx serving React app |
| redis (optional) | 6379 | Redis cache |

---

## Manual Deployment

### 1. Server Setup

**Install Node.js:**
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

**Install PostgreSQL:**
```bash
sudo apt-get update
sudo apt-get install postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

**Install PM2:**
```bash
sudo npm install -g pm2
```

**Install Nginx:**
```bash
sudo apt-get install nginx
sudo systemctl start nginx
sudo systemctl enable nginx
```

### 2. Database Setup

```bash
# Switch to postgres user
sudo -u postgres psql

# Create database and user
CREATE DATABASE garment_erp;
CREATE USER erp_user WITH ENCRYPTED PASSWORD 'your_strong_password';
GRANT ALL PRIVILEGES ON DATABASE garment_erp TO erp_user;
\q
```

### 3. Application Setup

**Clone and install:**
```bash
git clone https://github.com/varunsharda1987/garment-erp.git
cd garment-erp

# Backend
cd backend
npm install --production
npm run build
cp .env.example .env
nano .env  # Configure environment variables

# Run migrations
npx prisma migrate deploy

# Frontend
cd ../frontend
npm install
cp .env.example .env
nano .env  # Configure environment variables
npm run build
```

### 4. Start with PM2

```bash
# From project root
pm2 start ecosystem.config.js --env production

# Save PM2 process list
pm2 save

# Setup PM2 startup script
pm2 startup
# Follow the instructions printed
```

### 5. Configure Nginx

Create `/etc/nginx/sites-available/garment-erp`:

```nginx
# Upstream backend
upstream backend {
    server localhost:5000;
}

# HTTP server (redirect to HTTPS)
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    # Let's Encrypt challenge
    location /.well-known/acert-challenge/ {
        root /var/www/html;
    }

    # Redirect all HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

# HTTPS server
server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    # SSL certificates (use Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Frontend (React app)
    root /var/www/garment-erp/frontend/dist;
    index index.html;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml text/javascript application/json application/javascript application/xml+rss application/rss+xml font/truetype font/opentype application/vnd.ms-fontobject image/svg+xml;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # API proxy
    location /api/ {
        proxy_pass http://backend/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Frontend routes (SPA)
    location / {
        try_files $uri $uri/ /index.html;

        # Cache static assets
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }

        # No cache for index.html
        location = /index.html {
            add_header Cache-Control "no-cache, no-store, must-revalidate";
            add_header Pragma "no-cache";
            add_header Expires "0";
        }
    }

    # Health checks
    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }
}
```

**Enable site:**
```bash
sudo ln -s /etc/nginx/sites-available/garment-erp /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 6. SSL Certificate (Let's Encrypt)

```bash
sudo apt-get install certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

---

## PM2 Process Management

### Common Commands

```bash
# Start application
pm2 start ecosystem.config.js --env production

# List all processes
pm2 list

# Monitor processes
pm2 monit

# View logs
pm2 logs
pm2 logs garment-erp-backend
pm2 logs garment-erp-backend --lines 100

# Restart
pm2 restart garment-erp-backend
pm2 restart all

# Stop
pm2 stop garment-erp-backend
pm2 stop all

# Delete from PM2
pm2 delete garment-erp-backend

# Reload (zero-downtime restart)
pm2 reload garment-erp-backend

# Save process list
pm2 save

# Resurrect processes after reboot
pm2 resurrect
```

### PM2 Monitoring

```bash
# Install PM2 monitoring dashboard (optional)
pm2 install pm2-logrotate

# Configure log rotation
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
```

---

## Environment Configuration

### Backend Environment Variables

```bash
# Database
DATABASE_URL="postgresql://erp_user:password@localhost:5432/garment_erp"

# JWT
JWT_SECRET="<64-char-random-string>"
JWT_EXPIRES_IN="7d"

# Server
PORT=5000
NODE_ENV="production"

# CORS
FRONTEND_URL="https://yourdomain.com"

# Debugging
DEBUG_TRANSFORM="false"

# AI (Optional)
AI_ENABLED="false"
AI_PROVIDER=""
AI_API_KEY=""
AI_MODEL=""
AI_BASE_URL=""
```

### Frontend Environment Variables

```bash
# API URL (as seen from browser)
VITE_API_URL=https://yourdomain.com/api
```

---

## Security Checklist

### Pre-Deployment

- [ ] **Change all default passwords**
  - Database password
  - Admin user password

- [ ] **Generate strong JWT_SECRET**
  ```bash
  node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
  ```

- [ ] **Configure firewall**
  ```bash
  sudo ufw allow 22/tcp    # SSH
  sudo ufw allow 80/tcp    # HTTP
  sudo ufw allow 443/tcp   # HTTPS
  sudo ufw enable
  ```

- [ ] **Restrict database access**
  - Only allow connections from localhost
  - Use strong authentication

- [ ] **Enable HTTPS**
  - Install SSL certificate
  - Force HTTPS redirect

- [ ] **Review CORS settings**
  - Only allow production domain

- [ ] **Disable debug logging**
  - Set `DEBUG_TRANSFORM="false"`
  - Set `NODE_ENV="production"`

### Post-Deployment

- [ ] **Setup automated backups**
- [ ] **Configure monitoring**
- [ ] **Setup error tracking** (Sentry, etc.)
- [ ] **Enable audit logging**
- [ ] **Regular security updates**
- [ ] **Review access logs**

---

## Monitoring & Maintenance

### Database Backups

**Automated daily backup script:**

```bash
#!/bin/bash
# /etc/cron.daily/garment-erp-backup

BACKUP_DIR="/var/backups/garment-erp"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/db_$DATE.sql.gz"

mkdir -p $BACKUP_DIR

pg_dump -U erp_user garment_erp | gzip > $BACKUP_FILE

# Keep only last 7 days
find $BACKUP_DIR -name "db_*.sql.gz" -mtime +7 -delete

echo "Backup completed: $BACKUP_FILE"
```

Make executable:
```bash
sudo chmod +x /etc/cron.daily/garment-erp-backup
```

### Log Rotation

PM2 handles log rotation automatically if pm2-logrotate is installed.

For nginx logs:
```bash
sudo nano /etc/logrotate.d/nginx
```

### Health Checks

**Script to check application health:**

```bash
#!/bin/bash
# /usr/local/bin/health-check.sh

# Check backend
BACKEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5000/health)

if [ $BACKEND_STATUS != "200" ]; then
    echo "Backend unhealthy! Status: $BACKEND_STATUS"
    pm2 restart garment-erp-backend
fi

# Check database
psql -U erp_user -d garment_erp -c "SELECT 1" > /dev/null 2>&1

if [ $? -ne 0 ]; then
    echo "Database unhealthy!"
    # Alert admin
fi
```

Add to crontab:
```bash
*/5 * * * * /usr/local/bin/health-check.sh
```

### Updates & Maintenance

**Update procedure:**

```bash
# 1. Backup database
pg_dump -U erp_user garment_erp > backup_$(date +%Y%m%d).sql

# 2. Pull latest code
git pull origin main

# 3. Update dependencies
cd backend && npm install && npm run build
cd ../frontend && npm install && npm run build

# 4. Run migrations
cd ../backend && npx prisma migrate deploy

# 5. Reload application
pm2 reload garment-erp-backend

# 6. Test
curl http://localhost:5000/health
```

---

## Troubleshooting

### Backend Won't Start

**Check logs:**
```bash
pm2 logs garment-erp-backend --lines 100
```

**Common issues:**
- Database connection failure (check DATABASE_URL)
- Port already in use (check PORT)
- Missing environment variables
- Prisma client not generated (`npx prisma generate`)

### Database Connection Issues

```bash
# Test database connection
psql -U erp_user -h localhost -d garment_erp

# Check PostgreSQL status
sudo systemctl status postgresql

# View PostgreSQL logs
sudo tail -f /var/log/postgresql/postgresql-15-main.log
```

### High Memory Usage

```bash
# Check memory usage
pm2 monit

# If exceeding limits, increase max_memory_restart in ecosystem.config.js
# Or scale down instances
```

### 502 Bad Gateway

- Backend not running (`pm2 list`)
- Wrong port in nginx config
- Firewall blocking connections

### Slow Performance

- Check database query performance
- Enable Redis caching
- Scale backend instances
- Optimize database indexes
- Enable nginx caching

---

## Production Architecture

```
Internet
   ↓
Nginx (Reverse Proxy + SSL)
   ↓
   ├── Frontend (Static Files)
   └── Backend API (Proxy to PM2)
        ↓
        PM2 Cluster (2+ instances)
        ↓
        PostgreSQL Database
        ↓
        Redis Cache (optional)
```

---

## Support & Resources

- **GitHub Repository:** https://github.com/varunsharda1987/garment-erp
- **Configuration Guide:** [CONFIGURATION_GUIDE.md](./CONFIGURATION_GUIDE.md)
- **Technical Debt:** [TECHNICAL_DEBT.md](./TECHNICAL_DEBT.md)

---

**Deployed By:** Kashaya Fabs IT Team
**Last Review:** November 22, 2025
**Next Review:** December 22, 2025
