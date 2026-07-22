@echo off
REM ============================================
REM Run this as Administrator to schedule daily backup
REM ============================================

net session >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Please run as Administrator!
    echo.
    echo Right-click this file and select "Run as administrator"
    echo.
    pause
    exit /b 1
)

echo.
echo Creating scheduled task: GarmentERP_GoogleDriveBackup
echo Schedule: Daily at 7:00 PM
echo.

schtasks /delete /tn "GarmentERP_GoogleDriveBackup" /f >nul 2>&1
schtasks /create /tn "GarmentERP_GoogleDriveBackup" /tr "cmd.exe /c c:\Users\NEW\garment-erp\scripts\backup-to-google-drive.bat" /sc daily /st 19:00 /rl highest /f

if %errorlevel% equ 0 (
    echo.
    echo ============================================
    echo   SUCCESS! Daily backup scheduled.
    echo ============================================
    echo.
    echo   Time: 7:00 PM daily
    echo   Destination: Google Drive / Backups / garment-erp
    echo.
) else (
    echo.
    echo [ERROR] Failed to create task.
)

pause
