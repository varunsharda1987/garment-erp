@echo off
setlocal enabledelayedexpansion

echo ========================================
echo WAREHOUSE CRUD OPERATIONS TEST
echo ========================================
echo.

REM Step 1: Login
echo [1/7] Logging in to get auth token...
curl -s -X POST http://localhost:5000/api/auth/login ^
  -H "Content-Type: application/json" ^
  -d "{\"email\":\"admin@kashayafabs.com\",\"password\":\"Admin@123\"}" > temp_login.json

powershell -Command "(Get-Content temp_login.json | ConvertFrom-Json).token" > temp_token.txt
set /p TOKEN=<temp_token.txt

if "!TOKEN!"=="" (
  echo FAILED: Could not get auth token
  type temp_login.json
  goto cleanup
)
echo SUCCESS: Logged in
echo.

REM Step 2: Get all warehouses (READ)
echo [2/7] Testing GET /api/warehouses (READ all)
curl -s "http://localhost:5000/api/warehouses" ^
  -H "Authorization: Bearer !TOKEN!" > temp_list.json
powershell -Command "$data = Get-Content temp_list.json | ConvertFrom-Json; Write-Host ('SUCCESS: Found ' + $data.count + ' warehouses')"
echo.

REM Step 3: Generate warehouse code
echo [3/7] Testing warehouse code generation
curl -s "http://localhost:5000/api/warehouses/generate-code/RAW_MATERIAL" ^
  -H "Authorization: Bearer !TOKEN!" > temp_code.json
powershell -Command "$data = Get-Content temp_code.json | ConvertFrom-Json; Write-Host ('SUCCESS: Generated code: ' + $data.data.warehouseCode); $data.data.warehouseCode" > temp_newcode.txt
set /p NEWCODE=<temp_newcode.txt
echo.

REM Step 4: Create new warehouse (CREATE)
echo [4/7] Testing POST /api/warehouses (CREATE)
curl -s -X POST "http://localhost:5000/api/warehouses" ^
  -H "Authorization: Bearer !TOKEN!" ^
  -H "Content-Type: application/json" ^
  -d "{\"warehouseCode\":\"!NEWCODE!\",\"warehouseName\":\"Test CRUD Warehouse\",\"warehouseType\":\"RAW_MATERIAL\",\"city\":\"Mumbai\",\"isActive\":true}" > temp_create.json

powershell -Command "$data = Get-Content temp_create.json | ConvertFrom-Json; if ($data.success) { Write-Host ('SUCCESS: Created warehouse ID: ' + $data.data.id); $data.data.id } else { Write-Host ('FAILED: ' + $data.message) }" > temp_newid.txt
set /p NEWID=<temp_newid.txt
echo.

REM Step 5: Get warehouse by ID (READ single)
echo [5/7] Testing GET /api/warehouses/:id (READ single)
curl -s "http://localhost:5000/api/warehouses/!NEWID!" ^
  -H "Authorization: Bearer !TOKEN!" > temp_read.json
powershell -Command "$data = Get-Content temp_read.json | ConvertFrom-Json; if ($data.success) { Write-Host ('SUCCESS: Found warehouse: ' + $data.data.warehouseName) } else { Write-Host ('FAILED: ' + $data.message) }"
echo.

REM Step 6: Update warehouse (UPDATE)
echo [6/7] Testing PUT /api/warehouses/:id (UPDATE)
curl -s -X PUT "http://localhost:5000/api/warehouses/!NEWID!" ^
  -H "Authorization: Bearer !TOKEN!" ^
  -H "Content-Type: application/json" ^
  -d "{\"warehouseName\":\"Updated CRUD Warehouse\",\"city\":\"Delhi\"}" > temp_update.json
powershell -Command "$data = Get-Content temp_update.json | ConvertFrom-Json; if ($data.success) { Write-Host ('SUCCESS: Updated warehouse to: ' + $data.data.warehouseName + ' in ' + $data.data.city) } else { Write-Host ('FAILED: ' + $data.message) }"
echo.

REM Step 7: Delete warehouse (DELETE)
echo [7/7] Testing DELETE /api/warehouses/:id (DELETE)
curl -s -X DELETE "http://localhost:5000/api/warehouses/!NEWID!" ^
  -H "Authorization: Bearer !TOKEN!" > temp_delete.json
powershell -Command "$data = Get-Content temp_delete.json | ConvertFrom-Json; if ($data.success) { Write-Host 'SUCCESS: Deleted warehouse' } else { Write-Host ('FAILED: ' + $data.message) }"
echo.

echo ========================================
echo WAREHOUSE CRUD TEST COMPLETED
echo ========================================

:cleanup
del temp_*.json temp_*.txt 2>nul
endlocal
