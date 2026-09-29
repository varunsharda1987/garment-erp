# ============================================================================
# ONE-TIME: turn on Postgres change-log archiving (point-in-time restore) - owner, 2026-09-29
#
# RUN AS ADMINISTRATOR (right-click PowerShell -> Run as administrator):
#   powershell -ExecutionPolicy Bypass -File C:\Users\NEW\garment-erp\scripts\pg-enable-wal-archive.ps1
#
# What it does:
#   1. sets archive_mode = on, archive_command = copy to F:\pg-wal-archive, archive_timeout = 5 min
#   2. RESTARTS the Postgres service - every database on this PC (garment-erp, kasya-b2b,
#      harleen-b2b, thar-coal, inward, ucip, sales_analysis) is unavailable for ~10-30 seconds;
#      the apps reconnect by themselves
#   3. forces one change-log file out and checks it arrived in F:\pg-wal-archive
#   4. takes the first base backup (scripts/pg-base-backup.ps1)
#   5. schedules the weekly base backup (task GarmentERP_PgBaseBackup, Sunday 02:30)
#
# Safe to run again: every step checks before it acts.
# ============================================================================

$ErrorActionPreference = 'Continue'
$PgBin   = 'C:\Program Files\PostgreSQL\16\bin'
$psql    = Join-Path $PgBin 'psql.exe'
$env:PGPASSWORD = 'postgres'
$Service = 'postgresql-x64-16'
$Archive = 'F:\pg-wal-archive'

function Q([string]$sql) { (& $psql -U postgres -h localhost -tAc $sql 2>&1 | Out-String).Trim() }
function Stop-WithError([string]$msg) { Write-Host "`nSTOPPED: $msg" -ForegroundColor Red; exit 1 }

$admin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
    [Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $admin) { Stop-WithError 'Run this in PowerShell opened with "Run as administrator".' }

# 0. The archive folder must exist and the Postgres service (NETWORK SERVICE) must be able to write to it -
#    if it cannot, Postgres keeps every change-log file on C: (95% full) until the disk fills.
New-Item -ItemType Directory -Force -Path $Archive, 'F:\pg-base-backups' | Out-Null
icacls $Archive /grant '*S-1-5-20:(OI)(CI)M' | Out-Null
icacls 'F:\pg-base-backups' /grant '*S-1-5-20:(OI)(CI)M' | Out-Null

# 1. Settings (ALTER SYSTEM writes postgresql.auto.conf; archive_mode needs the restart)
Write-Host '1. Setting archive_mode / archive_command / archive_timeout...'
$out = & $psql -U postgres -h localhost -v ON_ERROR_STOP=1 `
    -c "ALTER SYSTEM SET archive_mode = 'on'" `
    -c "ALTER SYSTEM SET archive_command = 'copy `"%p`" `"F:\pg-wal-archive\%f`"'" `
    -c "ALTER SYSTEM SET archive_timeout = '300'" 2>&1
if ($LASTEXITCODE -ne 0) { Stop-WithError "ALTER SYSTEM failed: $out" }

# 2. Restart (only when archive_mode is not already on)
if ((Q "show archive_mode") -ne 'on') {
    Write-Host "2. Restarting $Service (all databases on this PC pause for a few seconds)..."
    Restart-Service -Name $Service -Force
    $ok = $false
    foreach ($i in 1..30) {
        Start-Sleep -Seconds 2
        if ((Q "select 1") -eq '1') { $ok = $true; break }
    }
    if (-not $ok) { Stop-WithError "Postgres did not come back after the restart - check the service $Service now." }
} else {
    Write-Host '2. archive_mode is already on - no restart needed.'
}
if ((Q "show archive_mode") -ne 'on') { Stop-WithError 'archive_mode is still off after the restart.' }
Write-Host ("   archive_command = " + (Q "show archive_command"))

# 3. Prove archiving works: force a change-log file out and wait for it in the archive
Write-Host '3. Checking a change-log file reaches F:\pg-wal-archive...'
$wal = Q "select pg_walfile_name(pg_switch_wal())"
$arrived = $false
foreach ($i in 1..30) {
    Start-Sleep -Seconds 2
    if (Test-Path (Join-Path $Archive $wal)) { $arrived = $true; break }
}
$stats = Q "select archived_count || ' archived, ' || failed_count || ' failed, last failure: ' || coalesce(last_failed_wal,'none') from pg_stat_archiver"
Write-Host "   pg_stat_archiver: $stats"
if (-not $arrived) {
    Stop-WithError "$wal did not arrive in $Archive. Postgres is now KEEPING change-log files on C: until archiving works - fix the folder permission, or undo with:  ALTER SYSTEM SET archive_mode = 'off'  and restart $Service."
}
Write-Host "   OK: $wal archived."

# 4. First base backup
Write-Host '4. Taking the first base backup (about 5 GB, a few minutes)...'
& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'pg-base-backup.ps1')
if ($LASTEXITCODE -ne 0) { Stop-WithError 'Base backup failed - see F:\pg-base-backups\pg-base-backup.log' }
Get-Content 'F:\pg-base-backups\pg-base-backup.log' -Tail 3

# 5. Weekly base backup
Write-Host '5. Scheduling the weekly base backup (Sunday 02:30)...'
schtasks /create /tn 'GarmentERP_PgBaseBackup' /sc weekly /d SUN /st 02:30 /f `
    /tr "powershell.exe -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File $(Join-Path $PSScriptRoot 'pg-base-backup.ps1')" | Out-Null
schtasks /query /tn 'GarmentERP_PgBaseBackup' /fo LIST | Select-String 'Next Run'

Write-Host "`nDONE: point-in-time restore is on. Restore guide: docs\runbooks\POSTGRES_POINT_IN_TIME_RESTORE.md" -ForegroundColor Green
