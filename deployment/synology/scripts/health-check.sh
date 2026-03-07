#!/bin/bash
#
# Garment ERP - Health Check Script for Synology
#
# This script checks if all ERP services are running properly.
# Can be scheduled to run every 5 minutes via Task Scheduler.
#
# SETUP:
# 1. Save to /volume2/docker/garment-erp/scripts/
# 2. Make executable: chmod +x health-check.sh
# 3. Task Scheduler: Run every 5 minutes
#    Command: /volume2/docker/garment-erp/scripts/health-check.sh

set -e

# Configuration
LOG_FILE="/volume2/docker/garment-erp/logs/health-check.log"
ALERT_FILE="/volume2/docker/garment-erp/logs/last-alert.txt"
SYNOLOGY_IP="${SYNOLOGY_IP:-192.168.1.100}"

# Create log directory
mkdir -p "$(dirname $LOG_FILE)"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

send_alert() {
    local message="$1"
    local alert_type="$2"

    # Check if we already sent an alert in the last hour for this type
    if [ -f "$ALERT_FILE" ]; then
        last_alert=$(cat "$ALERT_FILE")
        last_time=$(echo "$last_alert" | cut -d'|' -f1)
        last_type=$(echo "$last_alert" | cut -d'|' -f2)
        current_time=$(date +%s)

        # If same alert type and less than 1 hour ago, skip
        if [ "$last_type" = "$alert_type" ]; then
            time_diff=$((current_time - last_time))
            if [ $time_diff -lt 3600 ]; then
                log "Skipping alert (already sent within 1 hour)"
                return
            fi
        fi
    fi

    log "ALERT: $message"

    # Save alert info
    echo "$(date +%s)|$alert_type" > "$ALERT_FILE"

    # Uncomment and configure your preferred alert method:

    # Option 1: Synology Notification (requires DSM notification setup)
    # synodsmnotify @administrators "Garment ERP Alert" "$message"

    # Option 2: Email (requires configured mail settings)
    # echo "$message" | mail -s "Garment ERP Alert" "$ALERT_EMAIL"

    # Option 3: Telegram (requires bot token and chat ID)
    # curl -s -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/sendMessage" \
    #     -d "chat_id=$TELEGRAM_CHAT_ID" \
    #     -d "text=$message"

    # For now, just log to file
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ALERT: $message" >> "/volume2/docker/garment-erp/logs/alerts.log"
}

clear_alert() {
    local alert_type="$1"
    if [ -f "$ALERT_FILE" ]; then
        last_type=$(cat "$ALERT_FILE" | cut -d'|' -f2)
        if [ "$last_type" = "$alert_type" ]; then
            rm -f "$ALERT_FILE"
            log "Alert cleared: $alert_type"
        fi
    fi
}

# Check functions
check_container() {
    local container_name="$1"
    local status=$(docker inspect -f '{{.State.Status}}' "$container_name" 2>/dev/null || echo "not_found")

    if [ "$status" = "running" ]; then
        return 0
    else
        return 1
    fi
}

check_database() {
    docker exec garment-erp-db pg_isready -U garment_user -d garment_erp > /dev/null 2>&1
    return $?
}

check_backend() {
    curl -sf "http://localhost:5000/api/health" > /dev/null 2>&1
    return $?
}

check_frontend() {
    curl -sf "http://localhost:5173/" > /dev/null 2>&1
    return $?
}

check_disk_space() {
    # Check Volume 2 (where ERP runs)
    local usage=$(df /volume2 | awk 'NR==2 {print $5}' | sed 's/%//')
    if [ "$usage" -gt 90 ]; then
        return 1
    fi
    return 0
}

# Main health check
log "Starting health check..."

ISSUES=()

# Check database container
if check_container "garment-erp-db"; then
    log "Database container: OK"

    # Check if database is accepting connections
    if check_database; then
        log "Database connection: OK"
        clear_alert "database"
    else
        log "Database connection: FAILED"
        ISSUES+=("Database not accepting connections")
    fi
else
    log "Database container: NOT RUNNING"
    ISSUES+=("Database container not running")
fi

# Check backend container
if check_container "garment-erp-backend"; then
    log "Backend container: OK"

    # Check if API is responding
    if check_backend; then
        log "Backend API: OK"
        clear_alert "backend"
    else
        log "Backend API: NOT RESPONDING"
        ISSUES+=("Backend API not responding")
    fi
else
    log "Backend container: NOT RUNNING"
    ISSUES+=("Backend container not running")
fi

# Check frontend container
if check_container "garment-erp-frontend"; then
    log "Frontend container: OK"

    # Check if frontend is serving
    if check_frontend; then
        log "Frontend: OK"
        clear_alert "frontend"
    else
        log "Frontend: NOT RESPONDING"
        ISSUES+=("Frontend not responding")
    fi
else
    log "Frontend container: NOT RUNNING"
    ISSUES+=("Frontend container not running")
fi

# Check disk space
if check_disk_space; then
    log "Disk space: OK"
    clear_alert "disk"
else
    log "Disk space: LOW"
    ISSUES+=("Disk space is above 90%")
fi

# Summary
if [ ${#ISSUES[@]} -eq 0 ]; then
    log "Health check completed: All services healthy"
else
    error_message="ERP Health Issues:\n"
    for issue in "${ISSUES[@]}"; do
        error_message+="- $issue\n"
    done

    send_alert "$error_message" "health_check"
fi

# Rotate logs (keep last 1000 lines)
if [ -f "$LOG_FILE" ]; then
    tail -1000 "$LOG_FILE" > "$LOG_FILE.tmp" && mv "$LOG_FILE.tmp" "$LOG_FILE"
fi

log "Health check completed"
