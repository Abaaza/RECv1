import axios from 'axios';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config();

const API_BASE_URL = 'http://localhost:5001/api';
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/dental-ai';

// Test data
let testPatientId = null;
let testAppointmentId = null;
let testTreatmentPlanId = null;
let testEmergencyId = null;
let testInsuranceClaimId = null;
let authToken = null;

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  },
  timeout: 10000
});

// Test results tracking
const testResults = {
  passed: 0,
  failed: 0,
  errors: []
};

// Helper functions
function logTest(testName, success, error = null) {
  if (success) {
    console.log(chalk.green(`✓ ${testName}`));
    testResults.passed++;
  } else {
    console.log(chalk.red(`✗ ${testName}`));
    if (error) {
      console.log(chalk.gray(`  Error: ${error.message || error}`));
      testResults.errors.push({ test: testName, error: error.message || error });
    }
    testResults.failed++;
  }
}

function logSection(sectionName) {
  console.log(chalk.blue.bold(`\n=== ${sectionName} ===`));
}

// Test Functions
async function testDatabaseConnection() {
  logSection('DATABASE CONNECTION');
  
  try {
    await mongoose.connect(MONGODB_URI);
    logTest('MongoDB Connection', true);
    
    // Test collections exist
    const collections = await mongoose.connection.db.listCollections().toArray();
    const collectionNames = collections.map(c => c.name);
    
    const requiredCollections = [
      'users', 'patients', 'appointments', 'treatmentplans',
      'insuranceverifications', 'insuranceclaims', 'schedules',
      'calllogs', 'emergencies', 'notifications'
    ];
    
    requiredCollections.forEach(collection => {
      const exists = collectionNames.includes(collection);
      logTest(`Collection '${collection}' exists`, exists);
    });
    
  } catch (error) {
    logTest('MongoDB Connection', false, error);
  }
}

async function testHealthEndpoint() {
  logSection('HEALTH CHECK');
  
  try {
    const response = await api.get('/health');
    logTest('Health endpoint', response.status === 200 && response.data.status === 'OK');
  } catch (error) {
    logTest('Health endpoint', false, error);
  }
}

async function testAuthEndpoints() {
  logSection('AUTHENTICATION');
  
  // Register user
  try {
    const registerData = {
      email: `test_${Date.now()}@dental.com`,
      password: 'Test123!@#',
      name: 'Test User',
      role: 'admin'
    };
    
    const response = await api.post('/auth/register', registerData);
    authToken = response.data.token;
    api.defaults.headers.common['Authorization'] = `Bearer ${authToken}`;
    logTest('User registration', true);
  } catch (error) {
    logTest('User registration', false, error);
  }
  
  // Login
  try {
    const loginData = {
      email: 'admin@dental.com',
      password: 'admin123'
    };
    
    const response = await api.post('/auth/login', loginData);
    if (response.data.token) {
      authToken = response.data.token;
      api.defaults.headers.common['Authorization'] = `Bearer ${authToken}`;
      logTest('User login', true);
    } else {
      logTest('User login', false, 'No token received');
    }
  } catch (error) {
    // Try without auth if login fails
    logTest('User login', false, error);
  }
}

async function testPatientEndpoints() {
  logSection('PATIENT MANAGEMENT');
  
  // Create patient
  try {
    const patientData = {
      name: 'Test Patient',
      email: `patient_${Date.now()}@test.com`,
      phone: '555-0100',
      dateOfBirth: '1990-01-01',
      address: '123 Test St',
      emergencyContact: {
        name: 'Emergency Contact',
        phone: '555-0199',
        relationship: 'Spouse'
      }
    };
    
    const response = await api.post('/patientsv2', patientData);
    testPatientId = response.data._id;
    logTest('Create patient', true);
  } catch (error) {
    logTest('Create patient', false, error);
  }
  
  // Get all patients
  try {
    const response = await api.get('/patientsv2');
    logTest('Get all patients', Array.isArray(response.data));
  } catch (error) {
    logTest('Get all patients', false, error);
  }
  
  // Get single patient
  if (testPatientId) {
    try {
      const response = await api.get(`/patientsv2/${testPatientId}`);
      logTest('Get single patient', response.data._id === testPatientId);
    } catch (error) {
      logTest('Get single patient', false, error);
    }
  }
  
  // Update patient
  if (testPatientId) {
    try {
      const updateData = {
        phone: '555-0200',
        insuranceProvider: 'Test Insurance Co'
      };
      
      const response = await api.put(`/patientsv2/${testPatientId}`, updateData);
      logTest('Update patient', response.data.phone === '555-0200');
    } catch (error) {
      logTest('Update patient', false, error);
    }
  }
}

async function testAppointmentEndpoints() {
  logSection('APPOINTMENT MANAGEMENT');
  
  // Create appointment
  if (testPatientId) {
    try {
      const appointmentData = {
        patientId: testPatientId,
        date: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
        time: '14:00',
        type: 'checkup',
        duration: 30,
        notes: 'Test appointment'
      };
      
      const response = await api.post('/appointments', appointmentData);
      testAppointmentId = response.data._id;
      logTest('Create appointment', true);
    } catch (error) {
      logTest('Create appointment', false, error);
    }
  }
  
  // Get appointments
  try {
    const response = await api.get('/appointments');
    logTest('Get appointments', Array.isArray(response.data));
  } catch (error) {
    logTest('Get appointments', false, error);
  }
  
  // Update appointment
  if (testAppointmentId) {
    try {
      const updateData = {
        status: 'confirmed',
        notes: 'Updated test appointment'
      };
      
      const response = await api.put(`/appointments/${testAppointmentId}`, updateData);
      logTest('Update appointment', response.data.status === 'confirmed');
    } catch (error) {
      logTest('Update appointment', false, error);
    }
  }
  
  // Search appointments
  try {
    const response = await api.get('/appointments/search', {
      params: { status: 'scheduled' }
    });
    logTest('Search appointments', true);
  } catch (error) {
    logTest('Search appointments', false, error);
  }
}

async function testScheduleEndpoints() {
  logSection('SCHEDULE MANAGEMENT');
  
  // Get schedule
  try {
    const startDate = new Date().toISOString().split('T')[0];
    const endDate = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];
    
    const response = await api.get('/schedule', {
      params: { startDate, endDate }
    });
    logTest('Get schedule', true);
  } catch (error) {
    logTest('Get schedule', false, error);
  }
  
  // Get available slots
  try {
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    
    const response = await api.get('/schedule/available-slots', {
      params: { date: tomorrow, duration: 30 }
    });
    logTest('Get available slots', true);
  } catch (error) {
    logTest('Get available slots', false, error);
  }
  
  // Get holidays
  try {
    const response = await api.get('/schedule/holidays');
    logTest('Get holidays', Array.isArray(response.data));
  } catch (error) {
    logTest('Get holidays', false, error);
  }
}

async function testEmergencyEndpoints() {
  logSection('EMERGENCY MANAGEMENT');
  
  // Report emergency
  try {
    const emergencyData = {
      patientName: 'Emergency Patient',
      phoneNumber: '555-0911',
      emergencyType: 'severe_pain',
      symptoms: ['pain', 'swelling'],
      painLevel: 8,
      onsetTime: new Date().toISOString()
    };
    
    const response = await api.post('/emergency', emergencyData);
    testEmergencyId = response.data._id;
    logTest('Report emergency', true);
  } catch (error) {
    logTest('Report emergency', false, error);
  }
  
  // Get active emergencies
  try {
    const response = await api.get('/emergency/active');
    logTest('Get active emergencies', Array.isArray(response.data));
  } catch (error) {
    logTest('Get active emergencies', false, error);
  }
  
  // Get emergency statistics
  try {
    const response = await api.get('/emergency/stats/overview');
    logTest('Get emergency statistics', true);
  } catch (error) {
    logTest('Get emergency statistics', false, error);
  }
}

async function testTreatmentPlanEndpoints() {
  logSection('TREATMENT PLANS');
  
  // Create treatment plan
  if (testPatientId) {
    try {
      const treatmentPlanData = {
        patientId: testPatientId,
        name: 'Test Treatment Plan',
        description: 'Comprehensive dental treatment',
        procedures: [
          {
            name: 'Cleaning',
            code: 'D1110',
            estimatedCost: 150,
            status: 'pending'
          },
          {
            name: 'Filling',
            code: 'D2150',
            estimatedCost: 250,
            status: 'pending'
          }
        ],
        estimatedCost: 400,
        priority: 'medium'
      };
      
      const response = await api.post('/treatment-plans', treatmentPlanData);
      testTreatmentPlanId = response.data._id;
      logTest('Create treatment plan', true);
    } catch (error) {
      logTest('Create treatment plan', false, error);
    }
  }
  
  // Get treatment plans
  try {
    const response = await api.get('/treatment-plans');
    logTest('Get treatment plans', true);
  } catch (error) {
    logTest('Get treatment plans', false, error);
  }
  
  // Get patient treatment plans
  if (testPatientId) {
    try {
      const response = await api.get(`/treatment-plans/patient/${testPatientId}`);
      logTest('Get patient treatment plans', Array.isArray(response.data));
    } catch (error) {
      logTest('Get patient treatment plans', false, error);
    }
  }
}

async function testInsuranceEndpoints() {
  logSection('INSURANCE MANAGEMENT');
  
  // Verify insurance
  if (testPatientId) {
    try {
      const insuranceData = {
        patientId: testPatientId,
        provider: 'Test Insurance Co',
        policyNumber: 'POL123456',
        subscriberName: 'Test Subscriber',
        effectiveDate: new Date().toISOString()
      };
      
      const response = await api.post('/insurance/verify', insuranceData);
      logTest('Verify insurance', true);
    } catch (error) {
      logTest('Verify insurance', false, error);
    }
  }
  
  // Create insurance claim
  if (testPatientId) {
    try {
      const claimData = {
        patientId: testPatientId,
        provider: 'Test Insurance Co',
        policyNumber: 'POL123456',
        dateOfService: new Date().toISOString(),
        procedures: [
          {
            code: 'D1110',
            description: 'Cleaning',
            chargedAmount: 150,
            insuranceAllowed: 120
          }
        ],
        totalCharged: 150,
        totalInsuranceEstimate: 120,
        totalPatientResponsibility: 30
      };
      
      const response = await api.post('/insurance/claims', claimData);
      testInsuranceClaimId = response.data._id;
      logTest('Create insurance claim', true);
    } catch (error) {
      logTest('Create insurance claim', false, error);
    }
  }
  
  // Get insurance claims
  try {
    const response = await api.get('/insurance/claims');
    logTest('Get insurance claims', true);
  } catch (error) {
    logTest('Get insurance claims', false, error);
  }
}

async function testStatsEndpoint() {
  logSection('STATISTICS');
  
  try {
    const response = await api.get('/stats');
    logTest('Get dashboard statistics', response.data.hasOwnProperty('totalPatients'));
  } catch (error) {
    logTest('Get dashboard statistics', false, error);
  }
}

async function testAnalyticsEndpoints() {
  logSection('ANALYTICS');
  
  try {
    const response = await api.get('/analyticsv2');
    logTest('Get analytics data', true);
  } catch (error) {
    logTest('Get analytics data', false, error);
  }
}

async function testAIEndpoints() {
  logSection('AI SERVICES');
  
  // Test chat endpoint
  try {
    const chatData = {
      message: 'I need to schedule an appointment for next week',
      context: { type: 'appointment_request' }
    };
    
    const response = await api.post('/ai/chat', chatData);
    logTest('AI chat', response.data.hasOwnProperty('response'));
  } catch (error) {
    logTest('AI chat', false, error);
  }
  
  // Test symptom analysis
  try {
    const symptomData = {
      symptoms: ['toothache', 'sensitivity to cold'],
      patientId: testPatientId
    };
    
    const response = await api.post('/ai/analyze-symptoms', symptomData);
    logTest('AI symptom analysis', response.data.hasOwnProperty('urgency'));
  } catch (error) {
    logTest('AI symptom analysis', false, error);
  }
  
  // Test appointment booking
  try {
    const bookingData = {
      request: 'I need an appointment tomorrow at 2pm for John Doe'
    };
    
    const response = await api.post('/ai/book-appointment', bookingData);
    logTest('AI appointment booking', true);
  } catch (error) {
    logTest('AI appointment booking', false, error);
  }
}

async function testWebSocketConnection() {
  logSection('WEBSOCKET CONNECTION');
  
  try {
    const io = await import('socket.io-client');
    const socket = io.default('http://localhost:5001');
    
    await new Promise((resolve, reject) => {
      socket.on('connect', () => {
        logTest('WebSocket connection', true);
        socket.disconnect();
        resolve();
      });
      
      socket.on('connect_error', (error) => {
        logTest('WebSocket connection', false, error);
        reject(error);
      });
      
      setTimeout(() => {
        socket.disconnect();
        reject(new Error('Connection timeout'));
      }, 5000);
    });
  } catch (error) {
    logTest('WebSocket connection', false, error);
  }
}

async function cleanupTestData() {
  logSection('CLEANUP');
  
  try {
    // Delete test appointment
    if (testAppointmentId) {
      await api.delete(`/appointments/${testAppointmentId}`);
      logTest('Delete test appointment', true);
    }
  } catch (error) {
    logTest('Delete test appointment', false, error);
  }
  
  try {
    // Delete test patient
    if (testPatientId) {
      await api.delete(`/patientsv2/${testPatientId}`);
      logTest('Delete test patient', true);
    }
  } catch (error) {
    logTest('Delete test patient', false, error);
  }
  
  // Close database connection
  await mongoose.connection.close();
}

// Main test runner
async function runTests() {
  console.log(chalk.cyan.bold('\n🦷 DENTAL AI RECEPTIONIST - API TEST SUITE 🦷'));
  console.log(chalk.gray('=' .repeat(50)));
  
  const startTime = Date.now();
  
  // Run all tests
  await testDatabaseConnection();
  await testHealthEndpoint();
  await testAuthEndpoints();
  await testPatientEndpoints();
  await testAppointmentEndpoints();
  await testScheduleEndpoints();
  await testEmergencyEndpoints();
  await testTreatmentPlanEndpoints();
  await testInsuranceEndpoints();
  await testStatsEndpoint();
  await testAnalyticsEndpoints();
  await testAIEndpoints();
  await testWebSocketConnection();
  await cleanupTestData();
  
  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000).toFixed(2);
  
  // Print summary
  console.log(chalk.gray('\n' + '=' .repeat(50)));
  console.log(chalk.cyan.bold('TEST SUMMARY'));
  console.log(chalk.green(`✓ Passed: ${testResults.passed}`));
  console.log(chalk.red(`✗ Failed: ${testResults.failed}`));
  console.log(chalk.gray(`Duration: ${duration}s`));
  
  if (testResults.errors.length > 0) {
    console.log(chalk.red.bold('\nFAILED TESTS:'));
    testResults.errors.forEach(error => {
      console.log(chalk.red(`  - ${error.test}: ${error.error}`));
    });
  }
  
  const successRate = ((testResults.passed / (testResults.passed + testResults.failed)) * 100).toFixed(1);
  console.log(chalk.blue(`\nSuccess Rate: ${successRate}%`));
  
  if (testResults.failed === 0) {
    console.log(chalk.green.bold('\n🎉 ALL TESTS PASSED! 🎉'));
  } else {
    console.log(chalk.yellow.bold(`\n⚠️  ${testResults.failed} tests failed. Please review the errors above.`));
  }
  
  process.exit(testResults.failed > 0 ? 1 : 0);
}

// Run tests
runTests().catch(error => {
  console.error(chalk.red.bold('Test runner failed:'), error);
  process.exit(1);
});