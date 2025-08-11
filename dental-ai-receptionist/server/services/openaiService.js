import OpenAI from 'openai';
import { logger } from '../utils/logger.js';
import naturalConversation from './naturalConversationService.js';
import aiAppointmentHandler from './aiAppointmentHandler.js';

// Initialize OpenAI with dynamic key checking
const getOpenAI = () => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (apiKey && apiKey !== 'your-openai-api-key' && apiKey !== 'YOUR_NEW_KEY_HERE') {
    return new OpenAI({ apiKey });
  }
  return null;
};

const systemPrompts = {
  receptionist: `You are Sarah, a warm and friendly dental receptionist at SmileCare Dental Clinic. Speak naturally and conversationally, like a real person would on the phone.

IMPORTANT CONVERSATION RULES:
- Be conversational and natural, not robotic or overly formal
- Use contractions (I'll, you're, we've, etc.) 
- Add natural phrases like "Let me check that for you" or "One moment"
- Show empathy with phrases like "I understand" or "I can definitely help with that"
- Vary your responses - never use the same greeting or phrase repeatedly
- If someone says "um", "uh", or hesitates, be patient and encouraging
- Keep responses concise for phone conversations (1-2 sentences usually)
- Sound engaged and interested in helping

Your personality:
- Warm and approachable
- Patient and understanding 
- Professional but not stiff
- Genuinely caring about patients' needs
- Good sense of appropriate humor when suitable

When handling appointments:
- I have access to real-time scheduling - I will check availability and book actual appointments
- Be specific with available times based on actual openings
- Always confirm: name, date, time, and type of appointment
- If a slot isn't available, offer 2 specific alternatives
- For emergencies, prioritize finding the soonest available slot
- Always end bookings with: "Please arrive 10 minutes early for paperwork"

Remember: You're having a natural phone conversation, not reading from a script.`,

  symptom_analysis: `You are a dental health assistant helping to analyze symptoms. 
Provide general guidance based on common dental conditions, but always emphasize that a proper diagnosis requires an in-person examination by a dentist.
Categorize urgency levels as: emergency (immediate care needed), urgent (within 24-48 hours), or routine (regular appointment).
Never provide definitive diagnoses or prescribe medications.`,

  emergency_triage: `You are an emergency dental triage assistant. 
Assess the severity of dental emergencies and provide immediate first-aid guidance.
Categories: 
- Critical: Requires immediate emergency room visit
- High: Requires emergency dental appointment today
- Moderate: Requires appointment within 24-48 hours
- Low: Can wait for regular appointment

Always err on the side of caution and recommend professional care.`
};

import { generateLocalAIResponse } from './localAIService.js';

export const generateAIResponse = async (message, context = {}) => {
  try {
    // Analyze the message for natural conversation handling
    const analysis = naturalConversation.analyzeMessage(message, context.history || []);
    
    // Check if we should use a quick natural response for fillers
    const quickResponse = naturalConversation.generateNaturalResponse(analysis, context.history || []);
    if (quickResponse) {
      logger.info('Using quick natural response for filler/acknowledgment');
      return quickResponse;
    }
    
    // Check if this is an appointment-related request
    const isAppointmentRelated = message.toLowerCase().match(
      /appointment|schedule|book|cancel|reschedule|available|opening|slot|cleaning|checkup|emergency/i
    );
    
    if (isAppointmentRelated) {
      logger.info('Handling appointment request with smart scheduling');
      
      // Use the AI appointment handler for intelligent booking
      const appointmentResult = await aiAppointmentHandler.handleAppointmentRequest(message, context);
      
      if (appointmentResult.success && appointmentResult.message) {
        // Track the response
        naturalConversation.responseTracker.addResponse(appointmentResult.message, 'appointment');
        
        // Store appointment data in context for future reference
        if (appointmentResult.appointmentBooked) {
          context.lastBookedAppointment = appointmentResult.appointment;
        }
        
        return appointmentResult.message;
      } else if (appointmentResult.needsHumanHelp) {
        // Escalate to human if needed
        return "Let me connect you with one of our staff members who can better assist you with this request. One moment please.";
      }
    }
    
    const openai = getOpenAI();
    
    if (!openai) {
      logger.info('Using local AI assistant (Sarah)');
      const localResponse = await generateLocalAIResponse(message, context);
      return localResponse.response;
    }

    // Get enhanced context for better responses
    const enhancedContext = naturalConversation.enhanceOpenAIPrompt(message, analysis, context.history || []);
    
    // Build the system prompt with enhanced instructions
    let systemPrompt = systemPrompts[context.type] || systemPrompts.receptionist;
    
    // Add dynamic instructions based on conversation analysis
    if (enhancedContext.instructions.length > 0) {
      systemPrompt += '\n\nAdditional context for this response:\n' + enhancedContext.instructions.join('\n');
    }
    
    const messages = [
      { role: 'system', content: systemPrompt }
    ];

    if (context.history) {
      // Keep conversation history but limit to last 10 messages for context
      const recentHistory = context.history.slice(-10);
      messages.push(...recentHistory);
    }

    messages.push({ role: 'user', content: message });

    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages,
      temperature: 0.9,  // Higher for more variety
      max_tokens: 150,   // Shorter for natural conversation
      presence_penalty: 0.6,  // Encourage variety
      frequency_penalty: 0.5,  // Avoid repetition
      top_p: 0.95  // Slightly more focused but still creative
    });

    const response = completion.choices[0].message.content;
    
    // Track this response to avoid repetition
    naturalConversation.responseTracker.addResponse(response, context.type || 'general');
    
    logger.info('AI response generated successfully');

    return response;
  } catch (error) {
    logger.error('OpenAI API error:', error);
    return generateFallbackResponse(message, context);
  }
};

export const analyzeAppointmentRequest = async (message) => {
  try {
    const openai = getOpenAI();
    if (!openai) {
      return extractAppointmentDetailsManually(message);
    }

    const prompt = `Extract appointment details from this message. Return as JSON with fields:
- date (ISO format or null)
- time (HH:MM format or null)  
- type (checkup/cleaning/filling/etc or null)
- urgency (routine/urgent/emergency)
- symptoms (array of symptoms mentioned)

Message: "${message}"`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: 'You are a helper that extracts appointment information from text.' },
        { role: 'user', content: prompt }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
      max_tokens: 200
    });

    const result = JSON.parse(completion.choices[0].message.content);
    
    logger.info('Appointment request analyzed');

    return result;
  } catch (error) {
    logger.error('Failed to analyze appointment request:', error);
    return extractAppointmentDetailsManually(message);
  }
};

export const generateAppointmentSummary = async (appointment) => {
  try {
    const openai = getOpenAI();
    if (!openai) {
      return `Appointment scheduled for ${appointment.date} at ${appointment.time}`;
    }

    const prompt = `Generate a brief, friendly confirmation message for this appointment:
Date: ${appointment.date}
Time: ${appointment.time}
Type: ${appointment.type}
Patient: ${appointment.patientName}
Doctor: ${appointment.dentistName}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: 'Generate brief, friendly appointment confirmations.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 100
    });

    return completion.choices[0].message.content;
  } catch (error) {
    logger.error('Failed to generate appointment summary:', error);
    return `Your ${appointment.type} appointment is confirmed for ${appointment.date} at ${appointment.time} with ${appointment.dentistName}.`;
  }
};

function generateFallbackResponse(message, context) {
  const lowerMessage = message.toLowerCase();
  
  if (context.type === 'emergency_triage') {
    if (lowerMessage.includes('bleeding') || lowerMessage.includes('knocked out')) {
      return 'This appears to be a dental emergency. Apply pressure with clean gauze to control bleeding. If a tooth was knocked out, place it in milk or saliva. Seek immediate dental care.';
    }
    if (lowerMessage.includes('pain') || lowerMessage.includes('swelling')) {
      return 'For severe pain or swelling, apply a cold compress and take over-the-counter pain medication as directed. Contact our office immediately for an emergency appointment.';
    }
  }
  
  if (lowerMessage.includes('appointment')) {
    return 'I can help you schedule an appointment. Please provide your preferred date and time, and I\'ll check our availability.';
  }
  
  if (lowerMessage.includes('hours')) {
    return 'Our office hours are Monday-Friday 9 AM to 5 PM. We also offer emergency services outside regular hours.';
  }
  
  if (lowerMessage.includes('insurance')) {
    return 'We accept most major dental insurance plans. Please provide your insurance information when booking, and we\'ll verify coverage.';
  }
  
  return 'I\'m here to help with your dental needs. You can ask me about appointments, office hours, services, or dental concerns.';
}

function extractAppointmentDetailsManually(message) {
  const lowerMessage = message.toLowerCase();
  
  const details = {
    date: null,
    time: null,
    type: null,
    urgency: 'routine',
    symptoms: []
  };
  
  const dateMatch = message.match(/\b(\d{1,2}\/\d{1,2}\/\d{2,4})\b/);
  if (dateMatch) {
    details.date = new Date(dateMatch[1]).toISOString();
  }
  
  const timeMatch = message.match(/\b(\d{1,2}):(\d{2})\s*(am|pm)?\b/i);
  if (timeMatch) {
    details.time = timeMatch[0];
  }
  
  const types = ['checkup', 'cleaning', 'filling', 'extraction', 'root canal', 'crown'];
  for (const type of types) {
    if (lowerMessage.includes(type)) {
      details.type = type.replace(' ', '-');
      break;
    }
  }
  
  if (lowerMessage.includes('emergency') || lowerMessage.includes('urgent')) {
    details.urgency = 'emergency';
  } else if (lowerMessage.includes('soon') || lowerMessage.includes('asap')) {
    details.urgency = 'urgent';
  }
  
  const symptomKeywords = ['pain', 'ache', 'bleeding', 'swelling', 'sensitive', 'broken', 'cavity'];
  details.symptoms = symptomKeywords.filter(symptom => lowerMessage.includes(symptom));
  
  return details;
}

export const verifyOpenAIConfiguration = async () => {
  try {
    const openai = getOpenAI();
    if (!openai) {
      logger.warn('OpenAI client not configured');
      return false;
    }

    const models = await openai.models.list();
    logger.info('OpenAI configuration verified successfully');
    return true;
  } catch (error) {
    logger.error('OpenAI configuration verification failed:', error);
    return false;
  }
};

export default {
  generateAIResponse,
  analyzeAppointmentRequest,
  generateAppointmentSummary,
  verifyOpenAIConfiguration
};