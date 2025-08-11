import axios from 'axios';

const API_URL = 'http://localhost:5001/api';

async function testErrorResilience() {
  console.log('='.repeat(80));
  console.log('TESTING SARAH\'S ERROR RESILIENCE - NO FAILURES ALLOWED');
  console.log('='.repeat(80));
  console.log();
  
  const testCases = [
    // Edge cases and potential error triggers
    "",  // Empty message
    "   ",  // Whitespace only
    "!!!???",  // Special characters only
    "asdkfjalsdkfj",  // Gibberish
    "null undefined error",  // Error keywords
    "SHOUTING AT YOU",  // All caps
    "i want appointment",  // Incomplete request
    "book",  // Single word
    "tomorrow",  // Vague time
    "help",  // Generic help
    "cancel my",  // Incomplete cancellation
    "reschedule to",  // Incomplete reschedule
    "emergency",  // Emergency keyword alone
    "pain",  // Single symptom
    "🦷😊📅",  // Emojis only
    "1234567890",  // Numbers only
    "Hi Sarah, I need an appointment for cleaning on Feb 30th",  // Invalid date
    "Book me at 25:00",  // Invalid time
    "I need appointment yesterday",  // Past date
    "Can you book me for Sunday at 3am?",  // Unusual time
    
    // Normal cases (should also never fail)
    "Hello Sarah",
    "I need to book an appointment",
    "What services do you offer?",
    "Do you have availability tomorrow?",
    "I have a toothache",
    "Can you help me?",
    "What are your hours?",
    "How much does a cleaning cost?",
    "I need to cancel my appointment",
    "This is an emergency"
  ];
  
  let successCount = 0;
  let responseCount = 0;
  const failedCases = [];
  
  for (const [index, testCase] of testCases.entries()) {
    const displayCase = testCase || "(empty message)";
    console.log(`Test ${index + 1}/${testCases.length}: "${displayCase}"`);
    
    try {
      const response = await axios.post(`${API_URL}/ai/process-conversation`, {
        message: testCase || " ", // Ensure we always send something
        context: {
          conversationId: `resilience-test-${Date.now()}-${index}`,
          history: [],
          type: 'receptionist',
          isVoice: false
        }
      });
      
      const data = response.data;
      
      // Check if we got a valid response
      if (data && data.message && data.message.length > 0) {
        console.log(`✅ Response: "${data.message.substring(0, 60)}..."`);
        successCount++;
        responseCount++;
      } else {
        console.log(`⚠️ Empty response received`);
        failedCases.push({ test: displayCase, reason: 'Empty response' });
      }
      
    } catch (error) {
      console.log(`❌ ERROR: ${error.response?.status || error.code} - ${error.message}`);
      failedCases.push({ 
        test: displayCase, 
        reason: error.response?.data?.error || error.message 
      });
    }
    
    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  console.log();
  console.log('='.repeat(80));
  console.log('ERROR RESILIENCE TEST RESULTS');
  console.log('='.repeat(80));
  console.log(`Total Tests: ${testCases.length}`);
  console.log(`✅ Successful Responses: ${successCount}`);
  console.log(`📝 Valid Responses: ${responseCount}`);
  console.log(`❌ Failed Cases: ${failedCases.length}`);
  console.log(`Success Rate: ${((successCount / testCases.length) * 100).toFixed(1)}%`);
  
  if (failedCases.length > 0) {
    console.log();
    console.log('Failed Test Cases:');
    failedCases.forEach(fc => {
      console.log(`  - "${fc.test}": ${fc.reason}`);
    });
  }
  
  if (successCount === testCases.length) {
    console.log();
    console.log('🎉 PERFECT! Sarah responded to EVERY single test case!');
    console.log('✨ No errors, no failures - 100% resilient!');
  } else {
    console.log();
    console.log('⚠️ Some cases failed - Sarah should NEVER fail to respond');
  }
}

testErrorResilience().catch(console.error);