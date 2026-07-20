@echo off
REM ============================================
REM Garment ERP Backend - PM2 Auto-Start Script
REM ============================================
REM This script ensures the backend runs continuously
REM with automatic restart on crash and zero downtime
REM ============================================

cd /d "%~dp0.."

echo ============================================
echo Garment ERP Backend - PM2 Startup
echo ============================================

REM Check if PM2 is installed
where pm2 >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [SETUP] Installing PM2 globally...
    call npm install -g pm2
    if %ERRORLEVEL% NEQ 0 (
        echo [ERROR] Failed to install PM2. Please run as Administrator.
        pause
        exit /b 1
    )
)

REM ALWAYS rebuild so PM2 never runs a stale compiled dist. The old guard only built when
REM backend\dist\server.js was MISSING, so after the very first build it never recompiled again and
REM every later source change silently never went live. That was the stale-code mechanism.
echo [BUILD] Building backend fresh (always, so the running server matches the source)...
cd backend
call npm run build
cd ..
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Build failed!
    pause
    exit /b 1
)

REM Create logs directory if it doesn't exist
if not exist "backend\logs" mkdir "backend\logs"

REM Start OR RELOAD from the ecosystem config. "startOrReload" guarantees an already-running app is
REM reloaded to pick up the freshly-built dist. Plain "pm2 start ecosystem.config.js" leaves a running
REM app untouched (so the new build never loads), and the old "pm2 delete garment-erp-backend" used the
REM wrong name (the app is garment-erp-api) so it never actually stopped anything — both let stale code run.
echo [PM2] Starting/reloading backend with PM2 (loads the fresh build)...
call pm2 startOrReload ecosystem.config.js --update-env

REM Save current process list so "pm2 resurrect" (Windows auto-start) brings back THIS fresh state on boot
echo [PM2] Saving process list...
call pm2 save

echo.
echo ============================================
echo Backend started successfully!
echo ============================================
echo.
echo Useful PM2 commands:
echo   pm2 status        - Check status
echo   pm2 logs          - View logs
echo   pm2 monit         - Monitor dashboard
echo   pm2 restart all   - Restart all apps
echo   pm2 reload all    - Zero-downtime reload
echo.
echo To auto-start on Windows boot:
echo   1. Press Win+R, type: shell:startup
echo   2. Create shortcut to this script
echo.

pause
