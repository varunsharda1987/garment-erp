@echo off
REM ============================================
REM Setup Daily Google Drive Backup Scheduled Task
REM Run this script as Administrator
REM ============================================

echo.
echo ============================================
echo   SETUP DAILY GOOGLE DRIVE BACKUP
echo ============================================
echo.

REM Check for admin rights
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Please run this script as Administrator!
    echo.
    echo Right-click this file and select "Run as administrator"
    echo.
    pause
    exit /b 1
)

REM Check if rclone is configured
where rclone >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] rclone not found!
    echo Please run setup-google-drive-backup.bat first.
    pause
    exit /b 1
)

rclone listremotes | findstr /i "garment-erp-gdrive:" >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Google Drive not configured!
    echo Please run setup-google-drive-backup.bat first.
    pause
    exit /b 1
)

echo Choose backup time:
echo   1. 7:00 PM (19:00) - After work hours
echo   2. 2:00 AM (02:00) - Night backup
echo   3. 12:00 PM (12:00) - Midday backup
echo   4. Custom time
echo.
set /p choice="Enter choice (1-4): "

if "%choice%"=="1" set "BACKUP_TIME=19:00"
if "%choice%"=="2" set "BACKUP_TIME=02:00"
if "%choice%"=="3" set "BACKUP_TIME=12:00"
if "%choice%"=="4" (
    set /p BACKUP_TIME="Enter time in HH:MM format (24-hour): "
)

if "%BACKUP_TIME%"=="" set "BACKUP_TIME=19:00"

echo.
echo Creating scheduled task for %BACKUP_TIME%...
echo.

REM Delete existing task if present
schtasks /delete /tn "GarmentERP_GoogleDriveBackup" /f >nul 2>nul

REM Create new task
schtasks /create /tn "GarmentERP_GoogleDriveBackup" /tr "cmd.exe /c c:\Users\NEW\garment-erp\scripts\backup-to-google-drive.bat" /sc daily /st %BACKUP_TIME% /rl highest /f

if %errorlevel% equ 0 (
    echo.
    echo ============================================
    echo   SUCCESS!
    echo ============================================
    echo.
    echo Scheduled task created:
    echo   Name: GarmentERP_GoogleDriveBackup
    echo   Time: %BACKUP_TIME% daily
    echo   Script: backup-to-google-drive.bat
    echo.
    echo Backups will be stored in:
    echo   Google Drive / Backups / garment-erp / [date] /
    echo.
    echo To view/modify: Open Task Scheduler
    echo   Start Menu ^> Search "Task Scheduler"
    echo   Look under "Task Scheduler Library"
    echo.
) else (
    echo.
    echo [ERROR] Failed to create scheduled task!
    echo.
)

pause
