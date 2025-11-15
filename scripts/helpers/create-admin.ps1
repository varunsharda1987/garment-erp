$body = @{
    email = "admin@kashayafabs.com"
    password = "Admin@123"
    firstName = "Admin"
    lastName = "User"
    role = "ADMIN"
} | ConvertTo-Json

$response = Invoke-RestMethod -Uri "http://localhost:5000/api/auth/register" -Method Post -ContentType "application/json" -Body $body

Write-Host "Admin user created successfully!" -ForegroundColor Green
Write-Host "Email: admin@kashayafabs.com"
Write-Host "Password: Admin@123"
Write-Host ""
Write-Host "You can now login at http://localhost:5173"
