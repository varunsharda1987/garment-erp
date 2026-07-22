@echo off
REM ============================================
REM Restore Garment ERP from Google Drive
REM ============================================

setlocal enabledelayedexpansion

set "GDRIVE_REMOTE=gdrive"
set "GDRIVE_FOLDER=Backups/garment-erp"
set "RESTORE_DIR=C:\Users\NEW\garment-erp-restore"
set "DB_NAME=garment_erp"
set "DB_USER=postgres"
set "DB_PASSWORD=postgres"
set "DB_HOST=localhost"
set "DB_PORT=5432"

echo.
echo ============================================
echo   GARMENT ERP - RESTORE FROM GOOGLE DRIVE
echo ============================================
echo.
echo WARNING: This will restore files and database!
echo Make sure you have a current backup before proceeding.
echo.

REM Check rclone
where rclone >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] rclone not found! Install it first.
    pause
    exit /b 1
)

rclone listremotes | findstr /i "%GDRIVE_REMOTE%:" >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Google Drive not configured!
    echo Run setup-google-drive-backup.bat first.
    pause
    exit /b 1
)

REM List available backups
echo Available backups on Google Drive:
echo -----------------------------------
echo.

set "BACKUP_COUNT=0"
for /f "tokens=*" %%d in ('rclone lsf "%GDRIVE_REMOTE%:%GDRIVE_FOLDER%" --dirs-only 2^>nul ^| sort /r') do (
    set /a BACKUP_COUNT+=1
    echo   !BACKUP_COUNT!. %%d
    set "BACKUP_!BACKUP_COUNT!=%%d"
)

if %BACKUP_COUNT%==0 (
    echo   No backups found!
    pause
    exit /b 1
)

echo.
set /p choice="Enter backup number to restore (1-%BACKUP_COUNT%): "

set "SELECTED_BACKUP=!BACKUP_%choice%!"
if "%SELECTED_BACKUP%"=="" (
    echo [ERROR] Invalid selection!
    pause
    exit /b 1
)

REM Remove trailing slash if present
set "SELECTED_BACKUP=%SELECTED_BACKUP:/=%"

echo.
echo Selected: %SELECTED_BACKUP%
echo.
echo This will:
echo   1. Download backup from Google Drive
echo   2. Restore database (OVERWRITES current data!)
echo   3. Extract project files to %RESTORE_DIR%
echo.
set /p confirm="Are you sure? Type YES to continue: "

if /i not "%confirm%"=="YES" (
    echo Cancelled.
    pause
    exit /b 0
)

echo.
echo [1/3] Downloading from Google Drive...
if not exist "%RESTORE_DIR%" mkdir "%RESTORE_DIR%"
rclone copy "%GDRIVE_REMOTE%:%GDRIVE_FOLDER%/%SELECTED_BACKUP%" "%RESTORE_DIR%\%SELECTED_BACKUP%" --progress

if %errorlevel% neq 0 (
    echo [ERROR] Download failed!
    pause
    exit /b 1
)
echo       Done
echo.

REM Find database dump
echo [2/3] Restoring database...
set "DUMP_FILE="
for %%f in ("%RESTORE_DIR%\%SELECTED_BACKUP%\database\*.dump") do set "DUMP_FILE=%%f"

if "%DUMP_FILE%"=="" (
    echo       [WARNING] No database dump found in backup!
    echo       Skipping database restore.
    goto :skip_db_restore
)

echo       Found: %DUMP_FILE%
echo       Restoring to database: %DB_NAME%
echo.

REM Find pg_restore
where pg_restore >nul 2>nul
if %errorlevel% neq 0 (
    if exist "C:\Program Files\PostgreSQL\16\bin\pg_restore.exe" (
        set "PGRESTORE=C:\Program Files\PostgreSQL\16\bin\pg_restore.exe"
    ) else if exist "C:\Program Files\PostgreSQL\15\bin\pg_restore.exe" (
        set "PGRESTORE=C:\Program Files\PostgreSQL\15\bin\pg_restore.exe"
    ) else (
        echo       [ERROR] pg_restore not found!
        goto :skip_db_restore
    )
) else (
    set "PGRESTORE=pg_restore"
)

set "PGPASSWORD=%DB_PASSWORD%"

REM Drop and recreate database
echo       Dropping existing database...
psql -h %DB_HOST% -p %DB_PORT% -U %DB_USER% -c "DROP DATABASE IF EXISTS %DB_NAME%;" postgres 2>nul
psql -h %DB_HOST% -p %DB_PORT% -U %DB_USER% -c "CREATE DATABASE %DB_NAME%;" postgres 2>nul

echo       Restoring from dump...
"%PGRESTORE%" -h %DB_HOST% -p %DB_PORT% -U %DB_USER% -d %DB_NAME% "%DUMP_FILE%" 2>nul

if %errorlevel% equ 0 (
    echo       [OK] Database restored successfully!
) else (
    echo       [WARNING] Database restore completed with warnings
)

:skip_db_restore
echo.

echo [3/3] Project files available at:
echo       %RESTORE_DIR%\%SELECTED_BACKUP%\project
echo.
echo       To use: Copy files to C:\Users\NEW\garment-erp
echo       (Make sure to backup current files first!)
echo.

echo ============================================
echo   RESTORE COMPLETE!
echo ============================================
echo.
echo   Database: Restored to %DB_NAME%
echo   Files: %RESTORE_DIR%\%SELECTED_BACKUP%\project
echo.
echo   Next steps:
echo   1. Verify database: cd backend ^&^& npx prisma studio
echo   2. Copy project files if needed
echo   3. Restart application: npm run dev
echo.
echo ============================================
echo.

pause
