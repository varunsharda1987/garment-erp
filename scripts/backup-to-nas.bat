@echo off
REM ============================================
REM Garment ERP Backup Script
REM Backs up project files and database to Z:\
REM ============================================

setlocal enabledelayedexpansion

REM Configuration
set "SOURCE_DIR=C:\Users\NEW\garment-erp"
REM Using UNC path instead of Z:\ so it works when running as Administrator
set "BACKUP_ROOT=\\synology\DATA STORAGE\Backups\garment-erp"
set "DB_NAME=garment_erp"
set "DB_USER=postgres"
set "DB_PASSWORD=postgres"
set "DB_HOST=localhost"
set "DB_PORT=5432"
set "KEEP_BACKUPS=7"

REM Get current date and time for backup folder name
for /f "tokens=2 delims==" %%I in ('wmic os get localdatetime /value') do set datetime=%%I
set "BACKUP_DATE=%datetime:~0,4%-%datetime:~4,2%-%datetime:~6,2%_%datetime:~8,2%-%datetime:~10,2%"
set "BACKUP_DIR=%BACKUP_ROOT%\%BACKUP_DATE%"

echo.
echo ============================================
echo   GARMENT ERP BACKUP
echo   %date% %time%
echo ============================================
echo.

REM Check if network path is accessible
if not exist "\\synology\DATA STORAGE" (
    echo [ERROR] Network path \\synology\DATA STORAGE is not accessible!
    echo Please make sure the Synology NAS is connected.
    pause
    exit /b 1
)

REM Create backup directory
echo [1/4] Creating backup directory...
if not exist "%BACKUP_ROOT%" mkdir "%BACKUP_ROOT%"
if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"
if not exist "%BACKUP_DIR%\database" mkdir "%BACKUP_DIR%\database"
if not exist "%BACKUP_DIR%\project" mkdir "%BACKUP_DIR%\project"
echo       Done: %BACKUP_DIR%
echo.

REM Backup database
echo [2/4] Backing up PostgreSQL database...
set "PGPASSWORD=%DB_PASSWORD%"
set "DB_BACKUP_FILE=%BACKUP_DIR%\database\%DB_NAME%_%BACKUP_DATE%.sql"

REM Check if pg_dump exists
where pg_dump >nul 2>nul
if %errorlevel% neq 0 (
    echo       [WARNING] pg_dump not found in PATH!
    echo       Trying common PostgreSQL locations...

    REM Try common PostgreSQL installation paths
    if exist "C:\Program Files\PostgreSQL\16\bin\pg_dump.exe" (
        set "PGDUMP=C:\Program Files\PostgreSQL\16\bin\pg_dump.exe"
    ) else if exist "C:\Program Files\PostgreSQL\15\bin\pg_dump.exe" (
        set "PGDUMP=C:\Program Files\PostgreSQL\15\bin\pg_dump.exe"
    ) else if exist "C:\Program Files\PostgreSQL\14\bin\pg_dump.exe" (
        set "PGDUMP=C:\Program Files\PostgreSQL\14\bin\pg_dump.exe"
    ) else (
        echo       [ERROR] PostgreSQL pg_dump not found!
        echo       Database backup skipped.
        goto :skip_db_backup
    )
) else (
    set "PGDUMP=pg_dump"
)

"%PGDUMP%" -h %DB_HOST% -p %DB_PORT% -U %DB_USER% -d %DB_NAME% -F c -f "%DB_BACKUP_FILE%.dump" 2>nul
if %errorlevel% equ 0 (
    echo       Done: %DB_NAME%_%BACKUP_DATE%.sql.dump
) else (
    echo       [WARNING] Database backup failed! Is PostgreSQL running?
)

:skip_db_backup
echo.

REM Backup project files (excluding node_modules, .git, etc.)
echo [3/4] Backing up project files...
echo       (Excluding: node_modules, .git, dist, uploads/styles)

robocopy "%SOURCE_DIR%" "%BACKUP_DIR%\project" /E /COPY:DT /DCOPY:T /R:0 /W:0 /XJ /XD node_modules .git dist "uploads\styles" __pycache__ .vscode /XF *.log *.tmp .env.local /NFL /NDL /NJH /NJS /NC /NS /NP >nul 2>&1

if %errorlevel% leq 7 (
    echo       Done: Project files copied
) else (
    echo       [WARNING] Some files may not have been copied
)
echo.

REM Create backup info file
echo [4/4] Creating backup info...
echo Backup Date: %date% %time% > "%BACKUP_DIR%\BACKUP_INFO.txt"
echo Source: %SOURCE_DIR% >> "%BACKUP_DIR%\BACKUP_INFO.txt"
echo Database: %DB_NAME% >> "%BACKUP_DIR%\BACKUP_INFO.txt"
echo. >> "%BACKUP_DIR%\BACKUP_INFO.txt"
echo Contents: >> "%BACKUP_DIR%\BACKUP_INFO.txt"
echo - /project  : Source code (frontend, backend, docs) >> "%BACKUP_DIR%\BACKUP_INFO.txt"
echo - /database : PostgreSQL database dump >> "%BACKUP_DIR%\BACKUP_INFO.txt"
echo       Done: BACKUP_INFO.txt created
echo.

REM Cleanup old backups (keep last N)
echo [Cleanup] Keeping last %KEEP_BACKUPS% backups...
set count=0
for /f "tokens=*" %%d in ('dir /b /ad /o-d "%BACKUP_ROOT%" 2^>nul') do (
    set /a count+=1
    if !count! gtr %KEEP_BACKUPS% (
        echo       Deleting old backup: %%d
        rmdir /s /q "%BACKUP_ROOT%\%%d"
    )
)
echo       Done
echo.

REM Summary
echo ============================================
echo   BACKUP COMPLETE!
echo ============================================
echo   Location: %BACKUP_DIR%
echo.
echo   Contents:
dir /b "%BACKUP_DIR%" 2>nul
echo.
echo   Total Size:
for /f "tokens=3" %%a in ('dir /-c "%BACKUP_DIR%" ^| findstr "bytes"') do echo   %%a bytes
echo ============================================
echo.

pause
