# Garment ERP - Disaster Recovery Guide

This guide covers how to recover from various disaster scenarios.

---

## Recovery Scenarios

| Scenario | Recovery Time | Data Loss |
|----------|---------------|-----------|
| Container crash | 5 minutes | None |
| Synology reboot | 10 minutes | None |
| Database corruption | 30 minutes | Up to 6 hours |
| Complete Synology failure | 2-4 hours | Up to 24 hours |
| Office disaster (fire/flood) | 1-2 days | Up to 1 week |

---

## Scenario 1: Container Crashed

**Symptoms:** ERP not accessible, some containers showing as "stopped"

**Recovery:**
```bash
# Via SSH
ssh admin@SYNOLOGY_IP
cd /volume2/docker/garment-erp

# Check status
sudo docker-compose ps

# Restart all containers
sudo docker-compose restart

# If that doesn't work, full rebuild
sudo docker-compose down
sudo docker-compose up -d --build
```

**Via Container Manager:**
1. Open Container Manager
2. Go to Project → garment-erp
3. Click Stop
4. Click Start

---

## Scenario 2: Database Corruption

**Symptoms:** ERP shows errors, data appears missing or corrupted

**Recovery:**

### Step 1: Stop the ERP
```bash
sudo docker-compose stop backend
```

### Step 2: Find available backups
```bash
/volume2/docker/garment-erp/scripts/restore-database.sh
```

This will list all available backups:
- Daily backups (last 7 days)
- Weekly backups (last 4 weeks)
- Monthly backups (last 12 months)

### Step 3: Restore from backup
```bash
# Replace with your chosen backup file
/volume2/docker/garment-erp/scripts/restore-database.sh /volume2/docker/garment-erp/backups/daily/garment_erp_2024-01-15_02-00-00.sql.gz
```

### Step 4: Verify recovery
```bash
sudo docker-compose start backend
# Test ERP in browser
```

---

## Scenario 3: Synology NAS Failure

**Symptoms:** Synology not turning on, disk failure warning, NAS unresponsive

### If Single Disk Failure (RAID Protected):
1. Synology will show degraded status
2. Replace failed disk with identical model
3. Synology will auto-rebuild (may take 24-48 hours)
4. **ERP continues to work** during rebuild

### If Complete NAS Failure:

**You'll need:**
- New Synology NAS (same or compatible model)
- Or any Ubuntu/Linux server

**Recovery Steps:**

#### Step 1: Set up new server
```bash
# Install Docker
curl -fsSL https://get.docker.com | sh

# Install Docker Compose
sudo apt install docker-compose-plugin
```

#### Step 2: Restore from cloud backup (if configured)
```bash
# Download latest backup from Backblaze B2
b2 download-file-by-name YOUR_BUCKET backups/daily/latest.sql.gz ./backup.sql.gz
```

#### Step 3: Deploy fresh ERP
```bash
# Clone or copy project files
mkdir -p /opt/garment-erp
cd /opt/garment-erp

# Copy docker-compose.yml and .env
# Start containers
docker compose up -d

# Restore database
./scripts/restore-database.sh backup.sql.gz
```

#### Step 4: Restore uploaded files
- Style images
- Generated PDFs
- Other uploads

These should also be backed up to cloud storage.

---

## Scenario 4: Complete Office Disaster

**Symptoms:** Office inaccessible, all local equipment lost

### Prerequisites for this recovery:
- Cloud backup enabled (Backblaze B2)
- Configuration files backed up
- This recovery guide accessible

### Recovery Steps:

#### Step 1: Acquire new hardware
- Any computer/server that can run Docker
- Or cloud VPS (DigitalOcean, Hetzner, etc.)

#### Step 2: Install Docker
```bash
curl -fsSL https://get.docker.com | sh
```

#### Step 3: Download backups from cloud
```bash
# Install Backblaze CLI
pip install b2

# Authenticate
b2 authorize-account YOUR_KEY_ID YOUR_APP_KEY

# Download latest database backup
b2 download-file-by-name YOUR_BUCKET backups/daily/latest.sql.gz ./backup.sql.gz

# Download uploaded files
b2 sync b2://YOUR_BUCKET/uploads ./uploads
```

#### Step 4: Deploy ERP
```bash
# Get deployment files (from GitHub or backup)
git clone YOUR_REPO_URL
cd garment-erp/deployment/synology

# Configure environment
cp env.example .env
nano .env  # Update with your settings

# Start containers
docker compose up -d

# Restore database
./scripts/restore-database.sh backup.sql.gz
```

#### Step 5: Update DNS/Access
- Update Tailscale to point to new server
- Or configure new static IP

---

## Backup Verification Checklist

Run monthly to ensure backups are working:

### 1. Verify backup files exist
```bash
ls -la /volume2/docker/garment-erp/backups/daily/
ls -la /volume2/docker/garment-erp/backups/weekly/
ls -la /volume2/docker/garment-erp/backups/monthly/
```

### 2. Verify backup file size
```bash
# Should be > 1MB for active database
du -h /volume2/docker/garment-erp/backups/daily/*.sql.gz | tail -5
```

### 3. Test restore to temp database
```bash
# Create test database
sudo docker exec garment-erp-db psql -U garment_user -c "CREATE DATABASE test_restore;" postgres

# Restore latest backup
LATEST=$(ls -t /volume2/docker/garment-erp/backups/daily/*.sql.gz | head -1)
gunzip -c "$LATEST" | sudo docker exec -i garment-erp-db psql -U garment_user -d test_restore

# Verify data
sudo docker exec garment-erp-db psql -U garment_user -d test_restore -c "SELECT COUNT(*) FROM styles;"

# Clean up
sudo docker exec garment-erp-db psql -U garment_user -c "DROP DATABASE test_restore;" postgres
```

### 4. Verify cloud backup (if configured)
```bash
b2 ls YOUR_BUCKET backups/daily/ | tail -5
```

---

## Emergency Contacts

| Role | Name | Phone | Email |
|------|------|-------|-------|
| IT Support | | | |
| Software Developer | | | |
| Synology Support | | 1800-XXX-XXXX | |
| Management | | | |

---

## Recovery Time Objectives (RTO)

| Scenario | Target RTO | Actual RTO |
|----------|------------|------------|
| Container restart | 5 min | |
| Database restore | 30 min | |
| Full system restore | 4 hours | |
| Cloud-based restore | 8 hours | |

---

## Recovery Point Objectives (RPO)

| Data Type | Backup Frequency | Max Data Loss |
|-----------|------------------|---------------|
| Database | Every 6 hours | 6 hours |
| Uploaded files | Daily | 24 hours |
| Configuration | On change | None (in git) |

---

## Post-Recovery Checklist

After any recovery:

- [ ] Verify ERP is accessible
- [ ] Login and check recent data
- [ ] Verify style images are showing
- [ ] Create a test order
- [ ] Generate a test invoice
- [ ] Verify reports are working
- [ ] Check that backups are running
- [ ] Notify users of any data loss
- [ ] Document what happened
- [ ] Update this guide if needed

---

## Important File Locations

| Item | Location |
|------|----------|
| Docker Compose | /volume2/docker/garment-erp/docker-compose.yml |
| Environment Config | /volume2/docker/garment-erp/.env |
| Database Backups | /volume2/docker/garment-erp/backups/ |
| Uploaded Files | /volume2/docker/garment-erp/backend/uploads/ |
| Application Logs | /volume2/docker/garment-erp/logs/ |
| Backup Scripts | /volume2/docker/garment-erp/scripts/ |

---

*Document Version: 1.0*
*Last Updated: _____________*
*Next Review: _____________*
