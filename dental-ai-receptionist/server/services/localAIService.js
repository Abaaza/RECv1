import { logger } from '../utils/logger.js';

// Local AI responses for Sarah (the dental receptionist)
const sarahResponses = {
  greetings: [
    "Hello! This is Sarah from SmileCare Dental. How can I help you today?",
    "Hi there! Welcome to SmileCare Dental. I'm Sarah, your virtual assistant. What can I do for you?",
    "Good day! I'm Sarah, ready to assist you with your dental needs. How may I help?"
  ],
  
  appointments: {
    schedule: [
      "I'd be happy to schedule an appointment for you. What day works best for you?",
      "Let me check our availability. When would you prefer to come in?",
      "I can help you book an appointment. Do you have a preferred date and time?"
    ],
    confirm: [
      "Perfect! I've scheduled your appointment for {date} at {time}. We'll send you a confirmation email.",
      "Your appointment is confirmed for {date} at {time}. Is there anything specific you'd like the doctor to know?",
      "All set! You're booked for {date} at {time}. Please arrive 10 minutes early for paperwork."
    ],
    cancel: [
      "I understand you need to cancel. Would you like to reschedule for another time?",
      "No problem, I've canceled your appointment. When would be a better time for you?",
      "Your appointment has been canceled. Feel free to call us when you're ready to reschedule."
    ]
  },
  
  services: [
    "We offer comprehensive dental services including cleanings, fillings, crowns, root canals, teeth whitening, and cosmetic dentistry. What service are you interested in?",
    "Our services include preventive care, restorative treatments, cosmetic procedures, and emergency dental care. How can we help you?",
    "We provide general dentistry, orthodontics, oral surgery, and specialized treatments. What brings you to us today?"
  ],
  
  emergency: [
    "I understand you're experiencing a dental emergency. Can you describe your symptoms? Are you in severe pain?",
    "For dental emergencies, we have same-day appointments available. What kind of emergency are you experiencing?",
    "I'm sorry to hear you're in pain. Let me help you get immediate care. What's happening with your tooth?"
  ],
  
  insurance: [
    "We accept most major dental insurance plans including Delta Dental, Cigna, Aetna, and BlueCross BlueShield. What insurance do you have?",
    "We work with many insurance providers. Can you tell me which insurance you have so I can check your coverage?",
    "We'll be happy to verify your insurance benefits. What's your insurance provider?"
  ],
  
  location: [
    "We're located at 123 Main Street, Suite 200. We're in the medical plaza next to the hospital. Our hours are Monday-Friday 9 AM to 5 PM.",
    "You can find us at 123 Main Street, Suite 200. There's free parking available. We're open weekdays from 9 to 5.",
    "Our office is at 123 Main Street, Suite 200. We have convenient parking and wheelchair access. Would you like directions?"
  ],
  
  costs: [
    "Our pricing varies depending on the procedure. We offer payment plans and accept CareCredit. Would you like a cost estimate for a specific treatment?",
    "We provide transparent pricing and offer various payment options. What procedure are you interested in learning about?",
    "Costs depend on the treatment needed. We offer free consultations to discuss treatment plans and pricing. Shall I schedule one for you?"
  ],
  
  default: [
    "I understand your concern. Let me help you with that. Can you provide more details?",
    "I'm here to assist you. Could you tell me more about what you need?",
    "I'd be happy to help. What specific information are you looking for?"
  ]
};

// Keywords mapping
const keywordMap = {
  greeting: ['hello', 'hi', 'hey', 'good morning', 'good afternoon', 'good evening'],
  appointment: ['appointment', 'schedule', 'book', 'cancel', 'reschedule', 'availability'],
  emergency: ['emergency', 'pain', 'hurt', 'bleeding', 'broken', 'severe', 'urgent'],
  insurance: ['insurance', 'coverage', 'plan', 'copay', 'deductible', 'accepted'],
  location: ['where', 'location', 'address', 'directions', 'hours', 'open'],
  services: ['services', 'offer', 'provide', 'treatment', 'procedure', 'what do you do'],
  costs: ['cost', 'price', 'expensive', 'payment', 'how much', 'fee']
};

// Analyze message intent
function analyzeIntent(message) {
  const lowerMessage = message.toLowerCase();
  
  for (const [intent, keywords] of Object.entries(keywordMap)) {
    for (const keyword of keywords) {
      if (lowerMessage.includes(keyword)) {
        return intent;
      }
    }
  }
  
  return 'default';
}

// Get appropriate response
function getResponse(intent, subIntent = null) {
  let responses;
  
  switch(intent) {
    case 'greeting':
      responses = sarahResponses.greetings;
      break;
    case 'appointment':
      if (subIntent) {
        responses = sarahResponses.appointments[subIntent] || sarahResponses.appointments.schedule;
      } else {
        responses = sarahResponses.appointments.schedule;
      }
      break;
    case 'emergency':
      responses = sarahResponses.emergency;
      break;
    case 'insurance':
      responses = sarahResponses.insurance;
      break;
    case 'location':
      responses = sarahResponses.location;
      break;
    case 'services':
      responses = sarahResponses.services;
      break;
    case 'costs':
      responses = sarahResponses.costs;
      break;
    default:
      responses = sarahResponses.default;
  }
  
  // Return random response from the category
  return responses[Math.floor(Math.random() * responses.length)];
}

// Track conversation state
const conversationStates = new Map();

// Parse appointment details from message
function extractAppointmentDetails(message) {
  const details = {};
  const lowerMessage = message.toLowerCase();
  
  // Extract date mentions
  const months = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  
  // Check for month mentions
  months.forEach((month, index) => {
    if (lowerMessage.includes(month)) {
      details.month = month;
      details.monthNum = index + 1;
    }
  });
  
  // Check for day mentions
  days.forEach(day => {
    if (lowerMessage.includes(day)) {
      details.dayOfWeek = day;
    }
  });
  
  // Extract date numbers (1-31)
  const dateMatch = message.match(/\b([1-9]|[12][0-9]|3[01])(st|nd|rd|th)?\b/);
  if (dateMatch) {
    details.date = parseInt(dateMatch[1]);
  }
  
  // Extract time
  const timeMatch = message.match(/\b(\d{1,2}):?(\d{2})?\s*(am|pm|AM|PM)?\b/);
  if (timeMatch) {
    details.time = timeMatch[0];
  }
  
  // Check for service type
  if (lowerMessage.includes('cleaning')) details.service = 'cleaning';
  else if (lowerMessage.includes('filling')) details.service = 'filling';
  else if (lowerMessage.includes('checkup')) details.service = 'checkup';
  else if (lowerMessage.includes('dental')) details.service = 'general dental';
  
  return details;
}

// Main response generator
export const generateLocalAIResponse = async (message, context = {}) => {
  try {
    logger.info('Generating local AI response for:', message);
    
    // Get or create conversation state
    const conversationId = context.conversationId || 'default';
    let state = conversationStates.get(conversationId) || {
      step: 'initial',
      appointmentDetails: {}
    };
    
    // Extract appointment details from current message
    const extractedDetails = extractAppointmentDetails(message);
    
    // Merge extracted details with existing state
    state.appointmentDetails = { ...state.appointmentDetails, ...extractedDetails };
    
    // Analyze the message intent
    const intent = analyzeIntent(message);
    const lowerMessage = message.toLowerCase();
    
    let response = '';
    let responseType = 'general';
    
    // Handle appointment booking flow
    if (intent === 'appointment' || state.step !== 'initial') {
      responseType = 'appointment';
      
      // Check what information we have
      const hasDate = state.appointmentDetails.date || state.appointmentDetails.dayOfWeek || state.appointmentDetails.month;
      const hasTime = state.appointmentDetails.time;
      const hasService = state.appointmentDetails.service;
      
      if (!hasDate) {
        response = "I'd be happy to help you schedule an appointment. What date would work best for you? You can say something like 'Monday' or 'December 15th'.";
        state.step = 'collecting_date';
      } else if (!hasTime) {
        const dateStr = state.appointmentDetails.dayOfWeek || 
                       `${state.appointmentDetails.month || 'that day'} ${state.appointmentDetails.date || ''}`;
        response = `Great! I can check availability for ${dateStr}. What time would you prefer? We have openings from 9 AM to 5 PM.`;
        state.step = 'collecting_time';
      } else if (!hasService) {
        response = "What type of appointment do you need? We offer cleanings, checkups, fillings, and other dental services.";
        state.step = 'collecting_service';
      } else {
        // We have all details
        const dateStr = state.appointmentDetails.dayOfWeek || 
                       `${state.appointmentDetails.month || ''} ${state.appointmentDetails.date || ''}`.trim();
        response = `Perfect! I've scheduled your ${state.appointmentDetails.service} appointment for ${dateStr} at ${state.appointmentDetails.time}. ` +
                  `We'll send you a confirmation email shortly. Please arrive 10 minutes early for any necessary paperwork. ` +
                  `Is there anything else I can help you with?`;
        
        // Reset state after booking
        state = { step: 'initial', appointmentDetails: {} };
      }
    } else if (intent === 'emergency') {
      responseType = 'emergency';
      response = sarahResponses.emergency[0];
    } else if (intent === 'greeting') {
      response = sarahResponses.greetings[0];
    } else if (lowerMessage.includes('okay') || lowerMessage.includes('ok')) {
      // Handle acknowledgments in context
      if (state.step !== 'initial') {
        response = "I'm still waiting for some information to complete your appointment booking. " + 
                  (state.step === 'collecting_date' ? "What date would work for you?" :
                   state.step === 'collecting_time' ? "What time would you prefer?" :
                   state.step === 'collecting_service' ? "What type of appointment do you need?" :
                   "How can I help you?");
      } else {
        response = "How can I help you today? Would you like to schedule an appointment?";
      }
    } else {
      // Default response based on intent
      response = getResponse(intent);
    }
    
    // Save conversation state
    conversationStates.set(conversationId, state);
    
    // Clean up old conversation states (older than 1 hour)
    if (conversationStates.size > 100) {
      const oldestKey = conversationStates.keys().next().value;
      conversationStates.delete(oldestKey);
    }
    
    // Add context-specific modifications
    if (context.isVoice) {
      // Make response more conversational for voice
      response = response.replace(/\. /g, '... ');
    }
    
    logger.info('Local AI response generated successfully');
    
    return {
      response,
      intent,
      type: responseType,
      confidence: 0.95,
      metadata: {
        isLocalAI: true,
        model: 'sarah-local-v2',
        timestamp: new Date().toISOString(),
        conversationState: state
      }
    };
    
  } catch (error) {
    logger.error('Error generating local AI response:', error);
    return {
      response: "I apologize, I'm having trouble understanding. Could you please rephrase your question?",
      intent: 'error',
      type: 'general',
      confidence: 0.5,
      metadata: {
        isLocalAI: true,
        error: true
      }
    };
  }
};

// Enhanced response with conversation memory
export const generateContextualResponse = async (message, conversationHistory = []) => {
  try {
    // Check if this is a follow-up question
    const lastExchange = conversationHistory[conversationHistory.length - 1];
    let context = {};
    
    if (lastExchange && lastExchange.intent === 'appointment') {
      // Carry appointment context forward
      context.previousIntent = 'appointment';
    }
    
    const response = await generateLocalAIResponse(message, context);
    
    // Add personality touches
    if (Math.random() > 0.7) {
      response.response += " Is there anything else I can help you with today?";
    }
    
    return response;
    
  } catch (error) {
    logger.error('Error in contextual response:', error);
    return generateLocalAIResponse(message);
  }
};

export default {
  generateLocalAIResponse,
  generateContextualResponse
};