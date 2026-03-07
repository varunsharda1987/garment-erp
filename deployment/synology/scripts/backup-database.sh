#!/bin/bash
#
# Garment ERP - Database Backup Script for Synology
#
# This script backs up the PostgreSQL database to local storage
# and optionally uploads to Backblaze B2 cloud storage.
#
# SETUP:
# 1. Save this file to /volume2/docker/garment-erp/scripts/
# 2. Make executable: chmod +x backup-database.sh
# 3. Set up Task Scheduler in Synology DSM:
#    - Control Panel → Task Scheduler → Create → Scheduled Task → User-defined script
#    - Schedule: Daily at 2:00 AM
#    - Command: /volume2/docker/garment-erp/scripts/backup-database.sh

set -e

# Configuration
BACKUP_DIR="/volume2/docker/garment-erp/backups"
CONTAINER_NAME="garment-erp-db"
DB_NAME="garment_erp"
DB_USER="garment_user"
RETENTION_DAYS=30

# Date formats
DATE=$(date +%Y-%m-%d)
DATETIME=$(date +%Y-%m-%d_%H-%M-%S)
TIMESTAMP=$(date +%s)

# Create backup directories
mkdir -p "$BACKUP_DIR/daily"
mkdir -p "$BACKUP_DIR/weekly"
mkdir -p "$BACKUP_DIR/monthly"

# Log file
LOG_FILE="$BACKUP_DIR/backup.log"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
    echo "$1"
}

log "=========================================="
log "Starting database backup: $DATETIME"

# Create daily backup
BACKUP_FILE="$BACKUP_DIR/daily/garment_erp_$DATETIME.sql.gz"

log "Creating backup: $BACKUP_FILE"

docker exec $CONTAINER_NAME pg_dump -U $DB_USER -d $DB_NAME | gzip > "$BACKUP_FILE"

if [ $? -eq 0 ]; then
    BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    log "Backup created successfully: $BACKUP_SIZE"
else
    log "ERROR: Backup failed!"
    # Send alert (configure your notification method)
    exit 1
fi

# Copy to weekly backup (every Sunday)
DAY_OF_WEEK=$(date +%u)
if [ "$DAY_OF_WEEK" -eq 7 ]; then
    cp "$BACKUP_FILE" "$BACKUP_DIR/weekly/garment_erp_week_$(date +%Y-%W).sql.gz"
    log "Weekly backup created"
fi

# Copy to monthly backup (1st of month)
DAY_OF_MONTH=$(date +%d)
if [ "$DAY_OF_MONTH" -eq 01 ]; then
    cp "$BACKUP_FILE" "$BACKUP_DIR/monthly/garment_erp_month_$(date +%Y-%m).sql.gz"
    log "Monthly backup created"
fi

# Clean up old daily backups (keep last 7 days)
log "Cleaning up old daily backups..."
find "$BACKUP_DIR/daily" -name "*.sql.gz" -mtime +7 -delete

# Clean up old weekly backups (keep last 4 weeks)
log "Cleaning up old weekly backups..."
find "$BACKUP_DIR/weekly" -name "*.sql.gz" -mtime +28 -delete

# Clean up old monthly backups (keep last 12 months)
log "Cleaning up old monthly backups..."
find "$BACKUP_DIR/monthly" -name "*.sql.gz" -mtime +365 -delete

# Calculate backup statistics
DAILY_COUNT=$(ls -1 "$BACKUP_DIR/daily"/*.sql.gz 2>/dev/null | wc -l)
WEEKLY_COUNT=$(ls -1 "$BACKUP_DIR/weekly"/*.sql.gz 2>/dev/null | wc -l)
MONTHLY_COUNT=$(ls -1 "$BACKUP_DIR/monthly"/*.sql.gz 2>/dev/null | wc -l)
TOTAL_SIZE=$(du -sh "$BACKUP_DIR" | cut -f1)

log "Backup statistics:"
log "  - Daily backups: $DAILY_COUNT"
log "  - Weekly backups: $WEEKLY_COUNT"
log "  - Monthly backups: $MONTHLY_COUNT"
log "  - Total size: $TOTAL_SIZE"

log "Backup completed successfully!"
log "=========================================="

# Optional: Upload to Backblaze B2 (uncomment if configured)
# if command -v b2 &> /dev/null; then
#     log "Uploading to Backblaze B2..."
#     b2 upload-file $B2_BUCKET_NAME "$BACKUP_FILE" "backups/daily/$(basename $BACKUP_FILE)"
#     log "Cloud upload completed"
# fi

exit 0
