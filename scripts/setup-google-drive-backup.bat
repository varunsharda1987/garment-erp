@echo off
REM ============================================
REM Setup Google Drive Backup with rclone
REM Run this ONCE to configure Google Drive
REM ============================================

echo.
echo ============================================
echo   GOOGLE DRIVE BACKUP SETUP
echo ============================================
echo.

REM Check if rclone is installed
where rclone >nul 2>nul
if %errorlevel% neq 0 (
    echo [Step 1] rclone not found. Installing via winget...
    echo.
    winget install Rclone.Rclone -e --silent

    if %errorlevel% neq 0 (
        echo.
        echo [ERROR] Failed to install rclone via winget.
        echo Please install manually from: https://rclone.org/downloads/
        echo.
        echo After installing, run this script again.
        pause
        exit /b 1
    )

    echo [OK] rclone installed successfully!
    echo.
    echo Please RESTART this script to continue setup.
    pause
    exit /b 0
)

echo [OK] rclone is installed
echo.

REM Check if garment-erp-gdrive remote already exists
rclone listremotes | findstr /i "garment-erp-gdrive:" >nul 2>nul
if %errorlevel% equ 0 (
    echo [OK] Google Drive remote "garment-erp-gdrive" already configured!
    echo.
    echo To reconfigure, run: rclone config delete garment-erp-gdrive
    echo Then run this script again.
    echo.
    goto :test_connection
)

echo [Step 2] Configuring Google Drive connection...
echo.
echo This will open a browser window to authenticate with Google.
echo.
echo IMPORTANT:
echo   - Sign in with the Google account where backups should be stored
echo   - Grant rclone access to Google Drive
echo   - The backup folder will be created at: Backups/garment-erp/
echo.
pause

REM Create rclone config for Google Drive
rclone config create garment-erp-gdrive drive scope=drive.file

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Failed to configure Google Drive!
    echo.
    echo Try manual configuration:
    echo   rclone config
    echo   - Choose "n" for new remote
    echo   - Name: garment-erp-gdrive
    echo   - Type: drive (Google Drive)
    echo   - Follow prompts
    echo.
    pause
    exit /b 1
)

echo.
echo [OK] Google Drive configured successfully!
echo.

:test_connection
echo [Step 3] Testing connection...
echo.

REM Create backup folder in Google Drive
rclone mkdir garment-erp-gdrive:Backups/garment-erp 2>nul

REM Test by listing the folder
rclone lsd garment-erp-gdrive:Backups >nul 2>nul
if %errorlevel% equ 0 (
    echo [OK] Connection successful!
    echo.
    echo Backup folder created: Google Drive/Backups/garment-erp/
    echo.
) else (
    echo [WARNING] Could not verify connection.
    echo Please check your Google Drive for the Backups folder.
    echo.
)

echo ============================================
echo   SETUP COMPLETE!
echo ============================================
echo.
echo Next steps:
echo   1. Run backup-to-google-drive.bat to test a backup
echo   2. Run setup-scheduled-backup-gdrive.bat to schedule daily backups
echo.
echo Your backups will be stored in:
echo   Google Drive / Backups / garment-erp / [date] /
echo.
pause
