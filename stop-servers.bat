@echo off
echo Stopping Development Servers...
echo.

REM Find and kill only the server processes (not all node.exe processes)
echo Looking for development server processes...

REM Kill processes listening on port 5173 (Vite/Frontend)
echo Checking port 5173 (Frontend)...
for /f "tokens=*" %%a in ('netstat -aon ^| findstr ":5173"') do (
    set "line=%%a"
    setlocal enabledelayedexpansion
    for %%b in (!line!) do (
        set "last=%%b"
    )
    if !last! neq 0 (
        echo   Stopping process !last! on port 5173...
        taskkill /F /PID !last! /T 2>nul
    )
    endlocal
)

REM Kill processes listening on port 3000 (Backend)
echo Checking port 3000 (Backend)...
for /f "tokens=*" %%a in ('netstat -aon ^| findstr ":3000"') do (
    set "line=%%a"
    setlocal enabledelayedexpansion
    for %%b in (!line!) do (
        set "last=%%b"
    )
    if !last! neq 0 (
        echo   Stopping process !last! on port 3000...
        taskkill /F /PID !last! /T 2>nul
    )
    endlocal
)

REM Alternative: Kill processes by window title (if started with start-both.bat)
echo Checking for window titles...
taskkill /FI "WindowTitle eq Backend Server*" /T 2>nul
taskkill /FI "WindowTitle eq Frontend Server*" /T 2>nul

REM Also check for common dev server process names
echo Checking for vite and tsx processes...
taskkill /F /IM "vite.exe" /T 2>nul
for /f "tokens=2" %%a in ('tasklist ^| findstr "node.exe"') do (
    for /f "tokens=*" %%b in ('wmic process where "processid=%%a" get commandline /format:list 2^>nul ^| findstr "vite\|tsx.*backend"') do (
        echo   Stopping dev server process %%a...
        taskkill /F /PID %%a /T 2>nul
    )
)

echo.
echo Development servers stopped.
echo (Other Node.js processes like Claude Code remain running)
echo.
pause
