# ============================================================================
# Postgres BASE backup + change-log (WAL) cleanup - weekly (owner, 2026-09-29)
#
# Point-in-time restore needs two things: a BASE backup (a full copy of the whole Postgres
# server - every business's database on this PC, not only garment_erp) and every change-log
# (WAL) file archived since it. Postgres copies each WAL file to F:\pg-wal-archive
# (archive_command, turned on by scripts/pg-enable-wal-archive.ps1).
#
# This script:
#   1. takes a base backup to F:\pg-base-backups\<date> (pg_basebackup, compressed tar)
#   2. keeps the newest 2 base backups, deletes older ones
#   3. deletes archived WAL older than the OLDEST kept base backup (pg_archivecleanup) -
#      nothing older can be used by any restore, so it only fills the disk
#
# Scheduled task: GarmentERP_PgBaseBackup (weekly). Restore: docs/runbooks/POSTGRES_POINT_IN_TIME_RESTORE.md
# ============================================================================

$ErrorActionPreference = 'Continue'   # native tools write to stderr on success (PS 5.1 would throw)

$PgBin      = 'C:\Program Files\PostgreSQL\16\bin'
$env:PGPASSWORD = 'postgres'
$BaseRoot   = 'F:\pg-base-backups'
$WalArchive = 'F:\pg-wal-archive'
$KeepBase   = 2
$LogFile    = Join-Path $BaseRoot 'pg-base-backup.log'

function Log([string]$msg) {
    Add-Content -Path $LogFile -Value ('{0}  {1}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $msg) -Encoding utf8
}

New-Item -ItemType Directory -Force -Path $BaseRoot | Out-Null
$target = Join-Path $BaseRoot (Get-Date -Format 'yyyy-MM-dd_HH-mm')

# 1. Base backup - fails loudly, and a failed one never triggers any cleanup
& "$PgBin\pg_basebackup.exe" -h localhost -U postgres -D $target -F t -z -X stream -c fast -l "weekly $(Split-Path $target -Leaf)" 2>&1 |
    ForEach-Object { Log "pg_basebackup: $_" }
if ($LASTEXITCODE -ne 0 -or -not (Test-Path (Join-Path $target 'base.tar.gz'))) {
    Log "FAILED: base backup to $target (exit $LASTEXITCODE) - nothing cleaned up"
    exit 1
}
# Check: both archives read end to end and the manifest is there. (pg_verifybackup cannot check a
# compressed TAR backup before Postgres 18 - it reported every file "missing" on 2026-09-29.)
$tarExe = "$env:SystemRoot\System32\tar.exe"
$baseCount = (& $tarExe -tzf (Join-Path $target 'base.tar.gz') 2>$null | Measure-Object).Count
$baseOk = $LASTEXITCODE -eq 0
$walCount = (& $tarExe -tzf (Join-Path $target 'pg_wal.tar.gz') 2>$null | Measure-Object).Count
$walOk = $LASTEXITCODE -eq 0
if (-not $baseOk -or -not $walOk -or $baseCount -lt 100 -or $walCount -lt 1 -or -not (Test-Path (Join-Path $target 'backup_manifest'))) {
    Log "FAILED: $target did not check out (base: $baseCount files, ok=$baseOk; wal: $walCount, ok=$walOk) - kept, nothing cleaned up"
    exit 1
}
Log "checked: base.tar.gz $baseCount files, pg_wal.tar.gz $walCount files, manifest present"
$sizeMb = [math]::Round(((Get-ChildItem $target -Recurse -File | Measure-Object Length -Sum).Sum) / 1MB)
Log "OK: base backup $(Split-Path $target -Leaf) ($sizeMb MB)"

# 2. Keep the newest $KeepBase base backups
$bases = Get-ChildItem -Path $BaseRoot -Directory |
    Where-Object { (Test-Path (Join-Path $_.FullName 'base.tar.gz')) -and (Test-Path (Join-Path $_.FullName 'backup_manifest')) } |
    Sort-Object Name -Descending
$bases | Select-Object -Skip $KeepBase | ForEach-Object {
    Remove-Item -LiteralPath $_.FullName -Recurse -Force
    Log "removed old base backup $($_.Name)"
}

# 3. WAL older than the oldest kept base backup is useless: its start segment is in backup_manifest
$oldest = $bases | Select-Object -First $KeepBase | Select-Object -Last 1
$manifest = Join-Path $oldest.FullName 'backup_manifest'
if (Test-Path $manifest) {
    $json = Get-Content $manifest -Raw | ConvertFrom-Json
    $startLsn = $json.'WAL-Ranges'[0].'Start-LSN'
    $timeline = [int]$json.'WAL-Ranges'[0].Timeline
    # WAL file name for the start LSN: TTTTTTTT + XXXXXXXX (hi 32 bits) + YYYYYYYY (lo bits / 16 MB)
    $hi, $lo = $startLsn.Split('/')
    $seg = [Convert]::ToUInt32($lo, 16) -shr 24
    $walName = '{0:X8}{1:X8}{2:X8}' -f $timeline, [Convert]::ToUInt32($hi, 16), $seg
    & "$PgBin\pg_archivecleanup.exe" $WalArchive $walName 2>&1 | ForEach-Object { Log "cleanup: $_" }
    Log "WAL before $walName removed from $WalArchive (oldest kept base backup: $($oldest.Name))"
} else {
    Log "WARNING: no backup_manifest in $($oldest.FullName) - WAL not cleaned"
}
exit 0
