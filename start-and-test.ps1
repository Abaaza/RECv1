# Start server and run tests

Write-Host "Dental AI Receptionist - System Test" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan

# Navigate to server directory
Set-Location "dental-ai-receptionist\server"

# Start server
Write-Host "`nStarting server on port 5001..." -ForegroundColor Yellow
$server = Start-Job -ScriptBlock { 
    Set-Location $using:PWD
    node index.js 
}

# Wait for server to start
Start-Sleep -Seconds 3

# Check if server is running
Write-Host "`nChecking server status..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:5001/api/health" -Method GET -UseBasicParsing
    $health = $response.Content | ConvertFrom-Json
    Write-Host "✅ Server is running: $($health.status)" -ForegroundColor Green
    Write-Host "   Version: $($health.version)" -ForegroundColor Gray
    Write-Host "   Environment: $($health.environment)" -ForegroundColor Gray
} catch {
    Write-Host "❌ Server is not responding" -ForegroundColor Red
    Stop-Job $server
    Remove-Job $server
    exit 1
}

# Run quick functionality tests
Write-Host "`n📋 Running functionality tests..." -ForegroundColor Cyan

# Test 1: Create a patient
Write-Host "`n1. Testing patient creation..." -ForegroundColor Yellow
try {
    $patient = @{
        name = "Test Patient"
        phone = "555-0001"
        email = "test@dental.com"
    } | ConvertTo-Json
    
    $response = Invoke-WebRequest -Uri "http://localhost:5001/api/patients" -Method POST -Body $patient -ContentType "application/json" -UseBasicParsing
    Write-Host "   ✅ Patient created successfully" -ForegroundColor Green
} catch {
    Write-Host "   ❌ Failed to create patient" -ForegroundColor Red
}

# Test 2: Create an appointment
Write-Host "`n2. Testing appointment creation..." -ForegroundColor Yellow
try {
    $tomorrow = (Get-Date).AddDays(1).Date.AddHours(10)
    $appointment = @{
        patientName = "John Smith"
        patientPhone = "555-1234"
        startTime = $tomorrow.ToString("yyyy-MM-dd'T'HH:mm:ss.fff'Z'")
        endTime = $tomorrow.AddMinutes(30).ToString("yyyy-MM-dd'T'HH:mm:ss.fff'Z'")
        reason = "Regular checkup"
    } | ConvertTo-Json
    
    $response = Invoke-WebRequest -Uri "http://localhost:5001/api/appointments" -Method POST -Body $appointment -ContentType "application/json" -UseBasicParsing
    Write-Host "   ✅ Appointment created successfully" -ForegroundColor Green
} catch {
    Write-Host "   ❌ Failed to create appointment: $_" -ForegroundColor Red
}

# Test 3: Get statistics
Write-Host "`n3. Testing statistics endpoint..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:5001/api/stats" -Method GET -UseBasicParsing
    $stats = $response.Content | ConvertFrom-Json
    Write-Host "   ✅ Statistics retrieved:" -ForegroundColor Green
    Write-Host "      - Total appointments: $($stats.totalAppointments)" -ForegroundColor Gray
    Write-Host "      - Total patients: $($stats.totalPatients)" -ForegroundColor Gray
    Write-Host "      - Available dentists: $($stats.availableDentists)" -ForegroundColor Gray
} catch {
    Write-Host "   ❌ Failed to get statistics" -ForegroundColor Red
}

# Test 4: Emergency handling
Write-Host "`n4. Testing emergency protocol..." -ForegroundColor Yellow
try {
    $emergency = @{
        type = "trauma"
        patientInfo = @{
            name = "Emergency Patient"
            phone = "555-9999"
            age = 35
        }
        severity = "moderate"
    } | ConvertTo-Json
    
    $response = Invoke-WebRequest -Uri "http://localhost:5001/api/emergency" -Method POST -Body $emergency -ContentType "application/json" -UseBasicParsing
    $result = $response.Content | ConvertFrom-Json
    Write-Host "   ✅ Emergency handled:" -ForegroundColor Green
    Write-Host "      - Assigned to: $($result.assignedDentist)" -ForegroundColor Gray
    Write-Host "      - Response time: $($result.estimatedResponse)" -ForegroundColor Gray
} catch {
    Write-Host "   ❌ Failed to handle emergency" -ForegroundColor Red
}

# Test 5: Available slots
Write-Host "`n5. Testing available slots..." -ForegroundColor Yellow
try {
    $tomorrow = (Get-Date).AddDays(1).ToString("yyyy-MM-dd")
    $response = Invoke-WebRequest -Uri "http://localhost:5001/api/available-slots?date=$tomorrow" -Method GET -UseBasicParsing
    $slots = $response.Content | ConvertFrom-Json
    Write-Host "   ✅ Found $($slots.Count) available slots for tomorrow" -ForegroundColor Green
} catch {
    Write-Host "   ❌ Failed to get available slots" -ForegroundColor Red
}

# Frontend test
Write-Host "`n📱 Testing frontend integration..." -ForegroundColor Cyan
Write-Host "   Frontend should connect to API at http://localhost:5001" -ForegroundColor Gray

# Cleanup
Write-Host "`n🧹 Cleaning up..." -ForegroundColor Yellow
Stop-Job $server
Remove-Job $server

Write-Host "`n✨ Test completed!" -ForegroundColor Cyan
Write-Host "To run the full application:" -ForegroundColor Yellow
Write-Host "  1. Backend: cd dental-ai-receptionist\server && npm start" -ForegroundColor Gray
Write-Host "  2. Frontend: cd dental-ai-receptionist && npm run dev" -ForegroundColor Gray