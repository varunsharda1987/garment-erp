@echo off
echo ========================================
echo Production Data Seeding Script
echo ========================================
echo.

echo Running TypeScript seed script...
ts-node scripts/seed-production-data.ts

echo.
echo ========================================
echo Seeding Complete!
echo ========================================
pause
