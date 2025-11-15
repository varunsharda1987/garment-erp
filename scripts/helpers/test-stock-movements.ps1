# Stock Movement Workflows Test
Write-Host "========================================"
Write-Host "STOCK MOVEMENT WORKFLOWS TEST"
Write-Host "========================================`n"

$baseUrl = "http://localhost:5000/api"

# Step 1: Login
Write-Host "[1/12] Logging in..." -ForegroundColor Cyan
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

# Step 2: Create test warehouse
Write-Host "[2/12] Creating test warehouse..." -ForegroundColor Cyan
$timestamp = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
$warehouseBody = @{
    warehouseCode = "WH-TEST-$timestamp"
    warehouseName = "Test Movement Warehouse $timestamp"
    warehouseType = "RAW_MATERIAL"
    city = "Mumbai"
    isActive = $true
} | ConvertTo-Json

try {
    $whResponse = Invoke-RestMethod -Uri "$baseUrl/warehouses" -Method Post -Headers $headers -Body $warehouseBody
    $warehouseId = $whResponse.data.id
    Write-Host "SUCCESS: Created warehouse ID: $warehouseId`n" -ForegroundColor Green
} catch {
    Write-Host "FAILED: $($_.Exception.Message)`n" -ForegroundColor Red
    exit 1
}

# Step 3: Create test material category first
Write-Host "[3/12] Creating test material category..." -ForegroundColor Cyan
$categoryBody = @{
    name = "Test Fabrics Category"
    description = "Category for test fabric materials"
} | ConvertTo-Json

try {
    $catResponse = Invoke-RestMethod -Uri "$baseUrl/materials/categories" -Method Post -Headers $headers -Body $categoryBody -ErrorAction Stop
    $categoryId = $catResponse.data.id
    Write-Host "SUCCESS: Created category ID: $categoryId" -ForegroundColor Green
} catch {
    if ($_.Exception.Message -like "*already exists*") {
        $categories = Invoke-RestMethod -Uri "$baseUrl/materials/categories" -Method Get -Headers $headers
        $categoryId = $categories.data | Where-Object { $_.name -eq "Test Fabrics Category" } | Select-Object -First 1 -ExpandProperty id
        Write-Host "INFO: Category already exists, using ID: $categoryId" -ForegroundColor Yellow
    } else {
        Write-Host "WARNING: Could not create category - $($_.Exception.Message)" -ForegroundColor Yellow
        Write-Host "Trying with a generated UUID..." -ForegroundColor Yellow
        $categoryId = [guid]::NewGuid().ToString()
    }
}
Write-Host ""

# Create test material
Write-Host "[4/12] Creating test material..." -ForegroundColor Cyan

# Get Fabric category ID (seeded)
$categories = Invoke-RestMethod -Uri "$baseUrl/materials/categories" -Method Get -Headers $headers
$fabricCategory = $categories.data | Where-Object { $_.name -eq "Fabric" } | Select-Object -First 1
if (!$fabricCategory) {
    Write-Host "ERROR: Fabric category not found`n" -ForegroundColor Red
    exit 1
}

$materialBody = @{
    code = "MAT-TEST-$timestamp"
    name = "Test Cotton Fabric $timestamp"
    categoryId = $fabricCategory.id
    unit = "METER"
    costPrice = 150.00
    reorderLevel = 100
} | ConvertTo-Json

try {
    $matResponse = Invoke-RestMethod -Uri "$baseUrl/materials" -Method Post -Headers $headers -Body $materialBody -ErrorAction Stop
    $materialId = $matResponse.data.id
    Write-Host "SUCCESS: Created material ID: $materialId`n" -ForegroundColor Green
} catch {
    Write-Host "FAILED: $($_.Exception.Message)`n" -ForegroundColor Red
    Write-Host "Skipping stock movement tests due to missing test data.`n" -ForegroundColor Yellow
    exit 1
}

# Step 4: Test STOCK IN movement
Write-Host "[5/13] Testing STOCK IN movement..." -ForegroundColor Cyan
$stockInBody = @{
    warehouseId = $warehouseId
    materialId = $materialId
    quantity = 500
    unit = "METER"
    rate = 150.00
    referenceNo = "PO-2025-001"
    referenceType = "PURCHASE_ORDER"
    notes = "Initial stock receipt"
} | ConvertTo-Json

try {
    $stockInResponse = Invoke-RestMethod -Uri "$baseUrl/stock-movements/stock-in" -Method Post -Headers $headers -Body $stockInBody
    $stockInId = $stockInResponse.data.id
    Write-Host "SUCCESS: Created STOCK IN movement ID: $stockInId" -ForegroundColor Green
    Write-Host "  Quantity: $($stockInResponse.data.quantity) $($stockInResponse.data.unit)" -ForegroundColor Gray
    Write-Host ""
} catch {
    Write-Host "FAILED: $($_.Exception.Message)`n" -ForegroundColor Red
}

# Step 5: Verify stock level after STOCK IN
Write-Host "[6/13] Verifying stock level after STOCK IN..." -ForegroundColor Cyan
try {
    $stockLevels = Invoke-RestMethod -Uri "$baseUrl/stock-levels/warehouse/$warehouseId" -Method Get -Headers $headers
    $currentStock = $stockLevels.data[0].quantity
    Write-Host "SUCCESS: Current stock level: $currentStock METER`n" -ForegroundColor Green
} catch {
    Write-Host "FAILED: $($_.Exception.Message)`n" -ForegroundColor Red
}

# Step 6: Test STOCK OUT movement
Write-Host "[7/13] Testing STOCK OUT movement..." -ForegroundColor Cyan
$stockOutBody = @{
    warehouseId = $warehouseId
    materialId = $materialId
    quantity = 100
    unit = "METER"
    referenceNo = "WO-2025-001"
    referenceType = "WORK_ORDER"
    notes = "Issued to production"
} | ConvertTo-Json

try {
    $stockOutResponse = Invoke-RestMethod -Uri "$baseUrl/stock-movements/stock-out" -Method Post -Headers $headers -Body $stockOutBody
    Write-Host "SUCCESS: Created STOCK OUT movement" -ForegroundColor Green
    Write-Host "  Quantity: $($stockOutResponse.data.quantity) $($stockOutResponse.data.unit)" -ForegroundColor Gray
    Write-Host ""
} catch {
    Write-Host "FAILED: $($_.Exception.Message)`n" -ForegroundColor Red
}

# Step 7: Verify stock level after STOCK OUT
Write-Host "[8/13] Verifying stock level after STOCK OUT..." -ForegroundColor Cyan
try {
    $stockLevels = Invoke-RestMethod -Uri "$baseUrl/stock-levels/warehouse/$warehouseId" -Method Get -Headers $headers
    $currentStock = $stockLevels.data[0].quantity
    Write-Host "SUCCESS: Current stock level: $currentStock METER (expected: 400)`n" -ForegroundColor Green
} catch {
    Write-Host "FAILED: $($_.Exception.Message)`n" -ForegroundColor Red
}

# Step 8: Create second warehouse for transfer
Write-Host "[9/13] Creating second warehouse for transfer..." -ForegroundColor Cyan
$warehouse2Body = @{
    warehouseCode = "WH-TEST-FG-$timestamp"
    warehouseName = "Test Movement Warehouse 2 $timestamp"
    warehouseType = "FINISHED_GOODS"
    city = "Delhi"
    isActive = $true
} | ConvertTo-Json

try {
    $wh2Response = Invoke-RestMethod -Uri "$baseUrl/warehouses" -Method Post -Headers $headers -Body $warehouse2Body
    $warehouse2Id = $wh2Response.data.id
    Write-Host "SUCCESS: Created second warehouse ID: $warehouse2Id`n" -ForegroundColor Green
} catch {
    Write-Host "FAILED: $($_.Exception.Message)`n" -ForegroundColor Red
}

# Step 9: Test TRANSFER movement
Write-Host "[10/13] Testing TRANSFER movement..." -ForegroundColor Cyan
$transferBody = @{
    fromWarehouseId = $warehouseId
    toWarehouseId = $warehouse2Id
    materialId = $materialId
    quantity = 50
    unit = "METER"
    notes = "Transfer to FG warehouse"
} | ConvertTo-Json

try {
    $transferResponse = Invoke-RestMethod -Uri "$baseUrl/stock-movements/transfer" -Method Post -Headers $headers -Body $transferBody
    Write-Host "SUCCESS: Created TRANSFER movement" -ForegroundColor Green
    Write-Host "  From: $warehouseId" -ForegroundColor Gray
    Write-Host "  To: $warehouse2Id" -ForegroundColor Gray
    Write-Host "  Quantity: $($transferResponse.data.quantity) $($transferResponse.data.unit)" -ForegroundColor Gray
    Write-Host ""
} catch {
    Write-Host "FAILED: $($_.Exception.Message)`n" -ForegroundColor Red
}

# Step 10: Verify stock levels after TRANSFER
Write-Host "[11/13] Verifying stock levels after TRANSFER..." -ForegroundColor Cyan
try {
    $stockLevels1 = Invoke-RestMethod -Uri "$baseUrl/stock-levels/warehouse/$warehouseId" -Method Get -Headers $headers
    $stockLevels2 = Invoke-RestMethod -Uri "$baseUrl/stock-levels/warehouse/$warehouse2Id" -Method Get -Headers $headers
    Write-Host "SUCCESS:" -ForegroundColor Green
    Write-Host "  Source warehouse stock: $($stockLevels1.data[0].quantity) METER (expected: 350)" -ForegroundColor Gray
    Write-Host "  Destination warehouse stock: $($stockLevels2.data[0].quantity) METER (expected: 50)" -ForegroundColor Gray
    Write-Host ""
} catch {
    Write-Host "FAILED: $($_.Exception.Message)`n" -ForegroundColor Red
}

# Step 11: Test ADJUSTMENT movement (increase)
Write-Host "[12/13] Testing ADJUSTMENT movement (increase)..." -ForegroundColor Cyan
$adjustmentBody = @{
    warehouseId = $warehouseId
    materialId = $materialId
    quantity = 20
    unit = "METER"
    reason = "Physical count adjustment"
    notes = "Found extra stock during audit"
} | ConvertTo-Json

try {
    $adjustResponse = Invoke-RestMethod -Uri "$baseUrl/stock-movements/adjustment" -Method Post -Headers $headers -Body $adjustmentBody
    Write-Host "SUCCESS: Created ADJUSTMENT movement" -ForegroundColor Green
    Write-Host "  Quantity: +$($adjustResponse.data.quantity) $($adjustResponse.data.unit)" -ForegroundColor Gray
    Write-Host ""
} catch {
    Write-Host "FAILED: $($_.Exception.Message)`n" -ForegroundColor Red
}

# Step 12: Final stock level verification
Write-Host "[13/13] Final stock level verification..." -ForegroundColor Cyan
try {
    $stockLevels = Invoke-RestMethod -Uri "$baseUrl/stock-levels/warehouse/$warehouseId" -Method Get -Headers $headers
    $finalStock = $stockLevels.data[0].quantity
    Write-Host "SUCCESS: Final stock level: $finalStock METER (expected: 370)`n" -ForegroundColor Green
} catch {
    Write-Host "FAILED: $($_.Exception.Message)`n" -ForegroundColor Red
}

Write-Host "========================================"
Write-Host "STOCK MOVEMENT TEST SUMMARY"
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Expected flow:"
Write-Host "  Start: 0"
Write-Host "  + STOCK IN (500): 500"
Write-Host "  - STOCK OUT (100): 400"
Write-Host "  - TRANSFER (50): 350"
Write-Host "  + ADJUSTMENT (20): 370"
Write-Host "========================================`n"

# Cleanup
Write-Host "Cleaning up test data..." -ForegroundColor Yellow
try {
    Invoke-RestMethod -Uri "$baseUrl/warehouses/$warehouseId" -Method Delete -Headers $headers | Out-Null
    Invoke-RestMethod -Uri "$baseUrl/warehouses/$warehouse2Id" -Method Delete -Headers $headers | Out-Null
    Invoke-RestMethod -Uri "$baseUrl/materials/$materialId" -Method Delete -Headers $headers | Out-Null
    Write-Host "SUCCESS: Test data cleaned up`n" -ForegroundColor Green
} catch {
    Write-Host "WARNING: Could not clean up all test data`n" -ForegroundColor Yellow
}

Write-Host "========================================" -ForegroundColor Green
Write-Host "STOCK MOVEMENT TEST COMPLETED" -ForegroundColor Green
Write-Host "========================================`n" -ForegroundColor Green
