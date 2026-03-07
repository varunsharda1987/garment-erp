# Garment ERP - Synology DS923+ Setup Guide

This guide walks you through deploying the Garment ERP on your Synology DS923+ NAS.

## Prerequisites

- Synology DS923+ with DSM 7.3+
- At least 8GB RAM (16GB recommended)
- Volume 2 with at least 50GB free space
- Container Manager package installed

---

## Phase 0: Free Up Volume 1 (Do This First!)

Your Volume 1 is at 92% - too full. Move data to Volume 2:

1. **Open File Station**
2. Navigate to `Z:\Approved Photoshoots`
3. Right-click → **Move to** → Select a folder on Volume 2
4. Repeat for video files and raw photos
5. **Goal:** Get Volume 1 below 70% (under 4.9 TB)

---

## Phase 1: Install RAM Upgrade

1. **Order RAM:** 16GB DDR4 ECC SODIMM (compatible with DS923+)
   - Synology brand or compatible
   - Amazon/local vendor: ~₹6,500

2. **Install:**
   - Shut down Synology
   - Open the case (bottom panel)
   - Insert RAM in empty slot
   - Close and power on
   - Verify in DSM: Control Panel → Info Center → 16GB shown

---

## Phase 2: Install Container Manager

1. Open **Package Center**
2. Search for **Container Manager**
3. Click **Install**
4. Wait for installation to complete

---

## Phase 3: Create Docker Folder

1. Open **Control Panel** → **Shared Folder**
2. Click **Create**
3. Settings:
   - Name: `docker`
   - Location: **Volume 2**
   - ✅ Enable data checksum
   - ❌ Disable encryption (for simplicity)
4. Click **Apply**

---

## Phase 4: Upload ERP Files

### Option A: Using File Station (Easiest)

1. Open **File Station**
2. Navigate to `/volume2/docker/`
3. Create folder: `garment-erp`
4. Upload these files from `deployment/synology/`:
   ```
   /volume2/docker/garment-erp/
   ├── docker-compose.yml
   ├── .env (copy from env.example and edit)
   ├── backend/
   │   └── Dockerfile
   ├── frontend/
   │   ├── Dockerfile
   │   └── nginx.conf
   ├── scripts/
   │   ├── backup-database.sh
   │   ├── restore-database.sh
   │   └── health-check.sh
   └── backups/
       ├── daily/
       ├── weekly/
       └── monthly/
   ```

### Option B: Using SSH

```bash
# Connect via SSH
ssh admin@your-synology-ip

# Create directory
sudo mkdir -p /volume2/docker/garment-erp

# Upload files using scp from your computer
scp -r deployment/synology/* admin@synology:/volume2/docker/garment-erp/
```

---

## Phase 5: Configure Environment

1. Copy `env.example` to `.env`:
   ```bash
   cp /volume2/docker/garment-erp/env.example /volume2/docker/garment-erp/.env
   ```

2. Edit `.env` file:
   ```
   # Change these values!
   DB_PASSWORD=your_strong_password_here
   JWT_SECRET=your_random_32_character_string
   SYNOLOGY_IP=192.168.1.100  # Your Synology's IP
   ```

3. **Generate a secure password:**
   - Use a password generator
   - Or run: `openssl rand -base64 24`

---

## Phase 6: Copy ERP Source Code

The Docker build needs the actual source code. Upload the entire project:

1. Create folders:
   ```
   /volume2/docker/garment-erp/backend/   ← Copy all backend code here
   /volume2/docker/garment-erp/frontend/  ← Copy all frontend code here
   ```

2. **Important:** Don't copy `node_modules` - Docker will install fresh

3. Structure should look like:
   ```
   /volume2/docker/garment-erp/
   ├── docker-compose.yml
   ├── .env
   ├── backend/
   │   ├── Dockerfile
   │   ├── package.json
   │   ├── prisma/
   │   └── src/
   └── frontend/
       ├── Dockerfile
       ├── nginx.conf
       ├── package.json
       └── src/
   ```

---

## Phase 7: Build and Start ERP

### Using Container Manager UI

1. Open **Container Manager**
2. Go to **Project** section
3. Click **Create**
4. Settings:
   - Name: `garment-erp`
   - Path: `/volume2/docker/garment-erp`
   - ✅ Set up web portal: Port 5173
5. Click **Build**
6. Wait for all containers to build and start (5-10 minutes first time)

### Using SSH (Alternative)

```bash
# Connect via SSH
ssh admin@your-synology-ip

# Navigate to project
cd /volume2/docker/garment-erp

# Build and start
sudo docker-compose up -d --build

# Check status
sudo docker-compose ps

# View logs
sudo docker-compose logs -f
```

---

## Phase 8: Initialize Database

First time only - run Prisma migrations:

```bash
# Enter backend container
sudo docker exec -it garment-erp-backend sh

# Run migrations
npx prisma migrate deploy

# (Optional) Seed initial data
npx prisma db seed

# Exit container
exit
```

---

## Phase 9: Access ERP

1. Open browser
2. Go to: `http://YOUR_SYNOLOGY_IP:5173`
3. You should see the Garment ERP login page!

**Default access:**
- URL: `http://192.168.1.100:5173` (replace with your IP)
- Create your first admin user through the app

---

## Phase 10: Set Up Automated Backups

1. Open **Control Panel** → **Task Scheduler**
2. Click **Create** → **Scheduled Task** → **User-defined script**
3. General:
   - Task: `ERP Database Backup`
   - User: `root`
4. Schedule:
   - Run daily at 2:00 AM
5. Task Settings:
   - Command:
     ```
     /volume2/docker/garment-erp/scripts/backup-database.sh
     ```
6. Click **OK**

---

## Phase 11: Set Up Health Monitoring

1. **Task Scheduler** → **Create** → **Scheduled Task**
2. General:
   - Task: `ERP Health Check`
   - User: `root`
3. Schedule:
   - Run every 5 minutes
4. Task Settings:
   - Command:
     ```
     /volume2/docker/garment-erp/scripts/health-check.sh
     ```

---

## Phase 12: Install Tailscale (Remote Access)

1. Open **Package Center**
2. Search for **Tailscale**
3. Click **Install**
4. After installation:
   - Open Tailscale from main menu
   - Click **Log in**
   - Authenticate with your Tailscale account
5. Install Tailscale on your phone/laptop from tailscale.com
6. Now you can access ERP from anywhere!

**Remote access URLs (via Tailscale):**
- ERP: `http://your-synology-tailscale-name:5173`
- DSM: `http://your-synology-tailscale-name:5000`

---

## Troubleshooting

### Containers won't start
```bash
# Check logs
sudo docker-compose logs

# Rebuild
sudo docker-compose down
sudo docker-compose up -d --build
```

### Database connection failed
```bash
# Check if database is running
sudo docker exec garment-erp-db pg_isready

# Check database logs
sudo docker logs garment-erp-db
```

### Out of memory
- Upgrade RAM to 16GB
- Or reduce container memory limits in docker-compose.yml

### Port already in use
Change ports in docker-compose.yml:
- 5173 → 5174 (frontend)
- 5000 → 5001 (backend)
- 5432 → 5433 (database)

---

## Quick Commands Reference

```bash
# Start all containers
cd /volume2/docker/garment-erp && sudo docker-compose up -d

# Stop all containers
cd /volume2/docker/garment-erp && sudo docker-compose down

# Restart all containers
cd /volume2/docker/garment-erp && sudo docker-compose restart

# View logs
cd /volume2/docker/garment-erp && sudo docker-compose logs -f

# Check container status
sudo docker ps

# Enter backend container
sudo docker exec -it garment-erp-backend sh

# Manual backup
/volume2/docker/garment-erp/scripts/backup-database.sh

# Restore from backup
/volume2/docker/garment-erp/scripts/restore-database.sh
```

---

## Support

If something goes wrong:
1. Check logs: `docker-compose logs`
2. Restart containers: `docker-compose restart`
3. Check health: `./scripts/health-check.sh`

For help, share the error logs from:
- `/volume2/docker/garment-erp/logs/`
- Container Manager → Logs
