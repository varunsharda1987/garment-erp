@echo off
REM ============================================
REM Setup Windows Auto-Start for Garment ERP
REM ============================================

echo ============================================
echo Setting up Windows Auto-Start
echo ============================================

REM Check for admin privileges
net session >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] This script requires Administrator privileges.
    echo Please right-click and "Run as administrator"
    pause
    exit /b 1
)

set TASK_NAME=GarmentERPBackend
set PROJECT_PATH=%~dp0..

REM Check if PM2 is installed
where pm2 >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] PM2 is not installed.
    pause
    exit /b 1
)

REM Delete existing task if it exists
schtasks /delete /tn "%TASK_NAME%" /f >nul 2>&1

REM Create the task
echo [TASK] Creating scheduled task: %TASK_NAME%

schtasks /create /tn "%TASK_NAME%" /tr "cmd /c cd /d \"%PROJECT_PATH%\" && pm2 resurrect" /sc onlogon /rl highest /f >nul 2>&1

if errorlevel 1 (
    echo [ERROR] Failed to create scheduled task.
    echo Try running this script as Administrator.
    pause
    exit /b 1
)

echo.
echo ============================================
echo SUCCESS! Auto-start configured.
echo ============================================
echo.
echo Task Name: %TASK_NAME%
echo Trigger: On user logon
echo Action: pm2 resurrect (restores saved processes)
echo.
echo PM2 process list already saved - you're all set!
echo.
pause
