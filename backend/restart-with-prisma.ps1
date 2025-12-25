# Stop any running node processes for the backend
Write-Host "Stopping backend server..." -ForegroundColor Yellow
Get-Process node -ErrorAction SilentlyContinue | Where-Object { $_.Path -like "*garment-erp*backend*" } | Stop-Process -Force

# Wait a moment for processes to fully stop
Start-Sleep -Seconds 2

# Regenerate Prisma client
Write-Host "Regenerating Prisma client..." -ForegroundColor Cyan
Set-Location "c:\Users\NEW\garment-erp\backend"
npx prisma generate

if ($LASTEXITCODE -eq 0) {
    Write-Host "Prisma client regenerated successfully!" -ForegroundColor Green
    Write-Host "Starting backend server..." -ForegroundColor Cyan
    npm run dev
} else {
    Write-Host "Failed to regenerate Prisma client!" -ForegroundColor Red
}
