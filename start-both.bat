@echo off
echo Starting Both Servers...
echo.
echo Starting Backend Server in new window...
start "Backend Server" cmd /k "cd backend && npm run dev"

timeout /t 2 /nobreak > nul

echo Starting Frontend Server in new window...
start "Frontend Server" cmd /k "cd frontend && npm run dev"

echo.
echo Both servers are starting in separate windows.
echo Close those windows or press Ctrl+C in them to stop the servers.
