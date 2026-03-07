@echo off
REM ============================================
REM Garment ERP Restore Script
REM Restores project files and database from Z:\
REM ============================================

setlocal enabledelayedexpansion

REM Configuration
set "TARGET_DIR=C:\Users\NEW\garment-erp"
REM Using UNC path instead of Z:\ so it works when running as Administrator
set "BACKUP_ROOT=\\synology\DATA STORAGE\Backups\garment-erp"
set "DB_NAME=garment_erp"
set "DB_USER=postgres"
set "DB_PASSWORD=postgres"
set "DB_HOST=localhost"
set "DB_PORT=5432"

echo.
echo ============================================
echo   GARMENT ERP RESTORE
echo   %date% %time%
echo ============================================
echo.
echo [WARNING] This will restore files and database from backup!
echo.

REM Check if network path is accessible
if not exist "\\synology\DATA STORAGE" (
    echo [ERROR] Network path \\synology\DATA STORAGE is not accessible!
    pause
    exit /b 1
)

REM List available backups
echo Available backups:
echo ------------------
set count=0
for /f "tokens=*" %%d in ('dir /b /ad /o-d "%BACKUP_ROOT%" 2^>nul') do (
    set /a count+=1
    echo !count!. %%d
    set "backup_!count!=%%d"
)

if %count%==0 (
    echo No backups found in %BACKUP_ROOT%
    pause
    exit /b 1
)

echo.
set /p choice="Enter backup number to restore (1-%count%): "

REM Validate choice
set "selected_backup=!backup_%choice%!"
if "%selected_backup%"=="" (
    echo Invalid selection!
    pause
    exit /b 1
)

set "RESTORE_DIR=%BACKUP_ROOT%\%selected_backup%"
echo.
echo Selected backup: %selected_backup%
echo Location: %RESTORE_DIR%
echo.

REM Confirm restore
echo What would you like to restore?
echo 1. Project files only
echo 2. Database only
echo 3. Both project files and database
echo 4. Cancel
echo.
set /p restore_choice="Enter choice (1-4): "

if "%restore_choice%"=="4" (
    echo Restore cancelled.
    pause
    exit /b 0
)

REM Restore project files
if "%restore_choice%"=="1" goto :restore_files
if "%restore_choice%"=="3" goto :restore_files
goto :check_db_restore

:restore_files
echo.
echo [1/2] Restoring project files...
echo       [WARNING] This will overwrite existing files!
set /p confirm="Are you sure? (Y/N): "
if /i not "%confirm%"=="Y" (
    echo Skipping file restore.
    goto :check_db_restore
)

REM Backup current node_modules location (don't overwrite)
echo       Copying files (preserving node_modules)...
robocopy "%RESTORE_DIR%\project" "%TARGET_DIR%" /E /XD node_modules .git /XF .env.local /NFL /NDL /NJH /NJS /NC /NS /NP

if %errorlevel% leq 7 (
    echo       Done: Project files restored
) else (
    echo       [WARNING] Some files may not have been restored
)

:check_db_restore
if "%restore_choice%"=="1" goto :done
if "%restore_choice%"=="2" goto :restore_db
if "%restore_choice%"=="3" goto :restore_db
goto :done

:restore_db
echo.
echo [2/2] Restoring database...
echo       [WARNING] This will DROP and recreate the database!
set /p confirm_db="Are you ABSOLUTELY sure? All current data will be lost! (YES/N): "
if /i not "%confirm_db%"=="YES" (
    echo Skipping database restore.
    goto :done
)

set "PGPASSWORD=%DB_PASSWORD%"

REM Find pg_restore
where pg_restore >nul 2>nul
if %errorlevel% neq 0 (
    if exist "C:\Program Files\PostgreSQL\16\bin\pg_restore.exe" (
        set "PGRESTORE=C:\Program Files\PostgreSQL\16\bin\pg_restore.exe"
        set "PSQL=C:\Program Files\PostgreSQL\16\bin\psql.exe"
    ) else if exist "C:\Program Files\PostgreSQL\15\bin\pg_restore.exe" (
        set "PGRESTORE=C:\Program Files\PostgreSQL\15\bin\pg_restore.exe"
        set "PSQL=C:\Program Files\PostgreSQL\15\bin\psql.exe"
    ) else (
        echo       [ERROR] PostgreSQL tools not found!
        goto :done
    )
) else (
    set "PGRESTORE=pg_restore"
    set "PSQL=psql"
)

REM Find database backup file
for /f "tokens=*" %%f in ('dir /b "%RESTORE_DIR%\database\*.dump" 2^>nul') do set "DB_FILE=%%f"

if "%DB_FILE%"=="" (
    echo       [ERROR] No database backup found!
    goto :done
)

echo       Backup file: %DB_FILE%
echo       Dropping and recreating database...

REM Drop and recreate database
"%PSQL%" -h %DB_HOST% -p %DB_PORT% -U %DB_USER% -c "DROP DATABASE IF EXISTS %DB_NAME%;" postgres 2>nul
"%PSQL%" -h %DB_HOST% -p %DB_PORT% -U %DB_USER% -c "CREATE DATABASE %DB_NAME%;" postgres 2>nul

echo       Restoring data...
"%PGRESTORE%" -h %DB_HOST% -p %DB_PORT% -U %DB_USER% -d %DB_NAME% "%RESTORE_DIR%\database\%DB_FILE%" 2>nul

if %errorlevel% equ 0 (
    echo       Done: Database restored
) else (
    echo       [WARNING] Database restore may have had issues
)

:done
echo.
echo ============================================
echo   RESTORE COMPLETE!
echo ============================================
echo.
echo Next steps:
echo 1. If you restored project files:
echo    - Run: cd frontend ^&^& npm install
echo    - Run: cd backend ^&^& npm install
echo 2. If you restored database:
echo    - Run: cd backend ^&^& npx prisma generate
echo 3. Start the servers:
echo    - Frontend: cd frontend ^&^& npm run dev
echo    - Backend: cd backend ^&^& npm run dev
echo.
pause
