#!/bin/bash
#
# Garment ERP - Database Restore Script for Synology
#
# This script restores the PostgreSQL database from a backup file.
#
# USAGE:
#   ./restore-database.sh                     # Interactive - shows available backups
#   ./restore-database.sh backup_file.sql.gz  # Restore specific file

set -e

# Configuration
BACKUP_DIR="/volume2/docker/garment-erp/backups"
CONTAINER_NAME="garment-erp-db"
DB_NAME="garment_erp"
DB_USER="garment_user"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log() {
    echo -e "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

error() {
    echo -e "${RED}ERROR: $1${NC}"
    exit 1
}

success() {
    echo -e "${GREEN}$1${NC}"
}

warn() {
    echo -e "${YELLOW}WARNING: $1${NC}"
}

# Check if backup file is provided
if [ -z "$1" ]; then
    echo ""
    echo "Available backups:"
    echo "=================="
    echo ""
    echo "Daily backups:"
    ls -lh "$BACKUP_DIR/daily"/*.sql.gz 2>/dev/null | awk '{print "  " $9 " (" $5 ")"}'
    echo ""
    echo "Weekly backups:"
    ls -lh "$BACKUP_DIR/weekly"/*.sql.gz 2>/dev/null | awk '{print "  " $9 " (" $5 ")"}'
    echo ""
    echo "Monthly backups:"
    ls -lh "$BACKUP_DIR/monthly"/*.sql.gz 2>/dev/null | awk '{print "  " $9 " (" $5 ")"}'
    echo ""
    echo "Usage: $0 <backup_file.sql.gz>"
    echo ""
    exit 0
fi

BACKUP_FILE="$1"

# Check if file exists
if [ ! -f "$BACKUP_FILE" ]; then
    # Try with backup dir prefix
    if [ -f "$BACKUP_DIR/daily/$BACKUP_FILE" ]; then
        BACKUP_FILE="$BACKUP_DIR/daily/$BACKUP_FILE"
    elif [ -f "$BACKUP_DIR/weekly/$BACKUP_FILE" ]; then
        BACKUP_FILE="$BACKUP_DIR/weekly/$BACKUP_FILE"
    elif [ -f "$BACKUP_DIR/monthly/$BACKUP_FILE" ]; then
        BACKUP_FILE="$BACKUP_DIR/monthly/$BACKUP_FILE"
    else
        error "Backup file not found: $BACKUP_FILE"
    fi
fi

log "Backup file: $BACKUP_FILE"
BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
log "Backup size: $BACKUP_SIZE"

echo ""
warn "This will REPLACE all data in the database!"
warn "Current database content will be LOST!"
echo ""
read -p "Are you sure you want to continue? (type 'yes' to confirm): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    log "Restore cancelled by user"
    exit 0
fi

echo ""
log "Starting database restore..."

# Stop backend container to prevent writes
log "Stopping backend container..."
docker stop garment-erp-backend 2>/dev/null || true

# Wait a moment
sleep 2

# Drop and recreate database
log "Dropping existing database..."
docker exec $CONTAINER_NAME psql -U $DB_USER -c "DROP DATABASE IF EXISTS $DB_NAME WITH (FORCE);" postgres

log "Creating fresh database..."
docker exec $CONTAINER_NAME psql -U $DB_USER -c "CREATE DATABASE $DB_NAME;" postgres

# Restore from backup
log "Restoring from backup (this may take a few minutes)..."
gunzip -c "$BACKUP_FILE" | docker exec -i $CONTAINER_NAME psql -U $DB_USER -d $DB_NAME

if [ $? -eq 0 ]; then
    success "Database restored successfully!"
else
    error "Restore failed!"
fi

# Start backend container
log "Starting backend container..."
docker start garment-erp-backend

# Wait for backend to be ready
log "Waiting for backend to start..."
sleep 10

# Check if backend is healthy
if docker exec garment-erp-backend curl -s http://localhost:5000/api/health > /dev/null 2>&1; then
    success "Backend is running and healthy!"
else
    warn "Backend may still be starting. Check manually."
fi

echo ""
success "=========================================="
success "Restore completed!"
success "=========================================="
echo ""
log "You can now access the ERP at http://your-synology-ip:5173"
