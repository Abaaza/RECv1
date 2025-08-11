@echo off
echo Starting Dental AI Receptionist Test Suite...
echo ==========================================

REM Start the server in background
echo Starting backend server...
cd dental-ai-receptionist\server
start /B cmd /c "node index.js"

REM Wait for server to start
echo Waiting for server to initialize...
timeout /t 3 /nobreak > nul

REM Run tests
echo.
echo Running API tests...
node test.js

REM Kill the server process
echo.
echo Stopping server...
taskkill /F /IM node.exe 2>nul

echo Test completed!
pause