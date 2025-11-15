@echo off
echo Testing Stock Dashboard API Integration
echo.

REM Step 1: Login
echo 1. Logging in to get auth token...
curl -s -X POST http://localhost:5000/api/auth/login ^
  -H "Content-Type: application/json" ^
  -d "{\"email\":\"admin@kashayafabs.com\",\"password\":\"admin123\"}" > temp_login.json

REM Extract token using PowerShell
powershell -Command "(Get-Content temp_login.json | ConvertFrom-Json).token" > temp_token.txt
set /p TOKEN=<temp_token.txt

if "%TOKEN%"=="" (
  echo Failed to get auth token
  type temp_login.json
  goto :cleanup
)

echo Login successful!
echo.

REM Step 2: Test Warehouses
echo 2. Testing GET /api/warehouses?isActive=true
curl -s http://localhost:5000/api/warehouses?isActive=true ^
  -H "Authorization: Bearer %TOKEN%" > temp_warehouses.json
echo Response saved to temp_warehouses.json
type temp_warehouses.json
echo.
echo.

REM Step 3: Test Stock Levels
echo 3. Testing GET /api/stock-levels
curl -s http://localhost:5000/api/stock-levels ^
  -H "Authorization: Bearer %TOKEN%" > temp_stocklevels.json
echo Response saved to temp_stocklevels.json
type temp_stocklevels.json
echo.
echo.

REM Step 4: Test Low Stock
echo 4. Testing GET /api/stock-levels/below-reorder
curl -s http://localhost:5000/api/stock-levels/below-reorder ^
  -H "Authorization: Bearer %TOKEN%" > temp_lowstock.json
echo Response saved to temp_lowstock.json
type temp_lowstock.json
echo.
echo.

REM Step 5: Test Valuation
echo 5. Testing GET /api/stock-levels/valuation
curl -s http://localhost:5000/api/stock-levels/valuation ^
  -H "Authorization: Bearer %TOKEN%" > temp_valuation.json
echo Response saved to temp_valuation.json
type temp_valuation.json
echo.
echo.

echo All tests completed!

:cleanup
del temp_login.json temp_token.txt 2>nul
