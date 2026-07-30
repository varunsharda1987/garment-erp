# Production Deployment Guide

Complete guide to deploying Garment ERP to DigitalOcean with auto-deploy on push.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    PRODUCTION ARCHITECTURE                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   [GitHub Repository]                                                    │
│          │                                                               │
│          │ push triggers                                                 │
│          ▼                                                               │
│   [GitHub Actions CI/CD]                                                 │
│          │ auto-deploy                                                   │
│          ▼                                                               │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │           DigitalOcean Droplet ($24/month)                       │   │
│   │   ┌─────────────┐    ┌─────────────┐                            │   │
│   │   │   Nginx     │    │   Backend   │                            │   │
│   │   │   :443      │───►│   :5000     │────┐                       │   │
│   │   │   (HTTPS)   │    │   (Node)    │    │                       │   │
│   │   └─────────────┘    └──────┬──────┘    │                       │   │
│   └──────────────────────────────┼──────────┼───────────────────────┘   │
│                                  │          │                            │
│                    upload images │          │ database queries           │
│                                  ▼          ▼                            │
│   ┌────────────────────────────────┐  ┌────────────────────────────┐    │
│   │  DigitalOcean Spaces ($5/mo)   │  │ Managed PostgreSQL ($15/mo)│    │
│   │  ┌──────────────────────────┐  │  │  • Automatic daily backups │    │
│   │  │     CDN (Global Edge)    │  │  │  • Point-in-time recovery  │    │
│   │  │  • Style images          │  │  │  • Auto-failover           │    │
│   │  │  • Product photos        │  │  │  • 99.99% uptime SLA       │    │
│   │  └──────────────────────────┘  │  └────────────────────────────┘    │
│   └────────────────────────────────┘                                     │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

## Monthly Costs

| Service | Cost |
|---------|------|
| DigitalOcean Droplet (4GB RAM) | $24/month |
| Managed PostgreSQL | $15/month |
| Spaces + CDN (250GB) | $5/month |
| Kimi AI (typical usage) | ~$10/month |
| **Total** | **~$54/month** |

---

## Prerequisites

- GitHub account with repository access
- DigitalOcean account (create at [digitalocean.com](https://digitalocean.com))
- Domain name (optional but recommended)

---

## Step 1: Create DigitalOcean Resources (15 min)

### 1.1 Create Droplet (Server)

1. Go to [DigitalOcean Dashboard](https://cloud.digitalocean.com)
2. Click **Create** → **Droplets**
3. Choose:
   - **Region:** Bangalore (BLR1)
   - **Image:** Ubuntu 22.04 LTS
   - **Size:** Basic → $24/mo (4GB RAM, 2 vCPU, 80GB SSD)
   - **Authentication:** SSH Key (recommended) or Password
4. Click **Create Droplet**
5. Note the **IP address**

### 1.2 Create Managed PostgreSQL

1. Click **Create** → **Databases**
2. Choose:
   - **Engine:** PostgreSQL 15
   - **Region:** Bangalore (BLR1)
   - **Size:** $15/mo (1GB RAM)
   - **Database Name:** `garment_erp`
3. Click **Create Database Cluster**
4. Note the **Connection String** (DATABASE_URL)

### 1.3 Create Spaces Bucket

1. Click **Create** → **Spaces Object Storage**
2. Choose:
   - **Region:** Bangalore (BLR1)
   - **Name:** `garment-erp-uploads`
   - **CDN:** Enable
3. Click **Create Space**
4. Go to **Settings** → **CORS Configurations** → Add:
   ```json
   {
     "Origin": ["*"],
     "AllowedMethods": ["GET", "PUT"],
     "AllowedHeaders": ["*"],
     "MaxAgeSeconds": 3000
   }
   ```
5. Go to **API** → **Spaces Keys** → Generate New Key
6. Note the **Access Key** and **Secret Key**

---

## Step 2: Server Setup (20 min)

SSH into your server:

```bash
ssh root@YOUR_SERVER_IP
```

Run the setup script:

```bash
curl -sSL https://raw.githubusercontent.com/YOUR_REPO/main/scripts/deployment/server-setup.sh | bash
```

Or manually:

```bash
# Update system
apt-get update && apt-get upgrade -y

# Install Docker
curl -fsSL https://get.docker.com | sh

# Install Docker Compose
apt-get install -y docker-compose-plugin

# Create project directory
mkdir -p /opt/garment-erp
cd /opt/garment-erp

# Clone repository
git clone https://github.com/YOUR_USERNAME/garment-erp.git .
```

---

## Step 3: Configure Environment (10 min)

Copy and edit the environment file:

```bash
cp .env.production.example .env
nano .env
```

Fill in the values:

```env
# Database (from DigitalOcean dashboard)
DATABASE_URL=postgresql://doadmin:PASSWORD@db-xxxxx.db.ondigitalocean.com:25060/garment_erp?sslmode=require

# Generate with: openssl rand -hex 32
JWT_SECRET=your-64-char-random-string

# Your domain
FRONTEND_URL=https://erp.yourcompany.com
VITE_API_URL=https://erp.yourcompany.com/api

# Spaces (from DigitalOcean dashboard)
STORAGE_PROVIDER=spaces
DO_SPACES_ENDPOINT=blr1.digitaloceanspaces.com
DO_SPACES_BUCKET=garment-erp-uploads
DO_SPACES_REGION=blr1
DO_SPACES_KEY=your-spaces-key
DO_SPACES_SECRET=your-spaces-secret
DO_SPACES_CDN_URL=https://garment-erp-uploads.blr1.cdn.digitaloceanspaces.com

# AI (from https://platform.moonshot.cn)
AI_ENABLED=true
AI_PROVIDER=kimi
AI_API_KEY=your-kimi-api-key
AI_MODEL=moonshot-v1-32k
```

---

## Step 4: First Deployment (5 min)

```bash
cd /opt/garment-erp

# Build and start containers
docker-compose -f docker-compose.prod.yml up -d --build

# Run database migrations
docker-compose -f docker-compose.prod.yml exec backend npx prisma migrate deploy

# Check status
docker-compose -f docker-compose.prod.yml ps
```

Verify at `http://YOUR_SERVER_IP`

---

## Step 5: SSL Setup (5 min)

Point your domain to the server IP (A record in DNS settings).

Run SSL setup:

```bash
./scripts/deployment/ssl-setup.sh erp.yourcompany.com
```

Then restart with SSL:

```bash
docker-compose -f docker-compose.prod.yml -f docker-compose.ssl.yml up -d
```

Your site is now at `https://erp.yourcompany.com`

---

## Step 6: GitHub Actions Setup (10 min)

### 6.1 Add GitHub Secrets

Go to your GitHub repository → **Settings** → **Secrets and variables** → **Actions**

Add these secrets:

| Secret Name | Value |
|-------------|-------|
| `SERVER_HOST` | Your server IP address |
| `SERVER_USER` | `root` (or your deploy user) |
| `SERVER_SSH_KEY` | Your SSH private key |
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Your JWT secret |
| `FRONTEND_URL` | `https://erp.yourcompany.com` |
| `VITE_API_URL` | `https://erp.yourcompany.com/api` |
| `DO_SPACES_ENDPOINT` | `blr1.digitaloceanspaces.com` |
| `DO_SPACES_BUCKET` | `garment-erp-uploads` |
| `DO_SPACES_REGION` | `blr1` |
| `DO_SPACES_KEY` | Your Spaces access key |
| `DO_SPACES_SECRET` | Your Spaces secret key |
| `DO_SPACES_CDN_URL` | `https://garment-erp-uploads.blr1.cdn.digitaloceanspaces.com` |
| `AI_PROVIDER` | `kimi` |
| `AI_API_KEY` | Your Kimi API key |
| `AI_MODEL` | `moonshot-v1-32k` |

### 6.2 Generate SSH Key (if needed)

```bash
# On your local machine
ssh-keygen -t ed25519 -C "github-actions"

# Copy public key to server
ssh-copy-id -i ~/.ssh/id_ed25519.pub root@YOUR_SERVER_IP

# Copy private key content to GitHub secret
cat ~/.ssh/id_ed25519
```

### 6.3 Test Deployment

Push a change to the `main` branch:

```bash
git add .
git commit -m "Test deployment"
git push origin main
```

Check **Actions** tab in GitHub to see the deployment running.

---

## Step 7: Image Migration (Optional)

If you have existing images to migrate:

```bash
cd /opt/garment-erp
npx ts-node scripts/deployment/migrate-images-to-spaces.ts
```

---

## Daily Workflow

After setup, your workflow is:

1. **Develop locally**
   ```bash
   npm run dev  # or start-both.bat
   ```

2. **Commit and push**
   ```bash
   git add .
   git commit -m "Add new feature"
   git push origin main
   ```

3. **Auto-deploy** - GitHub Actions automatically deploys to server

4. **Verify** - Check `https://erp.yourcompany.com`

---

## Monitoring & Maintenance

### View Logs

```bash
docker-compose -f docker-compose.prod.yml logs -f backend
docker-compose -f docker-compose.prod.yml logs -f frontend
```

### Restart Services

```bash
docker-compose -f docker-compose.prod.yml restart
```

### Manual Backup

```bash
./scripts/deployment/backup.sh
```

### Update Application

If CI/CD fails, manually update:

```bash
cd /opt/garment-erp
git pull origin main
docker-compose -f docker-compose.prod.yml up -d --build
docker-compose -f docker-compose.prod.yml exec backend npx prisma migrate deploy
```

---

## Troubleshooting

### Container not starting

```bash
docker-compose -f docker-compose.prod.yml logs backend
```

### Database connection issues

- Check DATABASE_URL has `?sslmode=require`
- Verify server IP is in database trusted sources

### Images not loading

- Check CDN URL is correct
- Verify CORS settings in Spaces

### SSL certificate issues

```bash
certbot renew --force-renewal
docker-compose -f docker-compose.prod.yml restart nginx
```

---

## Security Checklist

- [x] JWT_SECRET is unique (64+ chars)
- [x] Database uses SSL (`sslmode=require`)
- [x] Firewall only allows 22, 80, 443
- [x] SSH uses key authentication
- [x] All API keys are valid
- [x] HTTPS enabled with Let's Encrypt
- [x] Database backups configured

---

## Support

For issues:
1. Check logs: `docker-compose logs`
2. Check GitHub Actions run status
3. Report at: https://github.com/YOUR_REPO/issues
