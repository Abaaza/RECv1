import OpenAI from 'openai';
import { logger } from '../utils/logger.js';

class AIService {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || 'sk-your-api-key-here'
    });
    
    this.systemPrompt = `You are Sarah, a friendly and professional dental office AI receptionist. 
Your main responsibilities are:
1. Schedule appointments
2. Answer questions about dental services
3. Handle emergency dental situations
4. Provide office hours and location information
5. Explain insurance and payment options

Be warm, helpful, and professional. Keep responses concise and clear.
Office hours: Monday-Friday 8AM-5PM, Saturday 9AM-2PM
Location: 123 Main Street, Your City
Phone: (555) 123-4567`;
  }

  async processMessage(message, conversationHistory = []) {
    try {
      // Build messages array with conversation history
      const messages = [
        { role: 'system', content: this.systemPrompt },
        ...conversationHistory.slice(-10), // Keep last 10 messages for context
        { role: 'user', content: message }
      ];

      // Get AI response
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: messages,
        temperature: 0.7,
        max_tokens: 300
      });

      const response = completion.choices[0].message.content;
      
      // Check if it's an emergency
      const isEmergency = this.checkForEmergency(message);
      
      // Extract appointment intent
      const appointmentIntent = this.extractAppointmentIntent(message);

      return {
        response,
        isEmergency,
        appointmentIntent,
        timestamp: new Date()
      };
    } catch (error) {
      logger.error('AI Service Error:', error);
      
      // Fallback response
      return {
        response: "I apologize, but I'm having trouble processing your request. Please call our office at (555) 123-4567 for immediate assistance.",
        error: true,
        timestamp: new Date()
      };
    }
  }

  checkForEmergency(message) {
    const emergencyKeywords = [
      'emergency', 'urgent', 'pain', 'bleeding', 'swelling',
      'broken tooth', 'knocked out', 'severe', 'can\'t sleep'
    ];
    
    const lowerMessage = message.toLowerCase();
    return emergencyKeywords.some(keyword => lowerMessage.includes(keyword));
  }

  extractAppointmentIntent(message) {
    const appointmentKeywords = [
      'appointment', 'schedule', 'book', 'available',
      'opening', 'see the dentist', 'come in'
    ];
    
    const lowerMessage = message.toLowerCase();
    const hasAppointmentIntent = appointmentKeywords.some(keyword => 
      lowerMessage.includes(keyword)
    );

    if (hasAppointmentIntent) {
      // Try to extract date/time preferences
      const timePreferences = this.extractTimePreferences(message);
      return {
        wantsAppointment: true,
        ...timePreferences
      };
    }

    return { wantsAppointment: false };
  }

  extractTimePreferences(message) {
    const preferences = {};
    const lowerMessage = message.toLowerCase();

    // Day preferences
    if (lowerMessage.includes('today')) preferences.day = 'today';
    else if (lowerMessage.includes('tomorrow')) preferences.day = 'tomorrow';
    else if (lowerMessage.includes('monday')) preferences.day = 'monday';
    else if (lowerMessage.includes('tuesday')) preferences.day = 'tuesday';
    else if (lowerMessage.includes('wednesday')) preferences.day = 'wednesday';
    else if (lowerMessage.includes('thursday')) preferences.day = 'thursday';
    else if (lowerMessage.includes('friday')) preferences.day = 'friday';
    else if (lowerMessage.includes('saturday')) preferences.day = 'saturday';

    // Time preferences
    if (lowerMessage.includes('morning')) preferences.timeOfDay = 'morning';
    else if (lowerMessage.includes('afternoon')) preferences.timeOfDay = 'afternoon';
    else if (lowerMessage.includes('evening')) preferences.timeOfDay = 'evening';

    return preferences;
  }
}

const aiService = new AIService();
export default aiService;

// Export individual methods for compatibility
export const analyzeMessage = (message, history) => 
  aiService.processMessage(message, history);
export const processMessage = (message, history) => 
  aiService.processMessage(message, history);