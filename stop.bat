@echo off
cd /d "%~dp0"
pm2 stop garment-erp-api garment-erp-web
echo Garment ERP stopped.
