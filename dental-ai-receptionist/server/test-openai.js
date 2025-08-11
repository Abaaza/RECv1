import dotenv from 'dotenv';
import OpenAI from 'openai';

dotenv.config();

console.log('OpenAI API Key exists:', !!process.env.OPENAI_API_KEY);
console.log('Key starts with:', process.env.OPENAI_API_KEY?.substring(0, 10));

if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'your-openai-api-key') {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  });
  
  try {
    console.log('Testing OpenAI connection...');
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: 'You are a helpful dental receptionist.' },
        { role: 'user', content: 'I need to schedule an appointment' }
      ],
      max_tokens: 100
    });
    
    console.log('OpenAI Response:', completion.choices[0].message.content);
    console.log('OpenAI is working!');
  } catch (error) {
    console.error('OpenAI Error:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }
  }
} else {
  console.log('OpenAI key not configured or is placeholder');
}

process.exit(0);