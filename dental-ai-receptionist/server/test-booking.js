import axios from 'axios';

const API_URL = 'http://localhost:5001/api';

async function testBooking() {
  const testCases = [
    "I knocked my tooth and need an appointment today",
    "I need to schedule a cleaning",
    "Can I book an appointment for tomorrow morning?"
  ];
  
  for (const message of testCases) {
    console.log(`\n${'='.repeat(50)}`);
    console.log(`Testing: "${message}"`);
    console.log('='.repeat(50));
    
    try {
      const response = await axios.post(`${API_URL}/ai/process-conversation`, {
        message,
        context: {
          conversationId: Date.now().toString(),
          history: [],
          type: 'receptionist',
          isVoice: true
        }
      });
      
      const data = response.data;
      console.log('✅ Success:', data.success);
      console.log('📝 Response:', data.message || data.response);
      
      if (data.appointment) {
        console.log('📅 Appointment Details:');
        console.log('   - Confirmation:', data.confirmationNumber);
        console.log('   - Type:', data.appointment.type);
        console.log('   - Date:', data.appointment.date);
        console.log('   - Time:', data.appointment.startTime);
      }
    } catch (error) {
      console.error('❌ Error:', error.response?.data?.error || error.message);
    }
  }
}

testBooking();