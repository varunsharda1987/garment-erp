@echo off
REM ============================================
REM Setup Daily Backup Scheduled Task
REM Run this script as Administrator
REM ============================================

echo.
echo ============================================
echo   SETUP DAILY BACKUP - 7:00 PM
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

echo Creating scheduled task...
echo.

schtasks /create /tn "GarmentERP_DailyBackup" /tr "cmd.exe /c c:\Users\NEW\garment-erp\scripts\backup-to-nas.bat" /sc daily /st 19:00 /rl highest /f

if %errorlevel% equ 0 (
    echo.
    echo ============================================
    echo   SUCCESS!
    echo ============================================
    echo.
    echo Scheduled task created:
    echo   Name: GarmentERP_DailyBackup
    echo   Time: 7:00 PM daily
    echo   Script: backup-to-nas.bat
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
