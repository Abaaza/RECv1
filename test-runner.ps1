# Dental AI Receptionist Test Runner

Write-Host "Starting Dental AI Receptionist Test Suite..." -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

# Change to server directory
Set-Location "dental-ai-receptionist\server"

# Start the server in background
Write-Host "`nStarting backend server..." -ForegroundColor Yellow
$serverProcess = Start-Process node -ArgumentList "index.js" -PassThru -WindowStyle Hidden

# Wait for server to start
Write-Host "Waiting for server to initialize..." -ForegroundColor Yellow
Start-Sleep -Seconds 3

# Run tests
Write-Host "`nRunning API tests..." -ForegroundColor Green
node test.js

# Stop the server
Write-Host "`nStopping server..." -ForegroundColor Yellow
Stop-Process -Id $serverProcess.Id -Force -ErrorAction SilentlyContinue

Write-Host "`nTest completed!" -ForegroundColor Cyan
Write-Host "Press any key to continue..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")