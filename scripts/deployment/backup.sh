#!/bin/bash
# ============================================
# GARMENT ERP - Database Backup Script
# ============================================
# Creates daily backups of the PostgreSQL database
# Keeps last 7 days of backups
#
# Usage: ./backup.sh
# Add to cron: 0 2 * * * /opt/garment-erp/scripts/deployment/backup.sh
# ============================================

set -e

# Configuration
BACKUP_DIR="/opt/garment-erp/backups"
RETENTION_DAYS=7
DATE=$(date +%Y%m%d_%H%M%S)

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Load environment variables
if [ -f /opt/garment-erp/.env ]; then
  source /opt/garment-erp/.env
fi

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
  echo -e "${RED}ERROR: DATABASE_URL not set. Source .env file or set manually.${NC}"
  exit 1
fi

# Create backup directory
mkdir -p $BACKUP_DIR

echo "============================================"
echo "  Database Backup - $DATE"
echo "============================================"

# Parse DATABASE_URL
# Format: postgresql://user:password@host:port/database?sslmode=require
DB_HOST=$(echo $DATABASE_URL | sed -n 's/.*@\([^:]*\):.*/\1/p')
DB_PORT=$(echo $DATABASE_URL | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
DB_NAME=$(echo $DATABASE_URL | sed -n 's/.*\/\([^?]*\).*/\1/p')
DB_USER=$(echo $DATABASE_URL | sed -n 's/.*\/\/\([^:]*\):.*/\1/p')
DB_PASSWORD=$(echo $DATABASE_URL | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p')

BACKUP_FILE="$BACKUP_DIR/garment_erp_$DATE.sql.gz"

echo -e "${GREEN}Creating backup...${NC}"

# Create backup using pg_dump via Docker
docker run --rm \
  -e PGPASSWORD="$DB_PASSWORD" \
  postgres:15-alpine \
  pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
  --no-owner --no-acl \
  | gzip > "$BACKUP_FILE"

# Check if backup was successful
if [ -f "$BACKUP_FILE" ] && [ -s "$BACKUP_FILE" ]; then
  BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
  echo -e "${GREEN}Backup created: $BACKUP_FILE ($BACKUP_SIZE)${NC}"
else
  echo -e "${RED}ERROR: Backup failed!${NC}"
  rm -f "$BACKUP_FILE"
  exit 1
fi

# Remove old backups
echo -e "${GREEN}Removing backups older than $RETENTION_DAYS days...${NC}"
find $BACKUP_DIR -name "garment_erp_*.sql.gz" -mtime +$RETENTION_DAYS -delete

# List current backups
echo ""
echo "Current backups:"
ls -lh $BACKUP_DIR/garment_erp_*.sql.gz 2>/dev/null || echo "No backups found"

# Optional: Upload to DigitalOcean Spaces
if [ -n "$DO_SPACES_KEY" ] && [ -n "$DO_SPACES_SECRET" ] && [ -n "$DO_SPACES_BUCKET" ]; then
  echo ""
  echo -e "${GREEN}Uploading to DigitalOcean Spaces...${NC}"

  # Install s3cmd if not present
  if ! command -v s3cmd &> /dev/null; then
    apt-get update && apt-get install -y s3cmd
  fi

  # Configure s3cmd
  cat > /tmp/.s3cfg << EOF
[default]
access_key = $DO_SPACES_KEY
secret_key = $DO_SPACES_SECRET
host_base = ${DO_SPACES_REGION:-blr1}.digitaloceanspaces.com
host_bucket = %(bucket)s.${DO_SPACES_REGION:-blr1}.digitaloceanspaces.com
EOF

  s3cmd -c /tmp/.s3cfg put "$BACKUP_FILE" "s3://$DO_SPACES_BUCKET/backups/"
  rm /tmp/.s3cfg

  echo -e "${GREEN}Backup uploaded to Spaces${NC}"
fi

echo ""
echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}  Backup Complete!${NC}"
echo -e "${GREEN}============================================${NC}"
