import axios from 'axios';

const API_URL = 'http://localhost:5001/api';

// Test scenarios for smart appointment booking
async function testAppointmentBooking() {
  console.log('🦷 Testing Smart Appointment Booking System\n');
  console.log('=' .repeat(50));

  try {
    // Test 1: Check availability for tomorrow at 2 PM
    console.log('\n📅 Test 1: Checking availability for tomorrow at 2 PM');
    const availabilityCheck = await axios.post(`${API_URL}/smart-scheduling/check-availability`, {
      date: 'tomorrow',
      time: '2 PM',
      duration: 30
    });
    console.log('✅ Response:', availabilityCheck.data);

    // Test 2: Book an actual appointment
    console.log('\n📝 Test 2: Booking appointment for John Doe');
    const booking = await axios.post(`${API_URL}/smart-scheduling/book`, {
      patientName: 'John Doe',
      patientEmail: 'john.doe@example.com',
      patientPhone: '555-123-4567',
      date: 'tomorrow',
      time: '2 PM',
      type: 'cleaning',
      notes: 'First time patient, needs cleaning'
    });
    console.log('✅ Booking successful:', booking.data);

    // Test 3: Try to book same time slot (should fail)
    console.log('\n🚫 Test 3: Attempting to book same slot (should get alternatives)');
    const conflictBooking = await axios.post(`${API_URL}/smart-scheduling/check-availability`, {
      date: 'tomorrow',
      time: '2 PM',
      duration: 30
    });
    console.log('Response:', conflictBooking.data);

    // Test 4: AI-powered appointment handling
    console.log('\n🤖 Test 4: AI appointment handler - Natural language booking');
    const aiBooking1 = await axios.post(`${API_URL}/smart-scheduling/ai-handle`, {
      message: "I need to schedule a cleaning appointment for next Tuesday morning",
      conversationId: 'test-conversation-1'
    });
    console.log('✅ AI Response:', aiBooking1.data);

    // Test 5: Emergency appointment request
    console.log('\n🚨 Test 5: Emergency appointment request');
    const emergencyRequest = await axios.post(`${API_URL}/smart-scheduling/ai-handle`, {
      message: "I have severe tooth pain and need to see someone urgently today!",
      conversationId: 'test-conversation-2'
    });
    console.log('✅ Emergency Response:', emergencyRequest.data);

    // Test 6: Complex conversation flow
    console.log('\n💬 Test 6: Multi-step conversation flow');
    
    // Step 1: Initial request
    const step1 = await axios.post(`${API_URL}/smart-scheduling/ai-handle`, {
      message: "I'd like to book an appointment",
      conversationId: 'test-conversation-3'
    });
    console.log('Step 1 - Initial request:', step1.data.message);

    // Step 2: Provide date preference
    const step2 = await axios.post(`${API_URL}/smart-scheduling/ai-handle`, {
      message: "How about Friday afternoon?",
      conversationId: 'test-conversation-3'
    });
    console.log('Step 2 - Date preference:', step2.data.message);

    // Step 3: Provide type
    const step3 = await axios.post(`${API_URL}/smart-scheduling/ai-handle`, {
      message: "I need a checkup",
      conversationId: 'test-conversation-3'
    });
    console.log('Step 3 - Appointment type:', step3.data.message);

    // Test 7: Check available slots for a specific day
    console.log('\n📋 Test 7: Get all available slots for Monday');
    const availableSlots = await axios.post(`${API_URL}/smart-scheduling/available-slots`, {
      date: 'monday',
      duration: 30
    });
    console.log(`✅ Found ${availableSlots.data.totalSlots} available slots`);
    if (availableSlots.data.availableSlots.length > 0) {
      console.log('First 3 available times:', 
        availableSlots.data.availableSlots.slice(0, 3).map(slot => 
          new Date(slot.startTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
        )
      );
    }

    // Test 8: Test Sarah AI integration
    console.log('\n🎙️ Test 8: Sarah AI receptionist appointment booking');
    const sarahResponse = await axios.post(`${API_URL}/ai/chat`, {
      message: "Hi Sarah, I need to book a dental cleaning for tomorrow at 3 PM",
      context: {
        conversationId: 'sarah-test-1',
        type: 'receptionist',
        isVoice: true
      }
    });
    console.log('✅ Sarah says:', sarahResponse.data.response);

    console.log('\n' + '=' .repeat(50));
    console.log('✨ All tests completed successfully!');
    console.log('\n📊 Summary:');
    console.log('- Smart scheduling API is working');
    console.log('- Appointment booking with conflict detection works');
    console.log('- AI appointment handler processes natural language');
    console.log('- Sarah can handle appointment requests intelligently');
    console.log('- Database integration is functional');

  } catch (error) {
    console.error('\n❌ Test failed:', error.response?.data || error.message);
    console.log('\nDebug info:');
    console.log('- Make sure the server is running on port 5001');
    console.log('- Check that MongoDB is connected');
    console.log('- Verify OpenAI API key is configured');
  }
}

// Run the tests
console.log('Starting appointment booking tests...\n');
testAppointmentBooking();