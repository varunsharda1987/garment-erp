# ============================================================================
# Garment ERP - HOURLY database backup (owner, 2026-09-29)
#
# The nightly backups (backup-to-nas.bat / backup-to-google-drive.bat, 19:00) meant a wiped
# database lost a whole day's work (29-Sep). This runs every hour, so at most one hour is lost.
#
#   - pg_dump -Fc of garment_erp to F:\garment-erp-hourly-backups - NOT under garment-erp-backups:
#     backup-to-google-drive.bat rclone-syncs that whole folder, and hourly dumps stay off Drive (owner)
#   - a copy to the NAS (\\synology\DATA STORAGE\Backups\garment-erp\hourly) when it is reachable
#   - keeps 48 hours; older hourly dumps are deleted (the nightly dumps are untouched)
#
# SAFETY: a dump of an EMPTY database (styles = 0) is kept but named *_SUSPECT_EMPTY.dump and
# NOTHING is pruned that run - a wiped database must never rotate the good dumps away.
#
# Scheduled task: GarmentERP_HourlyBackup (schtasks, every hour).
# Restore one:  pg_restore -U postgres -h localhost -d <new empty db> --no-owner <file>
# ============================================================================

# Continue, not Stop: in Windows PowerShell 5.1 a native tool writing to stderr under Stop throws
# even when it succeeded. Every step below checks its own exit code / output instead.
$ErrorActionPreference = 'Continue'

$DbName    = 'garment_erp'
$DbUser    = 'postgres'
$DbHost    = 'localhost'
$DbPort    = '5432'
$env:PGPASSWORD = 'postgres'
$PgBin     = 'C:\Program Files\PostgreSQL\16\bin'
$LocalDir  = 'F:\garment-erp-hourly-backups'
$NasDir    = '\\synology\DATA STORAGE\Backups\garment-erp\hourly'
$KeepHours = 48
$LogFile   = Join-Path $LocalDir 'backup-hourly.log'

function Log([string]$msg) {
    $line = '{0}  {1}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $msg
    Add-Content -Path $LogFile -Value $line -Encoding utf8
}

function Prune([string]$dir) {
    $cutoff = (Get-Date).AddHours(-$KeepHours)
    Get-ChildItem -Path $dir -Filter "$($DbName)_*.dump" -File |
        Where-Object { $_.LastWriteTime -lt $cutoff } |
        ForEach-Object { Remove-Item -LiteralPath $_.FullName -Force; Log "pruned $($_.Name) from $dir" }
}

New-Item -ItemType Directory -Force -Path $LocalDir | Out-Null

$stamp = Get-Date -Format 'yyyy-MM-dd_HH-mm'
$file  = Join-Path $LocalDir "$($DbName)_$stamp.dump"

try {
    # 1. Dump
    & "$PgBin\pg_dump.exe" -h $DbHost -p $DbPort -U $DbUser -d $DbName -F c -f $file 2>$null
    if ($LASTEXITCODE -ne 0 -or -not (Test-Path $file) -or (Get-Item $file).Length -eq 0) {
        if (Test-Path $file) { Remove-Item -LiteralPath $file -Force }
        Log "FAILED: pg_dump exit $LASTEXITCODE - no dump written"
        exit 1
    }

    # 2. The archive must be readable
    $toc = & "$PgBin\pg_restore.exe" -l $file 2>$null
    if ($LASTEXITCODE -ne 0 -or -not ($toc -match 'TABLE DATA')) {
        Log "FAILED: $file is not a readable archive - kept for inspection, nothing pruned"
        exit 1
    }

    # 3. An empty database must never push the good dumps out
    $styles = & "$PgBin\psql.exe" -h $DbHost -p $DbPort -U $DbUser -d $DbName -tAc 'select count(*) from styles' 2>$null
    $styles = [int](($styles | Out-String).Trim())
    if ($styles -eq 0) {
        $suspect = $file -replace '\.dump$', '_SUSPECT_EMPTY.dump'
        Rename-Item -LiteralPath $file -NewName (Split-Path $suspect -Leaf)
        Log "WARNING: database has 0 styles - saved as $(Split-Path $suspect -Leaf); NOTHING pruned (older good dumps kept)"
        exit 2
    }

    $sizeKb = [math]::Round((Get-Item $file).Length / 1KB)
    Log "OK: $(Split-Path $file -Leaf) ($sizeKb KB, $styles styles)"

    # 4. Off-machine copy (best effort)
    if (Test-Path '\\synology\DATA STORAGE') {
        try {
            New-Item -ItemType Directory -Force -Path $NasDir | Out-Null
            Copy-Item -LiteralPath $file -Destination $NasDir -Force
            Prune $NasDir
        } catch {
            Log "NAS copy failed: $($_.Exception.Message)"
        }
    } else {
        Log 'NAS not reachable - local copy only'
    }

    # 5. Keep 48 hours locally
    Prune $LocalDir
    exit 0
} catch {
    Log "FAILED: $($_.Exception.Message)"
    exit 1
}
