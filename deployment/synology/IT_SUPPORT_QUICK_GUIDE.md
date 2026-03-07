# Garment ERP - IT Support Quick Reference

**Server:** Synology DS923+ | **IP:** _______________ | **Location:** _______________

---

## 🚨 IF SOMETHING IS WRONG

### Step 1: Check if ERP is accessible
- Open browser → `http://SYNOLOGY_IP:5173`
- If page loads → ERP is working ✅
- If page doesn't load → Go to Step 2

### Step 2: Restart the ERP (90% of problems fixed)

**Option A: Using Synology Interface (Easiest)**
1. Open browser → `http://SYNOLOGY_IP:5000` (Synology DSM)
2. Login as admin
3. Open **Container Manager**
4. Go to **Project** → **garment-erp**
5. Click **Stop** → Wait 10 seconds → Click **Start**
6. Wait 2 minutes → Test ERP again

**Option B: Using SSH**
```bash
ssh admin@SYNOLOGY_IP
cd /volume2/docker/garment-erp
sudo docker-compose restart
```

### Step 3: If restart didn't work
1. Check logs in Container Manager → Project → garment-erp → Logs
2. Screenshot the error
3. Contact software support

---

## 📋 Daily Checks (5 minutes)

| Check | How | Expected |
|-------|-----|----------|
| ERP accessible | Open http://SYNOLOGY_IP:5173 | Login page shows |
| All containers running | Container Manager → Overview | 3 green containers |
| Disk space | Control Panel → Info | Volume 2 < 80% |
| Backup completed | File Station → docker/garment-erp/backups/daily | Today's file exists |

---

## 🔄 Common Tasks

### View ERP Logs
1. Container Manager → Project → garment-erp → Logs
2. Or via SSH: `sudo docker-compose logs -f`

### Manual Backup
```bash
ssh admin@SYNOLOGY_IP
/volume2/docker/garment-erp/scripts/backup-database.sh
```

### Check Backup Files
1. File Station → volume2 → docker → garment-erp → backups
2. Should see: daily/, weekly/, monthly/ folders
3. Today's backup should exist in daily/

---

## ⚡ Emergency Contacts

| Issue | Contact |
|-------|---------|
| Software bugs | _______________ |
| Hardware/Network | _______________ |
| Synology support | _______________ |

---

## 🔑 Important Information

| Item | Value |
|------|-------|
| Synology IP | |
| Synology Admin Password | (stored securely in ___) |
| ERP URL | http://SYNOLOGY_IP:5173 |
| DSM URL | http://SYNOLOGY_IP:5000 |
| Backup Location | /volume2/docker/garment-erp/backups |
| Tailscale Name | |

---

## 🛑 DO NOT DO (Without Permission)

- ❌ Delete any docker containers
- ❌ Delete backup files
- ❌ Change network settings
- ❌ Update DSM without scheduling downtime
- ❌ Run any commands you don't understand

---

## ✅ SAFE TO DO

- ✅ Restart ERP containers
- ✅ Check logs
- ✅ Run manual backup
- ✅ Restart Synology NAS (during off-hours)
- ✅ Check disk space

---

## 🔌 Power Failure Recovery

After power is restored:

1. **Synology should auto-start** (check UPS settings)
2. **Wait 5 minutes** for system to boot
3. **ERP auto-starts** with Synology (containers set to restart: always)
4. **Verify:** Open http://SYNOLOGY_IP:5173
5. **If not working:** Restart containers (see Step 2 above)

---

## 📊 System Specifications

| Component | Spec |
|-----------|------|
| Model | Synology DS923+ |
| CPU | AMD Ryzen R1600 |
| RAM | 16 GB |
| Storage | Volume 1: 7TB, Volume 2: 14TB |
| SSD Cache | 2x 500GB NVMe |
| UPS | Yes / No |

---

*Last updated: _______________*
*Guide version: 1.0*
