import { logger } from '../utils/logger.js';

// Filler words and sounds that don't need responses
const FILLER_WORDS = [
  'um', 'uh', 'umm', 'uhh', 'ah', 'ahh', 'aah', 'oh', 'ohh',
  'hmm', 'hmmm', 'mm', 'mmm', 'er', 'err', 'erm',
  'like', 'you know', 'well', 'so', 'yeah', 'ok', 'okay',
  'right', 'alright', 'sure', 'yes', 'no', 'maybe'
];

// Thinking sounds that indicate the user is still formulating their thought
const THINKING_SOUNDS = ['um', 'uh', 'umm', 'uhh', 'ah', 'ahh', 'er', 'hmm'];

// Acknowledgments that don't need detailed responses
const SIMPLE_ACKNOWLEDGMENTS = ['ok', 'okay', 'yes', 'yeah', 'sure', 'alright', 'right', 'got it'];

// Track recent responses to avoid repetition
class ResponseTracker {
  constructor() {
    this.recentResponses = [];
    this.maxHistory = 10;
    this.lastResponseTime = null;
    this.lastResponseType = null;
  }

  addResponse(response, type) {
    this.recentResponses.push({ response, type, timestamp: Date.now() });
    if (this.recentResponses.length > this.maxHistory) {
      this.recentResponses.shift();
    }
    this.lastResponseTime = Date.now();
    this.lastResponseType = type;
  }

  isRepetitive(response) {
    // Check if this exact response was used in the last 5 responses
    const recent = this.recentResponses.slice(-5);
    return recent.some(r => r.response === response);
  }

  timeSinceLastResponse() {
    if (!this.lastResponseTime) return Infinity;
    return Date.now() - this.lastResponseTime;
  }
}

const responseTracker = new ResponseTracker();

// Natural acknowledgment phrases for filler words
const NATURAL_ACKNOWLEDGMENTS = [
  "Mhm...",
  "I'm listening...",
  "Take your time...",
  "Yes?",
  "Go ahead...",
  "I'm here...",
  "Sure, what can I help with?",
  "How can I assist you?",
  ""  // Sometimes silence is best
];

// Context-aware responses for different situations
const CONTEXTUAL_RESPONSES = {
  waiting_for_info: [
    "Take your time, I'm here when you're ready.",
    "No rush at all.",
    "I'm listening whenever you're ready.",
    "Feel free to ask me anything about our services."
  ],
  
  clarification: [
    "Could you tell me a bit more about that?",
    "I'd be happy to help - what specifically would you like to know?",
    "Let me help you with that - what information do you need?"
  ],
  
  appointment_context: [
    "Were you looking to schedule an appointment?",
    "Did you want to book a visit with us?",
    "Would you like me to check our availability?"
  ],
  
  greeting_followup: [
    "What brings you in today?",
    "How can I help you today?",
    "What can I do for you?"
  ]
};

export function analyzeMessage(message, conversationHistory = []) {
  const lowerMessage = message.toLowerCase().trim();
  const words = lowerMessage.split(/\s+/);
  
  // Analyze message characteristics
  const analysis = {
    isFillerOnly: false,
    isThinking: false,
    isAcknowledgment: false,
    needsResponse: true,
    suggestedResponseType: 'normal',
    confidence: 1.0,
    intent: null,
    isEmpty: false,
    originalMessage: message
  };

  // Check if message is empty or just punctuation
  if (!lowerMessage || lowerMessage.match(/^[.,!?]+$/)) {
    analysis.isEmpty = true;
    analysis.needsResponse = false;
    return analysis;
  }

  // Check if it's just a filler word or thinking sound
  if (words.length <= 2) {
    const isAllFiller = words.every(word => 
      FILLER_WORDS.includes(word.replace(/[.,!?]/g, ''))
    );
    
    if (isAllFiller) {
      analysis.isFillerOnly = true;
      
      // Check if it's a thinking sound
      if (words.some(word => THINKING_SOUNDS.includes(word.replace(/[.,!?]/g, '')))) {
        analysis.isThinking = true;
        analysis.suggestedResponseType = 'patience';
        analysis.needsResponse = responseTracker.timeSinceLastResponse() > 5000; // Only respond if 5+ seconds passed
      }
      // Check if it's an acknowledgment
      else if (words.some(word => SIMPLE_ACKNOWLEDGMENTS.includes(word.replace(/[.,!?]/g, '')))) {
        analysis.isAcknowledgment = true;
        analysis.suggestedResponseType = 'continue';
        analysis.needsResponse = conversationHistory.length === 0; // Only respond if no context
      }
    }
  }

  // Detect conversation intent
  if (lowerMessage.includes('appointment') || lowerMessage.includes('schedule') || lowerMessage.includes('book')) {
    analysis.intent = 'appointment';
  } else if (lowerMessage.includes('cancel') || lowerMessage.includes('reschedule')) {
    analysis.intent = 'modification';
  } else if (lowerMessage.includes('emergency') || lowerMessage.includes('pain') || lowerMessage.includes('urgent')) {
    analysis.intent = 'emergency';
  } else if (lowerMessage.match(/^(hi|hello|hey|good\s+(morning|afternoon|evening))/)) {
    analysis.intent = 'greeting';
  }

  return analysis;
}

export function generateNaturalResponse(analysis, conversationHistory = []) {
  // If no response needed, return null
  if (!analysis.needsResponse || analysis.isEmpty) {
    return null;
  }

  // For thinking sounds, give a patient acknowledgment
  if (analysis.isThinking) {
    const responses = NATURAL_ACKNOWLEDGMENTS.filter(r => r !== "");
    const response = responses[Math.floor(Math.random() * responses.length)];
    
    // Avoid repetition
    if (responseTracker.isRepetitive(response)) {
      return null; // Stay quiet if we'd repeat ourselves
    }
    
    responseTracker.addResponse(response, 'acknowledgment');
    return response;
  }

  // For simple acknowledgments, only respond if needed for context
  if (analysis.isAcknowledgment && conversationHistory.length > 0) {
    // User acknowledged something, continue the flow
    const lastBotMessage = conversationHistory.filter(m => m.role === 'assistant').pop();
    
    if (lastBotMessage && lastBotMessage.content.includes('?')) {
      // We asked a question, they said ok/yes, prompt for more info
      return "Great! What specifically would you like to know?";
    }
    
    // Otherwise, stay quiet
    return null;
  }

  // For other cases, return null to let OpenAI handle it
  return null;
}

export function enhanceOpenAIPrompt(message, analysis, conversationHistory = []) {
  // Build enhanced context for OpenAI
  const enhancedContext = {
    originalMessage: message,
    isNaturalConversation: true,
    messageAnalysis: analysis,
    conversationStage: determineConversationStage(conversationHistory),
    recentTopics: extractRecentTopics(conversationHistory),
    instructions: []
  };

  // Add specific instructions based on analysis
  if (analysis.isFillerOnly) {
    enhancedContext.instructions.push("The user used a filler word. Respond naturally and help guide the conversation.");
  }

  if (analysis.intent) {
    enhancedContext.instructions.push(`The user seems interested in: ${analysis.intent}`);
  }

  // Add variety instruction
  const recentResponses = responseTracker.recentResponses.slice(-3).map(r => r.response);
  if (recentResponses.length > 0) {
    enhancedContext.instructions.push(`Avoid these recent phrases: ${recentResponses.join(', ')}`);
  }

  return enhancedContext;
}

function determineConversationStage(history) {
  if (history.length === 0) return 'initial';
  if (history.length <= 2) return 'greeting';
  
  const recentMessages = history.slice(-4);
  const hasAppointmentMention = recentMessages.some(m => 
    m.content.toLowerCase().includes('appointment') || 
    m.content.toLowerCase().includes('schedule')
  );
  
  if (hasAppointmentMention) return 'appointment_discussion';
  
  return 'general_inquiry';
}

function extractRecentTopics(history) {
  const topics = [];
  const recentMessages = history.slice(-6);
  
  const topicKeywords = {
    appointment: ['appointment', 'schedule', 'book', 'availability'],
    service: ['cleaning', 'filling', 'checkup', 'crown', 'root canal'],
    time: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'morning', 'afternoon'],
    insurance: ['insurance', 'coverage', 'payment']
  };
  
  recentMessages.forEach(msg => {
    const lower = msg.content.toLowerCase();
    Object.entries(topicKeywords).forEach(([topic, keywords]) => {
      if (keywords.some(kw => lower.includes(kw)) && !topics.includes(topic)) {
        topics.push(topic);
      }
    });
  });
  
  return topics;
}

export function shouldInterrupt(currentTranscript, timeSinceLastWord) {
  // Don't interrupt if user is still speaking
  if (timeSinceLastWord < 1000) return false;
  
  // Check if it's just a filler
  const analysis = analyzeMessage(currentTranscript);
  
  // For thinking sounds, wait longer
  if (analysis.isThinking) {
    return timeSinceLastWord > 2000;
  }
  
  // For normal speech, use standard timing
  return timeSinceLastWord > 1500;
}

export default {
  analyzeMessage,
  generateNaturalResponse,
  enhanceOpenAIPrompt,
  shouldInterrupt,
  responseTracker
};