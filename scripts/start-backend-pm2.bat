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

REM Locate PM2 by ABSOLUTE path, and never install it from here.
REM
REM This PC's PM2 daemon is SHARED by four businesses (garment-erp, kasya-b2b, harleen-b2b,
REM thar-coal, plus inward-web, ucip and redis). "where pm2" fails whenever %APPDATA%\npm is
REM off PATH - which is exactly what happens inside a Scheduled Task or a stripped shell - and
REM the old "npm install -g pm2" fallback would then pull a CLI NEWER than the running daemon.
REM A CLI/daemon version split forces "pm2 update", which kills and respawns the shared daemon
REM and restarts EVERY app on this machine. Fail loudly instead of doing that silently.
set "PM2=%APPDATA%\npm\pm2.cmd"
if not exist "%PM2%" (
    echo [ERROR] PM2 was not found at "%PM2%".
    echo         Do NOT install it from here - the PM2 daemon is shared with the other
    echo         businesses on this PC, and a version mismatch would restart all of them.
    echo         Install or repair PM2 deliberately from a normal shell, then re-run this.
    pause
    exit /b 1
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
call "%PM2%" startOrReload ecosystem.config.js --update-env

REM Save current process list so "pm2 resurrect" (Windows auto-start) brings back THIS fresh state on boot.
REM NOTE: "pm2 save" rewrites the boot list for the WHOLE fleet, not just garment-erp, and there is
REM no undo - a save taken while another business's app happens to be stopped or errored silently
REM drops it from the next boot. Keep a copy first.
echo [PM2] Saving process list...
if exist "%USERPROFILE%\.pm2\dump.pm2" copy /y "%USERPROFILE%\.pm2\dump.pm2" "%USERPROFILE%\.pm2\dump.pm2.bak" >nul
call "%PM2%" save

echo.
echo ============================================
echo Backend started successfully!
echo ============================================
echo.
echo Useful PM2 commands:
echo   pm2 status        - Check status
echo   pm2 logs          - View logs
echo   pm2 monit         - Monitor dashboard
echo   pm2 restart garment-erp-api   - Restart THIS app only
echo.
echo   Do NOT run "pm2 restart all", "pm2 reload all" or "pm2 kill" on this PC -
echo   the PM2 daemon is shared, so they bounce all four businesses at once.
echo   The safe restart path after a rebuild is:
echo     node C:\Users\NEW\ops\pm2-safe-restart.js garment-erp-api:5000
echo.
echo To auto-start on Windows boot:
echo   1. Press Win+R, type: shell:startup
echo   2. Create shortcut to this script
echo.

pause
