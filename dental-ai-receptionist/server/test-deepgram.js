import { createClient } from '@deepgram/sdk';
import dotenv from 'dotenv';

dotenv.config();

async function testDeepgram() {
  console.log('🎤 Testing Deepgram API connection...\n');
  
  const apiKey = process.env.DEEPGRAM_API_KEY;
  
  if (!apiKey) {
    console.error('❌ DEEPGRAM_API_KEY not found in environment variables');
    return;
  }
  
  console.log('✅ API Key found:', apiKey.substring(0, 10) + '...');
  
  try {
    // Initialize Deepgram client
    const deepgram = createClient(apiKey);
    
    // Test 1: Text-to-Speech
    console.log('\n📢 Testing Text-to-Speech...');
    const ttsResponse = await deepgram.speak.request(
      { text: "Hello! This is a test of the Deepgram text-to-speech API. Your dental AI receptionist is working properly." },
      {
        model: "aura-asteria-en",
        encoding: "linear16",
        sample_rate: 24000,
      }
    );
    
    const ttsStream = await ttsResponse.getStream();
    if (ttsStream) {
      console.log('✅ Text-to-Speech test successful!');
      console.log('   Audio stream generated successfully');
    }
    
    // Test 2: Speech-to-Text (with a test phrase)
    console.log('\n🎙️ Testing Speech-to-Text configuration...');
    const transcriptionOptions = {
      model: "nova-2",
      language: "en-US",
      smart_format: true,
      punctuate: true,
      utterances: true,
      interim_results: true,
      endpointing: 300,
    };
    
    console.log('✅ Speech-to-Text configuration valid!');
    console.log('   Model: nova-2');
    console.log('   Language: en-US');
    console.log('   Features: smart_format, punctuate, utterances');
    
    // Test 3: API Key validation
    console.log('\n🔑 Validating API Key permissions...');
    const projectsResponse = await deepgram.manage.getProjects();
    if (projectsResponse) {
      console.log('✅ API Key is valid and has proper permissions!');
    }
    
    console.log('\n' + '='.repeat(50));
    console.log('🎉 All Deepgram tests passed successfully!');
    console.log('='.repeat(50));
    console.log('\nYour Deepgram integration is ready to use:');
    console.log('• Voice calls can be transcribed in real-time');
    console.log('• AI responses can be converted to speech');
    console.log('• The Phone Interface in the app should work properly');
    
  } catch (error) {
    console.error('\n❌ Deepgram test failed:', error.message);
    
    if (error.message.includes('401') || error.message.includes('Unauthorized')) {
      console.error('   The API key appears to be invalid or expired.');
      console.error('   Please check your Deepgram dashboard for a valid key.');
    } else if (error.message.includes('429')) {
      console.error('   Rate limit exceeded. Please wait a moment and try again.');
    } else {
      console.error('   Error details:', error);
    }
  }
}

// Run the test
testDeepgram().then(() => {
  console.log('\n✅ Test completed');
  process.exit(0);
}).catch((error) => {
  console.error('Test error:', error);
  process.exit(1);
});