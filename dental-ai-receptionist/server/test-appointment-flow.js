import axios from 'axios';

const API_URL = 'http://localhost:5001/api';

async function testScenario(name, message, expectedBehavior) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`TEST: ${name}`);
  console.log(`MESSAGE: "${message}"`);
  console.log(`EXPECTED: ${expectedBehavior}`);
  console.log('-'.repeat(80));
  
  try {
    const response = await axios.post(`${API_URL}/ai/process-conversation`, {
      message: message,
      context: {
        conversationId: `test-${Date.now()}`,
        history: [],
        type: 'receptionist',
        isVoice: false
      }
    });
    
    const data = response.data;
    console.log(`INTENT: ${data.intent}`);
    console.log(`RESPONSE: "${data.message}"`);
    
    if (data.needsInfo) {
      console.log(`NEEDS INFO: ${data.needsInfo}`);
    }
    
    if (data.confirmationNumber) {
      console.log(`✅ CONFIRMATION NUMBER: ${data.confirmationNumber}`);
    }
    
    // Check if response matches expected behavior
    let success = false;
    if (expectedBehavior.includes('ask for name') && data.message.toLowerCase().includes('name')) {
      success = true;
    } else if (expectedBehavior.includes('clarification') && data.message.toLowerCase().includes('repeat')) {
      success = true;
    } else if (expectedBehavior.includes('emergency') && (data.message.toLowerCase().includes('emergency') || data.message.toLowerCase().includes('urgent'))) {
      success = true;
    } else if (expectedBehavior.includes('no specific slot') && !data.message.toLowerCase().includes('requested slot')) {
      success = true;
    } else if (expectedBehavior.includes('confirmation') && data.confirmationNumber) {
      success = true;
    }
    
    console.log(success ? '✅ TEST PASSED' : '❌ TEST FAILED');
    
    return { success, data };
  } catch (error) {
    console.log(`❌ ERROR: ${error.message}`);
    return { success: false, error };
  }
}

async function testFullBookingFlow() {
  console.log('\n' + '='.repeat(80));
  console.log('TESTING FULL BOOKING FLOW WITH NAME');
  console.log('='.repeat(80));
  
  // Step 1: Request without name
  console.log('\nStep 1: Request appointment without providing name');
  const response1 = await axios.post(`${API_URL}/ai/process-conversation`, {
    message: 'I need to book an appointment for tomorrow',
    context: {
      conversationId: `flow-test-${Date.now()}`,
      history: [],
      type: 'receptionist',
      isVoice: false
    }
  });
  
  console.log(`RESPONSE: "${response1.data.message}"`);
  console.log(`NEEDS INFO: ${response1.data.needsInfo}`);
  
  // Step 2: Provide name with context from previous response
  if (response1.data?.needsInfo === 'name') {
    console.log('\nStep 2: Providing name after being asked');
    const response2 = await axios.post(`${API_URL}/ai/process-conversation`, {
      message: 'John Smith',
      context: {
        conversationId: `flow-test-${Date.now()}`,
        history: [{
          request: 'I need to book an appointment for tomorrow',
          response: response1.data.message
        }],
        needsInfo: response1.data.needsInfo,
        type: 'receptionist',
        isVoice: false
      }
    });
    
    console.log(`RESPONSE: "${response2.data.message}"`);
    if (response2.data.confirmationNumber) {
      console.log(`✅ CONFIRMATION NUMBER: ${response2.data.confirmationNumber}`);
      console.log('✅ Successfully booked after providing name!');
    } else {
      console.log('❌ No confirmation number received');
    }
  }
  
  // Step 3: Complete booking with all info
  console.log('\nStep 3: Complete booking with all information');
  const step3 = await testScenario(
    'Complete booking',
    'Hi, my name is Sarah Johnson and I need to book a cleaning appointment for tomorrow afternoon',
    'Should book with confirmation number'
  );
}

async function runTests() {
  console.log('='.repeat(80));
  console.log('TESTING SARAH\'S IMPROVED APPOINTMENT BOOKING');
  console.log('='.repeat(80));
  
  // Test 1: Confusing messages
  await testScenario(
    'Confusing message - knocked tools',
    'I knocked my tools',
    'Should ask for clarification'
  );
  
  // Test 2: Emergency - knocked tooth
  await testScenario(
    'Emergency - knocked tooth',
    'I knocked my tooth',
    'Should recognize as emergency'
  );
  
  // Test 3: Emergency - knocked teeth
  await testScenario(
    'Emergency - knocked teeth',
    'I knocked my teeth playing sports',
    'Should recognize as emergency'
  );
  
  // Test 4: Appointment without specific time
  await testScenario(
    'Appointment without time',
    'I need to schedule a checkup',
    'Should not say "requested slot" - no specific slot was requested'
  );
  
  // Test 5: Appointment without name
  await testScenario(
    'No name provided',
    'Can you book me an appointment?',
    'Should ask for name'
  );
  
  // Test 6: Appointment with specific unavailable time
  await testScenario(
    'Specific time request',
    'My name is Alex. I need an appointment today at 3am',
    'Can mention "requested slot" since specific time was given'
  );
  
  // Test full booking flow
  await testFullBookingFlow();
  
  console.log('\n' + '='.repeat(80));
  console.log('ALL TESTS COMPLETED');
  console.log('='.repeat(80));
}

runTests().catch(console.error);