@echo off
cd /d "%~dp0"
pm2 start ecosystem.config.js
pm2 save
echo.
echo Garment ERP started. Access at http://localhost:3000
echo Use "pm2 status" to check, "pm2 logs" to view logs
