import axios from 'axios';

const API_URL = 'http://localhost:5001/api';

async function testConversations() {
  const testCases = [
    // Emergency cases
    "I have a terrible toothache, can I see someone today?",
    "My son knocked out his tooth playing soccer, we need help!",
    "I'm in severe pain and my face is swollen",
    
    // Regular appointments
    "I'd like to schedule my regular cleaning",
    "Can I book a checkup for next Tuesday at 2pm?",
    "I need to come in for a filling",
    "Schedule me for a root canal consultation",
    
    // With patient information
    "Hi, this is John Smith, I need a cleaning appointment",
    "My name is Sarah Johnson, phone 555-123-4567, I need to see the dentist",
    "I'm Mike Wilson, can you book me for tomorrow morning?",
    
    // Time preferences
    "Do you have any appointments available this afternoon?",
    "What's your earliest opening tomorrow?",
    "I prefer morning appointments, what do you have next week?",
    "Can I get an evening appointment on Friday?",
    
    // Cancellations
    "I need to cancel my appointment",
    "Can you reschedule my appointment to next week?",
    
    // General queries
    "What insurance do you accept?",
    "What are your office hours?",
    "How much does a cleaning cost?",
    "Do you see children?"
  ];
  
  console.log('='.repeat(80));
  console.log('COMPREHENSIVE AI RECEPTIONIST TESTING');
  console.log('='.repeat(80));
  
  let successCount = 0;
  let failureCount = 0;
  let bookingCount = 0;
  
  for (const [index, message] of testCases.entries()) {
    console.log(`\nTest ${index + 1}/${testCases.length}`);
    console.log('User: ' + message);
    console.log('-'.repeat(40));
    
    try {
      const response = await axios.post(`${API_URL}/ai/process-conversation`, {
        message,
        context: {
          conversationId: `test-${Date.now()}-${index}`,
          history: [],
          type: 'receptionist',
          isVoice: true
        }
      });
      
      const data = response.data;
      
      if (data.success !== undefined) {
        console.log('✅ Success:', data.success);
      }
      
      console.log('Sarah: ' + (data.message || data.response));
      
      if (data.appointment) {
        bookingCount++;
        console.log('📅 Appointment Booked:');
        console.log('   - Confirmation:', data.appointment.confirmationNumber || data.confirmationNumber);
        console.log('   - Type:', data.appointment.type);
        console.log('   - Date:', new Date(data.appointment.date).toLocaleDateString());
        console.log('   - Time:', data.appointment.startTime);
      }
      
      if (data.intent) {
        console.log('🎯 Intent:', data.intent);
      }
      
      successCount++;
    } catch (error) {
      console.error('❌ Error:', error.response?.data?.error || error.message);
      failureCount++;
    }
    
    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('TEST SUMMARY');
  console.log('='.repeat(80));
  console.log(`Total Tests: ${testCases.length}`);
  console.log(`✅ Successful: ${successCount}`);
  console.log(`❌ Failed: ${failureCount}`);
  console.log(`📅 Appointments Booked: ${bookingCount}`);
  console.log(`Success Rate: ${((successCount / testCases.length) * 100).toFixed(1)}%`);
  
  // Fetch final stats
  try {
    const statsResponse = await axios.get(`${API_URL}/stats`);
    const stats = statsResponse.data;
    console.log('\n' + '='.repeat(80));
    console.log('CURRENT SYSTEM STATS');
    console.log('='.repeat(80));
    console.log(`Total Patients: ${stats.totalPatients}`);
    console.log(`Today's Appointments: ${stats.todayAppointments}`);
    console.log(`Calls Answered: ${stats.callsAnswered}`);
    console.log(`Patient Satisfaction: ${stats.patientSatisfaction}%`);
    console.log(`Average Wait Time: ${stats.averageWaitTime} minutes`);
  } catch (error) {
    console.error('Could not fetch stats:', error.message);
  }
}

testConversations().catch(console.error);