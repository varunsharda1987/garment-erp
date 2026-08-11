@echo off
REM ============================================
REM Garment ERP - Full Rebuild Script
REM ============================================
REM Rebuilds frontend and backend, restarts PM2
REM ============================================

cd /d "%~dp0"

echo ============================================
echo Garment ERP - Full Rebuild
echo ============================================
echo.

REM Step 1: Build frontend
echo [1/5] Building frontend...
cd frontend
call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Frontend build failed!
    pause
    exit /b 1
)
cd ..

REM Step 2: Stop API (Windows DLL lock workaround for prisma)
echo [2/5] Stopping API for Prisma generate...
call pm2 stop garment-erp-api 2>nul

REM Step 3: Regenerate Prisma client
echo [3/5] Regenerating Prisma client...
cd backend
call npx prisma generate
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Prisma generate failed!
    pause
    exit /b 1
)

REM Step 4: Build backend
echo [4/5] Building backend...
call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Backend build failed!
    pause
    exit /b 1
)
cd ..

REM Step 5: Restart both apps
REM Uses the shared safe-restart helper (stop -> wait for port -> kill verified stale fork ->
REM start -> confirm the port owner matches PM2's pid). A plain "pm2 restart" here can race
REM PM2's Windows kill and orphan the old fork, which then holds the port while the tracked
REM copy crash-loops on EADDRINUSE. See C:\Users\NEW\ops\pm2-safe-restart.js
echo [5/5] Restarting PM2 apps (safe sequence)...
call node C:\Users\NEW\ops\pm2-safe-restart.js garment-erp-api:5000 garment-erp-web:3000
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Safe restart reported a problem - NOT running pm2 save.
    echo         Check: pm2 logs garment-erp-api
    pause
    exit /b 1
)
call pm2 save

echo.
echo ============================================
echo Rebuild complete!
echo Access at http://localhost:3000
echo ============================================
echo.
pause
