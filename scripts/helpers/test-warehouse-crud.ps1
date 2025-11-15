# Warehouse CRUD Operations Test
Write-Host "========================================"
Write-Host "WAREHOUSE CRUD OPERATIONS TEST"
Write-Host "========================================`n"

$baseUrl = "http://localhost:5000/api"

# Step 1: Login
Write-Host "[1/7] Logging in..." -ForegroundColor Cyan
$loginBody = @{
    email = "admin@kashayafabs.com"
    password = "Admin@123"
} | ConvertTo-Json

try {
    $loginResponse = Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method Post -Body $loginBody -ContentType "application/json"
    $token = $loginResponse.token
    Write-Host "SUCCESS: Logged in`n" -ForegroundColor Green
} catch {
    Write-Host "FAILED: Could not login - $($_.Exception.Message)`n" -ForegroundColor Red
    exit 1
}

$headers = @{
    "Authorization" = "Bearer $token"
    "Content-Type" = "application/json"
}

# Step 2: Get all warehouses (READ all)
Write-Host "[2/7] Testing GET /api/warehouses (READ all)" -ForegroundColor Cyan
try {
    $warehouses = Invoke-RestMethod -Uri "$baseUrl/warehouses" -Method Get -Headers $headers
    Write-Host "SUCCESS: Found $($warehouses.count) warehouses`n" -ForegroundColor Green
} catch {
    Write-Host "FAILED: $($_.Exception.Message)`n" -ForegroundColor Red
}

# Step 3: Generate warehouse code
Write-Host "[3/7] Testing warehouse code generation" -ForegroundColor Cyan
try {
    $codeResponse = Invoke-RestMethod -Uri "$baseUrl/warehouses/generate-code/RAW_MATERIAL" -Method Get -Headers $headers
    $newCode = $codeResponse.data.warehouseCode
    Write-Host "SUCCESS: Generated code: $newCode`n" -ForegroundColor Green
} catch {
    Write-Host "FAILED: $($_.Exception.Message)`n" -ForegroundColor Red
}

# Step 4: Create new warehouse (CREATE)
Write-Host "[4/7] Testing POST /api/warehouses (CREATE)" -ForegroundColor Cyan
$createBody = @{
    warehouseCode = $newCode
    warehouseName = "Test CRUD Warehouse"
    warehouseType = "RAW_MATERIAL"
    city = "Mumbai"
    isActive = $true
} | ConvertTo-Json

try {
    $createResponse = Invoke-RestMethod -Uri "$baseUrl/warehouses" -Method Post -Headers $headers -Body $createBody
    $newId = $createResponse.data.id
    Write-Host "SUCCESS: Created warehouse ID: $newId`n" -ForegroundColor Green
} catch {
    Write-Host "FAILED: $($_.Exception.Message)`n" -ForegroundColor Red
    exit 1
}

# Step 5: Get warehouse by ID (READ single)
Write-Host "[5/7] Testing GET /api/warehouses/:id (READ single)" -ForegroundColor Cyan
try {
    $readResponse = Invoke-RestMethod -Uri "$baseUrl/warehouses/$newId" -Method Get -Headers $headers
    Write-Host "SUCCESS: Found warehouse: $($readResponse.data.warehouseName)`n" -ForegroundColor Green
} catch {
    Write-Host "FAILED: $($_.Exception.Message)`n" -ForegroundColor Red
}

# Step 6: Update warehouse (UPDATE)
Write-Host "[6/7] Testing PUT /api/warehouses/:id (UPDATE)" -ForegroundColor Cyan
$updateBody = @{
    warehouseName = "Updated CRUD Warehouse"
    city = "Delhi"
} | ConvertTo-Json

try {
    $updateResponse = Invoke-RestMethod -Uri "$baseUrl/warehouses/$newId" -Method Put -Headers $headers -Body $updateBody
    Write-Host "SUCCESS: Updated warehouse to: $($updateResponse.data.warehouseName) in $($updateResponse.data.city)`n" -ForegroundColor Green
} catch {
    Write-Host "FAILED: $($_.Exception.Message)`n" -ForegroundColor Red
}

# Step 7: Delete warehouse (DELETE)
Write-Host "[7/7] Testing DELETE /api/warehouses/:id (DELETE)" -ForegroundColor Cyan
try {
    $deleteResponse = Invoke-RestMethod -Uri "$baseUrl/warehouses/$newId" -Method Delete -Headers $headers
    Write-Host "SUCCESS: Deleted warehouse`n" -ForegroundColor Green
} catch {
    Write-Host "FAILED: $($_.Exception.Message)`n" -ForegroundColor Red
}

Write-Host "========================================"
Write-Host "WAREHOUSE CRUD TEST COMPLETED"
Write-Host "========================================`n"
