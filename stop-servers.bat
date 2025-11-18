@echo off
echo Stopping All Node.js Servers...
echo.

echo Killing all node.exe processes...
taskkill /F /IM node.exe 2>nul

if %errorlevel% equ 0 (
    echo Successfully stopped all Node.js servers.
) else (
    echo No Node.js servers were running.
)

echo.
pause
