@echo off
REM ============================================
REM Garment ERP - (re)deploy
REM ============================================
REM Deploys are done by the deployer (PM2 app garment-erp-deployer, scripts\ship\deployer.js),
REM which ships the COMMITTED main branch, one deploy at a time.
REM
REM This script used to build the shared working folder and restart the apps. With several Claude
REM terminals editing that folder at once, that shipped their unfinished edits (2026-09-26). It
REM now asks the deployer to (re)ship main and waits for the result.
REM ============================================

cd /d "%~dp0"
node scripts\ship\ship.js now
echo.
pause
