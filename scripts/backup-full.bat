@echo off
REM ============================================
REM Garment ERP FULL Backup
REM Backs up to BOTH NAS and Google Drive
REM ============================================

setlocal enabledelayedexpansion

echo.
echo ============================================
echo   GARMENT ERP - FULL BACKUP
echo   NAS + Google Drive
echo   %date% %time%
echo ============================================
echo.

set "SCRIPT_DIR=%~dp0"
set "NAS_SUCCESS=0"
set "GDRIVE_SUCCESS=0"

REM Step 1: Backup to NAS
echo [STEP 1/2] Backing up to Synology NAS...
echo ----------------------------------------
echo.

if exist "\\synology\DATA STORAGE" (
    call "%SCRIPT_DIR%backup-to-nas.bat" <nul
    if %errorlevel% equ 0 (
        set "NAS_SUCCESS=1"
        echo [OK] NAS backup completed
    ) else (
        echo [WARN] NAS backup had issues
    )
) else (
    echo [SKIP] NAS not accessible - skipping
)

echo.
echo.

REM Step 2: Backup to Google Drive
echo [STEP 2/2] Backing up to Google Drive...
echo ----------------------------------------
echo.

where rclone >nul 2>nul
if %errorlevel% equ 0 (
    rclone listremotes | findstr /i "garment-erp-gdrive:" >nul 2>nul
    if %errorlevel% equ 0 (
        call "%SCRIPT_DIR%backup-to-google-drive.bat" <nul
        if %errorlevel% equ 0 (
            set "GDRIVE_SUCCESS=1"
            echo [OK] Google Drive backup completed
        ) else (
            echo [WARN] Google Drive backup had issues
        )
    ) else (
        echo [SKIP] Google Drive not configured
        echo        Run setup-google-drive-backup.bat to configure
    )
) else (
    echo [SKIP] rclone not installed
    echo        Run setup-google-drive-backup.bat to install
)

echo.
echo.

REM Summary
echo ============================================
echo   BACKUP SUMMARY
echo ============================================
echo.
if %NAS_SUCCESS%==1 (
    echo   [OK] NAS Backup: SUCCESS
) else (
    echo   [--] NAS Backup: SKIPPED or FAILED
)

if %GDRIVE_SUCCESS%==1 (
    echo   [OK] Google Drive: SUCCESS
) else (
    echo   [--] Google Drive: SKIPPED or FAILED
)
echo.
echo ============================================
echo.

pause
