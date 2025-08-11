// Fallback responses to ensure Sarah always has something to say
const fallbackResponses = {
  general: [
    "I'm sorry, could you repeat that again?",
    "I'm sorry, I didn't quite understand. Could you tell me what you need?",
    "Sorry, could you please clarify what you're looking for?",
    "I'm sorry, could you say that again? I want to help you.",
    "Sorry, I didn't catch that. How can I assist you today?"
  ],
  
  appointment_booking: [
    "I'd be happy to help you schedule an appointment. What day works best for you?",
    "Let me check our availability for you. When would you prefer to come in?",
    "I can certainly help with booking your appointment. Do you have a preferred date and time?",
    "Great! I'll help you find the perfect appointment slot. What type of service do you need?",
    "I'll assist you with scheduling. Are you looking for a specific day or time?"
  ],
  
  appointment_error: [
    "I'm working on booking your appointment. Could you tell me what day you prefer?",
    "Let me try that again. What date and time would work best for you?",
    "I want to make sure I get this right. When would you like to schedule your appointment?",
    "I'll help you book that appointment. Could you provide your preferred date and time?",
    "Let me assist you with scheduling. What day of the week works best for you?"
  ],
  
  emergency: [
    "I understand this is urgent. Please describe your symptoms so I can provide the best assistance.",
    "I'm here to help with your emergency. Can you tell me more about what you're experiencing?",
    "For immediate assistance, please describe your dental emergency and I'll guide you through what to do.",
    "I recognize this is an emergency situation. Let me help you right away. What symptoms are you experiencing?",
    "Your emergency is my priority. Please tell me what's happening so I can provide immediate guidance."
  ],
  
  cancellation: [
    "I can help you with that cancellation. Do you have your appointment confirmation number?",
    "I'll assist you with canceling or rescheduling. Can you provide your appointment details?",
    "No problem, I can help cancel your appointment. What's your confirmation number or the date of your appointment?",
    "I'll help you with the cancellation. Could you tell me when your appointment was scheduled?",
    "Let me help you cancel that appointment. Do you have the confirmation number handy?"
  ],
  
  greeting: [
    "Hello! I'm Sarah, your dental care assistant. How can I help you today?",
    "Hi there! Welcome to SmileCare Dental. What brings you in today?",
    "Good to hear from you! I'm here to help with all your dental needs.",
    "Hello! I'm ready to assist you. Do you need to schedule an appointment or have questions about our services?",
    "Hi! I'm Sarah, and I'm here to make your dental care experience as smooth as possible. How can I assist?"
  ],
  
  confusion: [
    "I'm sorry, could you repeat that again?",
    "I'm sorry, I didn't quite catch that. Could you say that again?",
    "Sorry, could you please repeat that?",
    "I'm sorry, could you rephrase that for me?",
    "Sorry, I didn't understand. Could you say that again please?"
  ],
  
  technical_error: [
    "I'm here and ready to help. What can I do for you today?",
    "Let me assist you. Do you need to book an appointment or have questions?",
    "I'm ready to help with your dental needs. What would you like to do?",
    "How can I make your day better? I can help with appointments or answer questions.",
    "I'm here to help! Tell me what you need and I'll take care of it."
  ]
};

// Get a random response from a category
export function getRandomFallback(category) {
  const responses = fallbackResponses[category] || fallbackResponses.general;
  return responses[Math.floor(Math.random() * responses.length)];
}

// Detect intent from message to choose appropriate fallback
export function detectIntentForFallback(message) {
  const lower = message.toLowerCase();
  
  if (lower.match(/^(hi|hello|hey|good\s+(morning|afternoon|evening))/)) {
    return 'greeting';
  }
  
  if (lower.includes('appointment') || lower.includes('book') || lower.includes('schedule')) {
    return 'appointment_booking';
  }
  
  if (lower.includes('cancel') || lower.includes('reschedule')) {
    return 'cancellation';
  }
  
  if (lower.includes('emergency') || lower.includes('urgent') || lower.includes('pain')) {
    return 'emergency';
  }
  
  if (lower.includes('?') || lower.includes('what') || lower.includes('how') || lower.includes('when')) {
    return 'confusion';
  }
  
  return 'general';
}

// Build a contextual response based on conversation history
export function buildContextualFallback(message, context) {
  const intent = detectIntentForFallback(message);
  let response = getRandomFallback(intent);
  
  // Add personalization if we have context
  if (context?.patientName) {
    response = response.replace('!', `, ${context.patientName}!`);
  }
  
  // Add time-based greeting
  const hour = new Date().getHours();
  if (intent === 'greeting') {
    let timeGreeting = 'Good ';
    if (hour < 12) timeGreeting += 'morning';
    else if (hour < 17) timeGreeting += 'afternoon';
    else timeGreeting += 'evening';
    
    response = `${timeGreeting}! ${response}`;
  }
  
  return response;
}

// Ensure we always have a valid response
export function ensureValidResponse(response) {
  // Check if response is valid
  if (!response || typeof response !== 'string' || response.trim().length === 0) {
    return getRandomFallback('general');
  }
  
  // Check for error-like responses
  if (response.toLowerCase().includes('error') || 
      response.toLowerCase().includes('failed') ||
      response.toLowerCase().includes('undefined')) {
    return getRandomFallback('technical_error');
  }
  
  return response;
}

export default {
  getRandomFallback,
  detectIntentForFallback,
  buildContextualFallback,
  ensureValidResponse
};