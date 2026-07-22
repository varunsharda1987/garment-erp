# Garment ERP Backup Scripts

## Quick Start - Google Drive Backup

```batch
# 1. First-time setup (run once)
scripts\setup-google-drive-backup.bat

# 2. Test a backup
scripts\backup-to-google-drive.bat

# 3. Schedule daily backups (run as Administrator)
scripts\setup-scheduled-backup-gdrive.bat
```

## Available Scripts

| Script | Purpose |
|--------|---------|
| `setup-google-drive-backup.bat` | Install rclone & configure Google Drive (run once) |
| `backup-to-google-drive.bat` | Backup database + project to Google Drive |
| `setup-scheduled-backup-gdrive.bat` | Schedule daily Google Drive backup |
| `restore-from-google-drive.bat` | Restore from a Google Drive backup |
| `backup-to-nas.bat` | Backup to Synology NAS |
| `backup-full.bat` | Backup to BOTH NAS and Google Drive |
| `restore-from-nas.bat` | Restore from NAS backup |

## What Gets Backed Up

- **Database**: Full PostgreSQL dump (`garment_erp` database)
- **Project Files**: All source code (frontend, backend, docs)
- **Excluded**: `node_modules`, `.git`, `dist`, `uploads/styles`, logs

## Backup Locations

| Destination | Path |
|-------------|------|
| Google Drive | `Backups/garment-erp/[YYYY-MM-DD_HH-MM]/` |
| Synology NAS | `\\synology\DATA STORAGE\Backups\garment-erp\` |
| Local (temp) | `F:\Relocated-from-C\garment-erp-backups\` |

## Retention

- **7 daily backups** kept (older ones auto-deleted)
- Both local and cloud cleanup runs automatically

## Scheduled Tasks

| Task Name | Time | Script |
|-----------|------|--------|
| `GarmentERP_GoogleDriveBackup` | Configurable | `backup-to-google-drive.bat` |
| `GarmentERP_DailyBackup` | 7:00 PM | `backup-to-nas.bat` |

## Disaster Recovery

```batch
# Restore from Google Drive
scripts\restore-from-google-drive.bat

# Restore from NAS
scripts\restore-from-nas.bat
```

## Troubleshooting

### rclone not found
Run `setup-google-drive-backup.bat` - it will install rclone automatically.

### Google Drive authentication expired
```batch
rclone config reconnect garment-erp-gdrive:
```

### Check backup status
```batch
# List backups on Google Drive
rclone lsf garment-erp-gdrive:Backups/garment-erp --dirs-only

# Check total backup size
rclone size garment-erp-gdrive:Backups/garment-erp
```

### Manual rclone configuration
```batch
rclone config
# Choose: n (new), name: garment-erp-gdrive, type: drive
```
