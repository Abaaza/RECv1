import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';

class AIApiService {
  constructor() {
    this.conversationId = Date.now().toString();
    this.conversationHistory = [];
  }

  async processMessage(message) {
    try {
      // Add to conversation history
      this.conversationHistory.push({ role: 'user', content: message });
      
      // Keep only last 10 messages for context
      if (this.conversationHistory.length > 10) {
        this.conversationHistory = this.conversationHistory.slice(-10);
      }

      // Use process-conversation endpoint for intent detection and appointment handling
      const response = await axios.post(`${API_BASE_URL}/ai/process-conversation`, {
        message,
        context: {
          conversationId: this.conversationId,
          history: this.conversationHistory,
          type: 'receptionist',
          isVoice: true
        }
      });

      // Add AI response to history
      const responseText = response.data.message || response.data.response;
      this.conversationHistory.push({ 
        role: 'assistant', 
        content: responseText 
      });

      // Check if appointment was created
      if (response.data.appointment) {
        console.log('Appointment created:', response.data.appointment);
      }

      return {
        response: responseText,
        type: response.data.intent || 'general',
        intent: response.data.intent,
        metadata: response.data,
        appointment: response.data.appointment
      };
    } catch (error) {
      console.error('AI API Error:', error);
      
      // Fallback to a simple response if API fails
      return {
        response: "I apologize, I'm having trouble processing your request. Could you please try again?",
        type: 'error',
        error: error.message
      };
    }
  }

  resetConversation() {
    this.conversationId = Date.now().toString();
    this.conversationHistory = [];
  }
}

export default new AIApiService();