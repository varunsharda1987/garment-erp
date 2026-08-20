@echo off
REM ============================================
REM Garment ERP Backup to Google Drive
REM INCREMENTAL: only uploads changed files
REM ============================================

setlocal enabledelayedexpansion

REM Configuration
set "SOURCE_DIR=C:\Users\NEW\garment-erp"
set "LOCAL_BACKUP_DIR=F:\Relocated-from-C\garment-erp-backups"
set "GDRIVE_REMOTE=gdrive"
set "GDRIVE_FOLDER=Backups/garment-erp"
set "DB_NAME=garment_erp"
set "DB_USER=postgres"
set "DB_PASSWORD=postgres"
set "DB_HOST=localhost"
set "DB_PORT=5432"
set "KEEP_DB_BACKUPS=7"

REM Get current date for DB backup filename
for /f "tokens=2 delims==" %%I in ('wmic os get localdatetime /value') do set datetime=%%I
set "BACKUP_DATE=%datetime:~0,4%-%datetime:~4,2%-%datetime:~6,2%"

echo.
echo ============================================
echo   GARMENT ERP - INCREMENTAL BACKUP
echo   %date% %time%
echo ============================================
echo.

REM Check if rclone is installed
where rclone >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] rclone not found!
    pause
    exit /b 1
)

REM Create local backup directories
echo [1/5] Preparing directories...
if not exist "%LOCAL_BACKUP_DIR%" mkdir "%LOCAL_BACKUP_DIR%"
if not exist "%LOCAL_BACKUP_DIR%\database" mkdir "%LOCAL_BACKUP_DIR%\database"
if not exist "%LOCAL_BACKUP_DIR%\project" mkdir "%LOCAL_BACKUP_DIR%\project"
echo       Done
echo.

REM Backup database (dated dumps - small, keep history)
echo [2/5] Backing up PostgreSQL database...
set "PGPASSWORD=%DB_PASSWORD%"
set "DB_BACKUP_FILE=%LOCAL_BACKUP_DIR%\database\%DB_NAME%_%BACKUP_DATE%.dump"

REM Find pg_dump
where pg_dump >nul 2>nul
if %errorlevel% neq 0 (
    if exist "C:\Program Files\PostgreSQL\16\bin\pg_dump.exe" (
        set "PGDUMP=C:\Program Files\PostgreSQL\16\bin\pg_dump.exe"
    ) else if exist "C:\Program Files\PostgreSQL\15\bin\pg_dump.exe" (
        set "PGDUMP=C:\Program Files\PostgreSQL\15\bin\pg_dump.exe"
    ) else if exist "C:\Program Files\PostgreSQL\14\bin\pg_dump.exe" (
        set "PGDUMP=C:\Program Files\PostgreSQL\14\bin\pg_dump.exe"
    ) else (
        echo       [WARNING] pg_dump not found - skipping DB backup
        goto :skip_db_backup
    )
) else (
    set "PGDUMP=pg_dump"
)

REM Skip only if today's dump exists AND has content. pg_dump creates the archive file BEFORE
REM it connects, so a dump that fails (server down, bad password, wrong port) leaves a 0-byte
REM file behind. A bare `if exist` would then treat that corpse as "today's backup": the retry
REM later the same day is skipped, and the empty file is uploaded to Drive as if it were real.
set "DB_DUMP_OK="
if exist "%DB_BACKUP_FILE%" (
    for %%S in ("%DB_BACKUP_FILE%") do if %%~zS gtr 0 set "DB_DUMP_OK=1"
)
if defined DB_DUMP_OK (
    echo       Today's dump already exists - skipping
) else (
    REM Clear a previous failed attempt so pg_dump starts clean
    if exist "%DB_BACKUP_FILE%" del /q "%DB_BACKUP_FILE%"
    "%PGDUMP%" -h %DB_HOST% -p %DB_PORT% -U %DB_USER% -d %DB_NAME% -F c -f "%DB_BACKUP_FILE%" 2>nul
    REM !errorlevel!, NOT %errorlevel%: this sits inside a parenthesised block, so %errorlevel%
    REM is substituted when the block is PARSED - before pg_dump has run - and the message would
    REM report success or failure independently of what pg_dump actually did.
    if !errorlevel! equ 0 (
        echo       Done: %DB_NAME%_%BACKUP_DATE%.dump
    ) else (
        echo       [WARNING] Database backup failed!
        REM Do not leave the 0-byte artefact: it would block today's retry and be uploaded
        if exist "%DB_BACKUP_FILE%" del /q "%DB_BACKUP_FILE%"
    )
)

:skip_db_backup
echo.

REM Sync project files to local backup (robocopy = incremental)
echo [3/5] Syncing project files locally...
echo       (Excluding: node_modules, .git, dist, uploads/styles)

robocopy "%SOURCE_DIR%" "%LOCAL_BACKUP_DIR%\project" /MIR /COPY:DT /DCOPY:T /R:0 /W:0 /XJ /XD node_modules .git dist "uploads\styles" __pycache__ .vscode garment-erp-backups /XF *.log *.tmp .env.local /NFL /NDL /NJH /NJS /NC /NS /NP >nul 2>&1
echo       Done
echo.

REM Upload to Google Drive - INCREMENTAL (single fixed folder)
echo [4/5] Uploading to Google Drive (incremental)...
echo       Only changed files will upload...
echo.

REM Key flags for incremental:
REM   --update       : skip files newer on destination
REM   --fast-list    : fewer API calls for large folders
REM   --transfers 4  : parallel uploads
REM   --checkers 8   : parallel file checks
REM   --drive-chunk-size 64M : larger chunks = fewer requests

REM ---------------------------------------------------------------------------
REM SAFETY GATE - do not remove.
REM
REM `sync` makes Drive a MIRROR of %LOCAL_BACKUP_DIR%, so whatever is missing locally is
REM DELETED from the cloud. That is the intended incremental behaviour, but it means the
REM offsite copy is only ever as good as a secondary drive (F:) whose letter and contents
REM are outside this script's control.
REM
REM Verified with rclone v1.74.3 using this script's own flags:
REM   - source directory MISSING  -> rclone refuses ("directory not found", exit 3). Safe.
REM   - source directory EMPTY    -> destination emptied completely, and rclone exits 0,
REM                                  so the script prints "[OK] Sync complete!" and
REM                                  "BACKUP COMPLETE!" over a wiped backup.
REM   - --update does NOT protect destination-only folders; they are deleted.
REM The `mkdir` further up is what turns the safe case into the fatal one: it recreates an
REM EMPTY %LOCAL_BACKUP_DIR% when F: is absent or has been cleared. Hence this gate.
REM
REM Recovery after a wipe is limited to Google Drive trash (30 days), and the loss would
REM normally only be discovered during an actual restore.
REM ---------------------------------------------------------------------------
if not exist "%LOCAL_BACKUP_DIR%\project\package.json" (
    echo       [ERROR] Local backup root is not populated ^(no project\package.json^).
    echo               Refusing to sync - this would DELETE the Google Drive backup.
    echo               Check that %LOCAL_BACKUP_DIR% exists and the robocopy step above ran.
    exit /b 1
)
if not exist "%LOCAL_BACKUP_DIR%\database" (
    echo       [ERROR] No database folder in the local backup root - refusing to sync.
    exit /b 1
)

REM --max-delete is the second belt: a legitimate incremental run removes only rotated-out
REM dumps and deleted source files, so a run that wants to delete more than 50 items is a
REM symptom, not an intention. rclone aborts the whole sync instead of committing it.
rclone sync "%LOCAL_BACKUP_DIR%" "%GDRIVE_REMOTE%:%GDRIVE_FOLDER%" ^
    --update ^
    --fast-list ^
    --transfers 4 ^
    --checkers 8 ^
    --drive-chunk-size 64M ^
    --max-delete 50 ^
    --progress ^
    --stats-one-line ^
    --stats 30s

set "SYNC_FAILED="
if %errorlevel% equ 0 (
    echo.
    echo       [OK] Sync complete!
) else (
    echo.
    echo       [ERROR] Upload to Google Drive FAILED - the offsite copy is NOT up to date.
    echo               Local backup is intact; fix the cause and re-run.
    set "SYNC_FAILED=1"
)
echo.

REM Cleanup old local DB dumps (keep last N)
echo [5/5] Cleaning old DB dumps (keeping last %KEEP_DB_BACKUPS%)...
set count=0
for /f "tokens=*" %%f in ('dir /b /a-d /o-d "%LOCAL_BACKUP_DIR%\database\*.dump" 2^>nul') do (
    set /a count+=1
    if !count! gtr %KEEP_DB_BACKUPS% (
        echo       Deleting: %%f
        del "%LOCAL_BACKUP_DIR%\database\%%f"
    )
)
echo       Done
echo.

REM Summary. The exit code is what a scheduled task reports, so a failed upload must not be
REM dressed up as a completed backup — otherwise Task Scheduler shows a green run for a night
REM on which nothing reached Google Drive.
echo ============================================
if defined SYNC_FAILED (
    echo   BACKUP INCOMPLETE - CLOUD UPLOAD FAILED
) else (
    echo   BACKUP COMPLETE!
)
echo ============================================
echo.
echo   Local:  %LOCAL_BACKUP_DIR%
echo   Cloud:  Google Drive / %GDRIVE_FOLDER%
echo.
echo   Next run will only upload changed files.
echo ============================================
echo.
if defined SYNC_FAILED exit /b 1
exit /b 0
