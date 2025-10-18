@echo off
cls
echo ========================================
echo   KASHAYA FABS ERP - CONTROL CENTER
echo   Location: HOME
echo ========================================
echo.
echo [1] Start Backend Only
echo [2] Start Frontend Only
echo [3] Start Both Servers
echo [4] Run Frontend Tests
echo [5] Check System Status
echo [6] Stop All Servers
echo [Q] Quit
echo.
set /p choice=Enter your choice:

if "%choice%"=="1" goto backend
if "%choice%"=="2" goto frontend
if "%choice%"=="3" goto both
if "%choice%"=="4" goto tests
if "%choice%"=="5" goto status
if "%choice%"=="6" goto stop
if "%choice%"=="q" goto end
if "%choice%"=="Q" goto end
goto end

:backend
echo.
echo Starting Backend Server...
start cmd /k "cd backend && npm run dev"
goto end

:frontend
echo.
echo Starting Frontend Server...
start cmd /k "cd frontend && npm run dev"
goto end

:both
echo.
echo Starting Both Servers...
start "Backend Server" cmd /k "cd backend && npm run dev"
timeout /t 2 /nobreak >nul
start "Frontend Server" cmd /k "cd frontend && npm run dev"
echo.
echo Both servers are starting in separate windows...
goto end

:tests
echo.
echo Running Frontend E2E Tests...
cd frontend
call npm run test:e2e
pause
goto end

:status
echo.
echo Checking System Status...
echo.
echo Backend (Port 5000):
netstat -ano | findstr ":5000" | findstr "LISTENING"
if errorlevel 1 (
    echo   Status: STOPPED
) else (
    echo   Status: RUNNING
)
echo.
echo Frontend (Port 5173):
netstat -ano | findstr ":5173" | findstr "LISTENING"
if errorlevel 1 (
    echo   Status: STOPPED
) else (
    echo   Status: RUNNING
)
echo.
pause
goto end

:stop
echo.
echo Stopping all servers...
echo This will close server windows if running...
taskkill /FI "WINDOWTITLE eq Backend Server*" /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq Frontend Server*" /F >nul 2>&1
echo Done.
pause
goto end

:end
