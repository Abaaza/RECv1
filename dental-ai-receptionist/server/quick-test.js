// Quick test to verify server endpoints
const axios = require('axios');

async function quickTest() {
  console.log('🔍 Quick API Test\n');
  
  try {
    // First start the server
    console.log('Please ensure the server is running:');
    console.log('  cd server && node index.js\n');
    
    // Wait a moment
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Test health endpoint
    console.log('Testing /api/health...');
    const health = await axios.get('http://localhost:5001/api/health');
    console.log('✅ Health check:', health.data.status);
    
    // Test creating a patient
    console.log('\nTesting patient creation...');
    const patient = await axios.post('http://localhost:5001/api/patients', {
      name: 'Test Patient',
      phone: '555-0001',
      email: 'test@dental.com'
    });
    console.log('✅ Patient created:', patient.data.name);
    
    // Test creating appointment
    console.log('\nTesting appointment creation...');
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(10, 0, 0, 0);
    
    const appointment = await axios.post('http://localhost:5001/api/appointments', {
      patientName: 'John Smith',
      patientPhone: '555-1234',
      startTime: tomorrow.toISOString(),
      endTime: new Date(tomorrow.getTime() + 30 * 60000).toISOString(),
      reason: 'Checkup'
    });
    console.log('✅ Appointment created for:', appointment.data.patientName);
    
    // Test getting stats
    console.log('\nTesting statistics...');
    const stats = await axios.get('http://localhost:5001/api/stats');
    console.log('✅ Stats retrieved:');
    console.log('  - Total appointments:', stats.data.totalAppointments);
    console.log('  - Total patients:', stats.data.totalPatients);
    console.log('  - Available dentists:', stats.data.availableDentists);
    
    console.log('\n✨ All basic tests passed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
    console.log('\nMake sure the server is running on port 5001');
  }
}

quickTest();