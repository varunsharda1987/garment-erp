# ============================================================================
# Refresh the TEST database from live (owner, 2026-09-29)
#
#   garment_erp  (LIVE)  --pg_dump-->  garment_erp_test  (a copy, for tests / trying migrations)
#
# Dev and live were one database, and tests wrote into the team's data (78 blank trims, 2026-09-26);
# a migration check wiped it (2026-09-29). Tests now run against garment_erp_test
# (backend/src/__tests__/setup.ts refuses any database whose name does not end in _test).
#
# A copy that you try changes on cannot also stay in sync with live, so this REBUILDS it:
#   - nightly by the scheduled task GarmentERP_RefreshTestDb (02:15)
#   - on demand:  powershell -ExecutionPolicy Bypass -File scripts\refresh-test-db.ps1
# Anything written to the test database since the last refresh is thrown away.
#
# SAFETY: the database names are FIXED below - this script takes no database argument, only ever
# reads garment_erp and only ever creates / renames / drops garment_erp_test*. It never writes to live.
# ============================================================================

$ErrorActionPreference = 'Continue'   # native tools write to stderr on success (PS 5.1 would throw)

$PgBin  = 'C:\Program Files\PostgreSQL\16\bin'
$env:PGPASSWORD = 'postgres'
$Live   = 'garment_erp'
$Test   = 'garment_erp_test'
$Next   = 'garment_erp_test_next'
$Prev   = 'garment_erp_test_prev'
$Work   = 'F:\garment-erp-hourly-backups\test-refresh'
$LogFile = 'F:\garment-erp-hourly-backups\refresh-test-db.log'

function Log([string]$msg) {
    $line = '{0}  {1}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $msg
    Add-Content -Path $LogFile -Value $line -Encoding utf8
    Write-Host $line
}
function Psql([string]$db, [string]$sql) {
    (& "$PgBin\psql.exe" -U postgres -h localhost -d $db -v ON_ERROR_STOP=1 -tAc $sql 2>&1 | Out-String).Trim()
}
foreach ($name in @($Test, $Next, $Prev)) {
    if (-not $name.StartsWith('garment_erp_test')) { throw "refusing: $name is not a test database" }
}

New-Item -ItemType Directory -Force -Path $Work | Out-Null
$dump = Join-Path $Work 'garment_erp_for_test.dump'

# 1. Fresh copy of live (read-only on live)
& "$PgBin\pg_dump.exe" -U postgres -h localhost -d $Live -F c -f $dump 2>$null
if ($LASTEXITCODE -ne 0 -or -not (Test-Path $dump)) { Log "FAILED: pg_dump of $Live (exit $LASTEXITCODE)"; exit 1 }

# 2. Build the new copy beside the old one, so tests keep working until the swap
Psql 'postgres' "DROP DATABASE IF EXISTS $Next WITH (FORCE)" | Out-Null
Psql 'postgres' "CREATE DATABASE $Next" | Out-Null
& "$PgBin\pg_restore.exe" -U postgres -h localhost -d $Next --no-owner $dump 2>$null
$styles = Psql $Next 'select count(*) from styles'
$liveStyles = Psql $Live 'select count(*) from styles'
if ($styles -notmatch '^\d+$' -or [int]$styles -ne [int]$liveStyles) {
    Log "FAILED: copy has $styles styles, live has $liveStyles - old $Test kept"
    exit 1
}

# 3. Swap: current test -> prev, next -> test, drop prev (kicks off any test run using it)
$exists = Psql 'postgres' "select count(*) from pg_database where datname = '$Test'"
if ($exists -eq '1') {
    Psql 'postgres' "DROP DATABASE IF EXISTS $Prev WITH (FORCE)" | Out-Null
    Psql 'postgres' "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$Test' AND pid <> pg_backend_pid()" | Out-Null
    $r = Psql 'postgres' "ALTER DATABASE $Test RENAME TO $Prev"
    if ($LASTEXITCODE -ne 0) { Log "FAILED: could not move the old $Test aside: $r"; exit 1 }
}
$r = Psql 'postgres' "ALTER DATABASE $Next RENAME TO $Test"
if ($LASTEXITCODE -ne 0) { Log "FAILED: could not rename $Next to $($Test): $r"; exit 1 }
Psql 'postgres' "DROP DATABASE IF EXISTS $Prev WITH (FORCE)" | Out-Null
Remove-Item -LiteralPath $dump -Force

$migrations = Psql $Test 'select count(*) from _prisma_migrations where finished_at is not null'
Log "OK: $Test rebuilt from $Live ($styles styles, $migrations migrations)"
exit 0
