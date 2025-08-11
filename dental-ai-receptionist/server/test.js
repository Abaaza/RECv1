const axios = require('axios');

const API_URL = 'http://localhost:5001/api';
let testResults = { passed: 0, failed: 0, tests: [] };

// Helper function to make API calls
async function apiCall(method, endpoint, data = null) {
  try {
    const config = {
      method,
      url: `${API_URL}${endpoint}`,
      headers: { 'Content-Type': 'application/json' }
    };
    if (data) config.data = data;
    const response = await axios(config);
    return { success: true, data: response.data, status: response.status };
  } catch (error) {
    return { 
      success: false, 
      error: error.response?.data?.error || error.message,
      status: error.response?.status 
    };
  }
}

// Test runner
async function runTest(name, testFn) {
  console.log(`\n🧪 Running: ${name}`);
  try {
    await testFn();
    testResults.passed++;
    testResults.tests.push({ name, status: 'PASSED' });
    console.log(`✅ PASSED: ${name}`);
  } catch (error) {
    testResults.failed++;
    testResults.tests.push({ name, status: 'FAILED', error: error.message });
    console.log(`❌ FAILED: ${name}`);
    console.log(`   Error: ${error.message}`);
  }
}

// Test assertions
function assert(condition, message) {
  if (!condition) throw new Error(message);
}

// Tests
async function runAllTests() {
  console.log('🚀 Starting Dental AI Receptionist API Tests...\n');
  
  // Test 1: Health Check
  await runTest('Health Check', async () => {
    const result = await apiCall('GET', '/health');
    assert(result.success, 'Health check failed');
    assert(result.data.status === 'OK', 'Invalid health status');
    assert(result.data.version === '1.0.0', 'Invalid version');
  });

  // Test 2: Create Patient
  let testPatientId;
  await runTest('Create Patient', async () => {
    const patient = {
      name: 'Test Patient',
      phone: '555-0123',
      email: 'test@example.com',
      dateOfBirth: '1990-01-01'
    };
    const result = await apiCall('POST', '/patients', patient);
    assert(result.success, 'Failed to create patient');
    assert(result.data.name === patient.name, 'Patient name mismatch');
    testPatientId = result.data.id;
  });

  // Test 3: Get Patients
  await runTest('Get Patients', async () => {
    const result = await apiCall('GET', '/patients');
    assert(result.success, 'Failed to get patients');
    assert(Array.isArray(result.data), 'Patients should be an array');
    assert(result.data.length > 0, 'No patients found');
  });

  // Test 4: Create Valid Appointment
  let testAppointmentId;
  await runTest('Create Valid Appointment', async () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(10, 0, 0, 0);
    
    const appointment = {
      patientName: 'John Doe',
      patientPhone: '555-1234',
      patientEmail: 'john@example.com',
      startTime: tomorrow.toISOString(),
      endTime: new Date(tomorrow.getTime() + 30 * 60000).toISOString(),
      reason: 'Regular checkup'
    };
    
    const result = await apiCall('POST', '/appointments', appointment);
    assert(result.success, 'Failed to create appointment');
    assert(result.data.status === 'confirmed', 'Appointment not confirmed');
    testAppointmentId = result.data.id;
  });

  // Test 5: Validate Appointment Conflict
  await runTest('Detect Appointment Conflict', async () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(10, 0, 0, 0);
    
    const conflictingAppointment = {
      patientName: 'Jane Doe',
      patientPhone: '555-5678',
      startTime: tomorrow.toISOString(),
      endTime: new Date(tomorrow.getTime() + 30 * 60000).toISOString(),
      reason: 'Cleaning'
    };
    
    const result = await apiCall('POST', '/appointments', conflictingAppointment);
    assert(!result.success, 'Should have detected conflict');
    assert(result.status === 409, 'Should return 409 conflict status');
  });

  // Test 6: Invalid Appointment (missing fields)
  await runTest('Reject Invalid Appointment', async () => {
    const invalidAppointment = {
      patientName: 'Invalid Patient'
      // Missing required fields
    };
    
    const result = await apiCall('POST', '/appointments', invalidAppointment);
    assert(!result.success, 'Should reject invalid appointment');
    assert(result.status === 400, 'Should return 400 bad request');
  });

  // Test 7: Get Available Slots
  await runTest('Get Available Slots', async () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().split('T')[0];
    
    const result = await apiCall('GET', `/available-slots?date=${dateStr}`);
    assert(result.success, 'Failed to get available slots');
    assert(Array.isArray(result.data), 'Slots should be an array');
  });

  // Test 8: Update Appointment
  await runTest('Update Appointment', async () => {
    if (!testAppointmentId) {
      throw new Error('No test appointment ID');
    }
    
    const updates = {
      notes: 'Patient requested early morning slot'
    };
    
    const result = await apiCall('PUT', `/appointments/${testAppointmentId}`, updates);
    assert(result.success, 'Failed to update appointment');
    assert(result.data.notes === updates.notes, 'Notes not updated');
  });

  // Test 9: Cancel Appointment
  await runTest('Cancel Appointment', async () => {
    if (!testAppointmentId) {
      throw new Error('No test appointment ID');
    }
    
    const result = await apiCall('DELETE', `/appointments/${testAppointmentId}`);
    assert(result.success, 'Failed to cancel appointment');
  });

  // Test 10: Create Emergency
  await runTest('Create Emergency', async () => {
    const emergency = {
      type: 'trauma',
      patientInfo: {
        name: 'Emergency Patient',
        phone: '555-9999',
        age: 35
      },
      severity: 'moderate'
    };
    
    const result = await apiCall('POST', '/emergency', emergency);
    assert(result.success, 'Failed to create emergency');
    assert(result.data.emergency.status === 'active', 'Emergency not active');
    assert(result.data.instructions, 'No triage instructions provided');
  });

  // Test 11: Invalid Emergency (missing fields)
  await runTest('Reject Invalid Emergency', async () => {
    const invalidEmergency = {
      type: 'pain'
      // Missing required fields
    };
    
    const result = await apiCall('POST', '/emergency', invalidEmergency);
    assert(!result.success, 'Should reject invalid emergency');
    assert(result.status === 400, 'Should return 400 bad request');
  });

  // Test 12: Get Dentists
  await runTest('Get Dentists', async () => {
    const result = await apiCall('GET', '/dentists');
    assert(result.success, 'Failed to get dentists');
    assert(Array.isArray(result.data), 'Dentists should be an array');
    assert(result.data.length > 0, 'No dentists found');
  });

  // Test 13: Get Available Dentists
  await runTest('Get Available Dentists', async () => {
    const result = await apiCall('GET', '/dentists/available');
    assert(result.success, 'Failed to get available dentists');
    assert(Array.isArray(result.data), 'Available dentists should be an array');
  });

  // Test 14: Create Call Log
  await runTest('Create Call Log', async () => {
    const callLog = {
      patientName: 'Caller Name',
      patientPhone: '555-3333',
      duration: 180,
      type: 'appointment_inquiry',
      outcome: 'appointment_scheduled'
    };
    
    const result = await apiCall('POST', '/call-logs', callLog);
    assert(result.success, 'Failed to create call log');
    assert(result.data.id, 'Call log should have ID');
  });

  // Test 15: Get Statistics
  await runTest('Get Statistics', async () => {
    const result = await apiCall('GET', '/stats');
    assert(result.success, 'Failed to get statistics');
    assert(typeof result.data.totalAppointments === 'number', 'Invalid stats format');
    assert(typeof result.data.totalPatients === 'number', 'Invalid stats format');
  });

  // Test 16: Search Appointments
  await runTest('Search Appointments', async () => {
    const result = await apiCall('GET', '/appointments/search?patientName=John');
    assert(result.success, 'Failed to search appointments');
    assert(Array.isArray(result.data), 'Search results should be an array');
  });

  // Print results
  console.log('\n' + '='.repeat(50));
  console.log('📊 TEST RESULTS');
  console.log('='.repeat(50));
  console.log(`✅ Passed: ${testResults.passed}`);
  console.log(`❌ Failed: ${testResults.failed}`);
  console.log(`📝 Total: ${testResults.passed + testResults.failed}`);
  console.log(`🎯 Success Rate: ${Math.round((testResults.passed / (testResults.passed + testResults.failed)) * 100)}%`);
  
  if (testResults.failed > 0) {
    console.log('\n❌ Failed Tests:');
    testResults.tests
      .filter(t => t.status === 'FAILED')
      .forEach(t => console.log(`  - ${t.name}: ${t.error}`));
  }
  
  console.log('\n✨ Testing completed!');
  process.exit(testResults.failed > 0 ? 1 : 0);
}

// Check if server is running
async function checkServerRunning() {
  try {
    await apiCall('GET', '/health');
    return true;
  } catch {
    return false;
  }
}

// Main execution
async function main() {
  console.log('🔍 Checking if server is running...');
  
  const isRunning = await checkServerRunning();
  if (!isRunning) {
    console.log('❌ Server is not running!');
    console.log('📝 Please start the server first:');
    console.log('   cd server && npm start');
    process.exit(1);
  }
  
  console.log('✅ Server is running!\n');
  await runAllTests();
}

main().catch(error => {
  console.error('💥 Unexpected error:', error);
  process.exit(1);
});