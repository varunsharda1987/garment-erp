@echo off
REM ============================================
REM Garment ERP Backup to Google Drive
REM Backs up database + project files to Google Drive
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
set "KEEP_BACKUPS=7"

REM Get current date and time for backup folder name
for /f "tokens=2 delims==" %%I in ('wmic os get localdatetime /value') do set datetime=%%I
set "BACKUP_DATE=%datetime:~0,4%-%datetime:~4,2%-%datetime:~6,2%_%datetime:~8,2%-%datetime:~10,2%"
set "BACKUP_DIR=%LOCAL_BACKUP_DIR%\%BACKUP_DATE%"

echo.
echo ============================================
echo   GARMENT ERP - GOOGLE DRIVE BACKUP
echo   %date% %time%
echo ============================================
echo.

REM Check if rclone is installed
where rclone >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] rclone not found!
    echo Please run setup-google-drive-backup.bat first.
    pause
    exit /b 1
)

REM Check if Google Drive remote is configured
rclone listremotes | findstr /i "%GDRIVE_REMOTE%:" >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Google Drive remote "%GDRIVE_REMOTE%" not configured!
    echo Please run setup-google-drive-backup.bat first.
    pause
    exit /b 1
)

REM Create local backup directory
echo [1/5] Creating local backup directory...
if not exist "%LOCAL_BACKUP_DIR%" mkdir "%LOCAL_BACKUP_DIR%"
if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"
if not exist "%BACKUP_DIR%\database" mkdir "%BACKUP_DIR%\database"
if not exist "%BACKUP_DIR%\project" mkdir "%BACKUP_DIR%\project"
echo       Done: %BACKUP_DIR%
echo.

REM Backup database
echo [2/5] Backing up PostgreSQL database...
set "PGPASSWORD=%DB_PASSWORD%"
set "DB_BACKUP_FILE=%BACKUP_DIR%\database\%DB_NAME%_%BACKUP_DATE%"

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
        echo       [ERROR] PostgreSQL pg_dump not found!
        goto :skip_db_backup
    )
) else (
    set "PGDUMP=pg_dump"
)

REM Create compressed database backup
"%PGDUMP%" -h %DB_HOST% -p %DB_PORT% -U %DB_USER% -d %DB_NAME% -F c -f "%DB_BACKUP_FILE%.dump" 2>nul
if %errorlevel% equ 0 (
    echo       Done: %DB_NAME%_%BACKUP_DATE%.dump
) else (
    echo       [WARNING] Database backup failed! Is PostgreSQL running?
)

:skip_db_backup
echo.

REM Backup project files
echo [3/5] Backing up project files...
echo       (Excluding: node_modules, .git, dist, uploads/styles)

robocopy "%SOURCE_DIR%" "%BACKUP_DIR%\project" /E /COPY:DT /DCOPY:T /R:0 /W:0 /XJ /XD node_modules .git dist "uploads\styles" __pycache__ .vscode garment-erp-backups /XF *.log *.tmp .env.local /NFL /NDL /NJH /NJS /NC /NS /NP >nul 2>&1

if %errorlevel% leq 7 (
    echo       Done: Project files copied
) else (
    echo       [WARNING] Some files may not have been copied
)
echo.

REM Create backup info file
echo [4/5] Creating backup info...
echo Backup Date: %date% %time% > "%BACKUP_DIR%\BACKUP_INFO.txt"
echo Source: %SOURCE_DIR% >> "%BACKUP_DIR%\BACKUP_INFO.txt"
echo Database: %DB_NAME% >> "%BACKUP_DIR%\BACKUP_INFO.txt"
echo Destination: Google Drive / %GDRIVE_FOLDER% >> "%BACKUP_DIR%\BACKUP_INFO.txt"
echo. >> "%BACKUP_DIR%\BACKUP_INFO.txt"
echo Contents: >> "%BACKUP_DIR%\BACKUP_INFO.txt"
echo - /project  : Source code (frontend, backend, docs) >> "%BACKUP_DIR%\BACKUP_INFO.txt"
echo - /database : PostgreSQL database dump >> "%BACKUP_DIR%\BACKUP_INFO.txt"
echo       Done
echo.

REM Upload to Google Drive
echo [5/5] Uploading to Google Drive...
echo       This may take several minutes...
echo.

rclone copy "%BACKUP_DIR%" "%GDRIVE_REMOTE%:%GDRIVE_FOLDER%/%BACKUP_DATE%" --progress --transfers 4

if %errorlevel% equ 0 (
    echo.
    echo       [OK] Upload complete!
) else (
    echo.
    echo       [ERROR] Upload failed! Check your internet connection.
    pause
    exit /b 1
)
echo.

REM Cleanup old local backups (keep last N)
echo [Cleanup] Cleaning local backups (keeping last %KEEP_BACKUPS%)...
set count=0
for /f "tokens=*" %%d in ('dir /b /ad /o-d "%LOCAL_BACKUP_DIR%" 2^>nul') do (
    set /a count+=1
    if !count! gtr %KEEP_BACKUPS% (
        echo       Deleting: %%d
        rmdir /s /q "%LOCAL_BACKUP_DIR%\%%d"
    )
)
echo       Done
echo.

REM Cleanup old Google Drive backups
echo [Cleanup] Cleaning Google Drive backups (keeping last %KEEP_BACKUPS%)...
set count=0
for /f "tokens=*" %%d in ('rclone lsf "%GDRIVE_REMOTE%:%GDRIVE_FOLDER%" --dirs-only 2^>nul ^| sort /r') do (
    set /a count+=1
    if !count! gtr %KEEP_BACKUPS% (
        echo       Deleting from Drive: %%d
        rclone purge "%GDRIVE_REMOTE%:%GDRIVE_FOLDER%/%%d" 2>nul
    )
)
echo       Done
echo.

REM Get backup size
for /f "tokens=*" %%s in ('rclone size "%GDRIVE_REMOTE%:%GDRIVE_FOLDER%/%BACKUP_DATE%" --json 2^>nul ^| findstr bytes') do set "SIZE_INFO=%%s"

REM Summary
echo ============================================
echo   BACKUP COMPLETE!
echo ============================================
echo.
echo   Local:  %BACKUP_DIR%
echo   Cloud:  Google Drive / %GDRIVE_FOLDER% / %BACKUP_DATE%
echo.
echo   Contents uploaded:
rclone lsf "%GDRIVE_REMOTE%:%GDRIVE_FOLDER%/%BACKUP_DATE%" 2>nul
echo.
echo ============================================
echo.

pause
