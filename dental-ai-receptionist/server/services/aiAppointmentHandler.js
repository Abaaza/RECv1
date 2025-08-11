import smartScheduling from './smartSchedulingService.js';
import { logger } from '../utils/logger.js';
import { format } from 'date-fns';

class AIAppointmentHandler {
  constructor() {
    this.conversationStates = new Map();
    this.maxAttempts = 3;
    this.stateTimeout = 30 * 60 * 1000; // 30 minutes
  }

  // Main entry point for AI appointment handling
  async handleAppointmentRequest(message, context = {}) {
    try {
      const conversationId = context.conversationId || 'default';
      let state = this.conversationStates.get(conversationId) || {
        step: 'initial',
        appointmentData: {},
        attempts: 0,
        history: [],
        lastUpdated: Date.now(),
        confirmations: {}
      };

      // Add message to history
      state.history.push({ 
        type: 'user', 
        message, 
        timestamp: new Date() 
      });

      // Check for conversation corrections or changes
      const correction = this.detectCorrection(message, state);
      if (correction) {
        state = this.handleCorrection(correction, state);
      }

      // Parse the message for appointment details
      const extractedInfo = this.extractAppointmentInfo(message);
      
      // Smart merge - don't override confirmed data unless explicitly changed
      state.appointmentData = this.smartMergeData(
        state.appointmentData, 
        extractedInfo, 
        state.confirmations
      );
      
      // Update last activity
      state.lastUpdated = Date.now();
      state.attempts = (state.attempts || 0) + 1;
      
      // Check if user is getting frustrated
      if (this.detectFrustration(message, state)) {
        return {
          success: false,
          message: "I understand this is taking longer than expected. Let me connect you with a staff member who can assist you immediately.",
          needsHumanHelp: true,
          escalationReason: 'user_frustration'
        };
      }
      
      // Determine what action to take
      const action = await this.determineAction(message, state, context);
      
      // Execute the action and get response
      const result = await this.executeAction(action, state);
      
      // Track response in history
      if (result.message) {
        state.history.push({ 
          type: 'assistant', 
          message: result.message, 
          timestamp: new Date() 
        });
      }
      
      // Update state with any confirmations
      if (result.confirmed) {
        state.confirmations = { ...state.confirmations, ...result.confirmed };
      }
      
      // Update state
      this.conversationStates.set(conversationId, result.newState || state);
      
      // Clean up old conversations
      this.cleanupOldConversations();
      
      return result;
    } catch (error) {
      logger.error('Error handling appointment request:', error);
      const state = this.conversationStates.get(context.conversationId || 'default') || { attempts: 0 };
      return {
        success: false,
        message: "I apologize, I'm having trouble processing your request. Let me try again.",
        needsHumanHelp: state.attempts >= this.maxAttempts
      };
    }
  }

  // Detect if user is correcting previous information
  detectCorrection(message, state) {
    const lower = message.toLowerCase();
    const correctionPatterns = [
      /actually|wait|sorry|no not|i meant|i mean|change that|different/i,
      /not (\w+), (\w+)/i, // "not Tuesday, Wednesday"
      /instead of/i
    ];
    
    for (const pattern of correctionPatterns) {
      if (pattern.test(lower)) {
        return {
          type: 'correction',
          original: message
        };
      }
    }
    
    return null;
  }

  // Handle corrections in conversation
  handleCorrection(correction, state) {
    // Clear non-confirmed data that might be corrected
    const newState = { ...state };
    
    // Keep only confirmed data
    newState.appointmentData = Object.keys(state.confirmations).reduce((acc, key) => {
      if (state.confirmations[key]) {
        acc[key] = state.appointmentData[key];
      }
      return acc;
    }, {});
    
    // Reset step if needed
    if (newState.step !== 'initial' && newState.step !== 'completed') {
      newState.step = 'correcting';
    }
    
    return newState;
  }

  // Smart merge that respects confirmations
  smartMergeData(existing, extracted, confirmations) {
    const merged = { ...existing };
    
    for (const [key, value] of Object.entries(extracted)) {
      // Only override if not confirmed or explicitly changing
      if (!confirmations[key] || value !== undefined) {
        merged[key] = value;
      }
    }
    
    return merged;
  }

  // Detect user frustration
  detectFrustration(message, state) {
    const lower = message.toLowerCase();
    const frustrationIndicators = [
      /this is taking too long/i,
      /forget it|never mind|cancel everything/i,
      /just book|just schedule|just give me/i,
      /why is this so hard|complicated|difficult/i,
      /i give up|frustrated|annoying/i
    ];
    
    // Check for frustration patterns
    for (const pattern of frustrationIndicators) {
      if (pattern.test(lower)) {
        return true;
      }
    }
    
    // Check if stuck in same step for too long
    if (state.attempts > 5 && state.step === state.previousStep) {
      return true;
    }
    
    return false;
  }

  // Extract appointment information from message
  extractAppointmentInfo(message) {
    const info = {};
    const lower = message.toLowerCase();
    
    // Extract appointment type
    const types = ['cleaning', 'checkup', 'filling', 'root canal', 'crown', 'extraction', 'emergency', 'whitening', 'consultation'];
    for (const type of types) {
      if (lower.includes(type)) {
        info.type = type;
        break;
      }
    }
    
    // Extract date information
    const datePatterns = {
      today: /\btoday\b/i,
      tomorrow: /\btomorrow\b/i,
      monday: /\bmonday\b/i,
      tuesday: /\btuesday\b/i,
      wednesday: /\bwednesday\b/i,
      thursday: /\bthursday\b/i,
      friday: /\bfriday\b/i,
      saturday: /\bsaturday\b/i,
      sunday: /\bsunday\b/i
    };
    
    for (const [key, pattern] of Object.entries(datePatterns)) {
      if (pattern.test(message)) {
        info.preferredDate = key;
        break;
      }
    }
    
    // Extract specific date (e.g., "December 15", "15th")
    const monthMatch = message.match(/(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})/i);
    if (monthMatch) {
      info.preferredDate = `${monthMatch[1]} ${monthMatch[2]}`;
    }
    
    // Extract time
    const timeMatch = message.match(/(\d{1,2}):?(\d{2})?\s*(am|pm|AM|PM)/);
    if (timeMatch) {
      info.preferredTime = timeMatch[0];
    } else if (lower.includes('morning')) {
      info.preferredTime = 'morning';
    } else if (lower.includes('afternoon')) {
      info.preferredTime = 'afternoon';
    } else if (lower.includes('evening')) {
      info.preferredTime = 'evening';
    }
    
    // Extract patient name (if mentioned)
    const nameMatch = message.match(/(?:my name is|i'm|i am|this is)\s+([a-z]+(?:\s+[a-z]+)?)/i);
    if (nameMatch) {
      info.patientName = nameMatch[1];
    }
    
    // Extract phone number
    const phoneMatch = message.match(/(\d{3}[-.\s]?\d{3}[-.\s]?\d{4})/);
    if (phoneMatch) {
      info.patientPhone = phoneMatch[0];
    }
    
    // Extract email
    const emailMatch = message.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
    if (emailMatch) {
      info.patientEmail = emailMatch[0];
    }
    
    // Detect urgency
    if (lower.includes('emergency') || lower.includes('urgent') || lower.includes('pain') || lower.includes('asap')) {
      info.isEmergency = true;
    }
    
    // Detect cancellation/rescheduling
    if (lower.includes('cancel')) {
      info.action = 'cancel';
    } else if (lower.includes('reschedule') || lower.includes('change')) {
      info.action = 'reschedule';
    } else if (lower.includes('book') || lower.includes('schedule') || lower.includes('appointment')) {
      info.action = 'book';
    }
    
    return info;
  }

  // Determine what action to take based on state and message
  async determineAction(message, state, context) {
    const { appointmentData } = state;
    const lower = message.toLowerCase();
    
    // Check for special actions first
    if (appointmentData.action === 'cancel') {
      return { type: 'cancel', data: appointmentData };
    }
    
    if (appointmentData.action === 'reschedule') {
      return { type: 'reschedule', data: appointmentData };
    }
    
    // Check if we're confirming a booking
    if (lower.includes('yes') || lower.includes('confirm') || lower.includes('that works') || lower.includes('perfect')) {
      if (state.pendingAppointment) {
        return { type: 'confirm_booking', data: state.pendingAppointment };
      }
    }
    
    // Check if declining a suggestion
    if (lower.includes('no') || lower.includes('different') || lower.includes('another')) {
      if (state.suggestedSlots) {
        return { type: 'request_alternatives', data: appointmentData };
      }
    }
    
    // Emergency handling
    if (appointmentData.isEmergency) {
      return { type: 'emergency_booking', data: appointmentData };
    }
    
    // Regular appointment booking flow
    if (appointmentData.preferredDate && appointmentData.preferredTime) {
      return { type: 'check_and_book', data: appointmentData };
    }
    
    // Need more information
    return { type: 'gather_info', data: appointmentData };
  }

  // Execute the determined action
  async executeAction(action, state) {
    switch (action.type) {
      case 'check_and_book':
        return await this.checkAndBook(action.data, state);
        
      case 'confirm_booking':
        return await this.confirmBooking(action.data, state);
        
      case 'cancel':
        return await this.cancelAppointment(action.data, state);
        
      case 'reschedule':
        return await this.rescheduleAppointment(action.data, state);
        
      case 'emergency_booking':
        return await this.handleEmergencyBooking(action.data, state);
        
      case 'request_alternatives':
        return await this.suggestAlternatives(action.data, state);
        
      case 'gather_info':
        return await this.gatherMissingInfo(action.data, state);
        
      default:
        return {
          success: false,
          message: "I'm not sure how to help with that. Could you please clarify what you'd like to do?"
        };
    }
  }

  // Check availability and book if possible
  async checkAndBook(data, state) {
    try {
      // Parse the date and time
      const dateTime = smartScheduling.parseDateTime(data.preferredDate, data.preferredTime);
      const duration = this.getAppointmentDuration(data.type);
      
      // Check availability
      const availability = await smartScheduling.checkAvailability(dateTime, duration);
      
      if (availability.available) {
        // If we have all required info, book immediately
        if (data.patientName && (data.patientPhone || data.patientEmail)) {
          const booking = await smartScheduling.bookAppointment({
            patientName: data.patientName,
            patientEmail: data.patientEmail,
            patientPhone: data.patientPhone,
            dateTime: dateTime,
            type: data.type || 'general',
            duration: duration
          });
          
          if (booking.success) {
            return {
              success: true,
              message: `Perfect! I've confirmed your ${data.type || 'dental'} appointment for ${format(dateTime, 'EEEE, MMMM d')} at ${format(dateTime, 'h:mm a')}. We'll send you a confirmation shortly. Please arrive 10 minutes early for any paperwork.`,
              appointmentBooked: true,
              appointment: booking.appointment,
              newState: { step: 'completed', appointmentData: {} }
            };
          }
        } else {
          // Store pending appointment and ask for missing info
          state.pendingAppointment = {
            dateTime,
            type: data.type || 'general',
            duration
          };
          
          if (!data.patientName) {
            return {
              success: true,
              message: `Great! I have ${format(dateTime, 'EEEE, MMMM d')} at ${format(dateTime, 'h:mm a')} available. To confirm this appointment, may I have your full name?`,
              newState: { ...state, step: 'collecting_name', pendingAppointment: state.pendingAppointment }
            };
          } else if (!data.patientPhone && !data.patientEmail) {
            return {
              success: true,
              message: `Perfect! I have you down for ${format(dateTime, 'EEEE, MMMM d')} at ${format(dateTime, 'h:mm a')}. What's the best phone number to reach you?`,
              newState: { ...state, step: 'collecting_contact', pendingAppointment: state.pendingAppointment }
            };
          }
        }
      } else {
        // Not available, suggest alternatives
        const alternatives = await smartScheduling.findNextAvailableSlots(dateTime, duration, 2);
        
        if (alternatives.length > 0) {
          state.suggestedSlots = alternatives;
          
          const alt1 = alternatives[0];
          const alt2 = alternatives[1];
          
          let message = `I'm sorry, ${format(dateTime, 'h:mm a')} on ${format(dateTime, 'EEEE, MMMM d')} isn't available. `;
          
          if (alternatives.length === 2) {
            message += `I have openings on ${alt1.date} at ${alt1.time} or ${alt2.date} at ${alt2.time}. Would either of these work for you?`;
          } else if (alternatives.length === 1) {
            message += `The next available slot is ${alt1.date} at ${alt1.time}. Would that work for you?`;
          }
          
          return {
            success: true,
            message,
            alternatives,
            newState: { ...state, suggestedSlots: alternatives }
          };
        } else {
          return {
            success: false,
            message: "I'm sorry, we don't have any available appointments in the next two weeks. Would you like me to check a different time frame or add you to our waitlist?",
            needsHumanHelp: true
          };
        }
      }
    } catch (error) {
      logger.error('Error in checkAndBook:', error);
      return {
        success: false,
        message: "I'm having trouble checking our schedule. Let me transfer you to someone who can help.",
        needsHumanHelp: true
      };
    }
  }

  // Confirm a pending booking
  async confirmBooking(pendingData, state) {
    try {
      // Make sure we have all required information
      const data = { ...state.appointmentData, ...pendingData };
      
      if (!data.patientName || (!data.patientPhone && !data.patientEmail)) {
        return this.gatherMissingInfo(data, state);
      }
      
      const booking = await smartScheduling.bookAppointment({
        patientName: data.patientName,
        patientEmail: data.patientEmail,
        patientPhone: data.patientPhone,
        dateTime: pendingData.dateTime,
        type: pendingData.type,
        duration: pendingData.duration
      });
      
      if (booking.success) {
        return {
          success: true,
          message: `Excellent! Your appointment is confirmed for ${format(pendingData.dateTime, 'EEEE, MMMM d')} at ${format(pendingData.dateTime, 'h:mm a')}. We'll send you a confirmation with all the details. Is there anything else I can help you with?`,
          appointmentBooked: true,
          appointment: booking.appointment,
          newState: { step: 'completed', appointmentData: {} }
        };
      } else {
        return {
          success: false,
          message: "I'm sorry, there was an issue booking your appointment. Let me transfer you to someone who can help.",
          needsHumanHelp: true
        };
      }
    } catch (error) {
      logger.error('Error confirming booking:', error);
      return {
        success: false,
        message: "I'm having trouble confirming your appointment. Let me get someone to help you.",
        needsHumanHelp: true
      };
    }
  }

  // Handle emergency bookings
  async handleEmergencyBooking(data, state) {
    try {
      // Find next available slot today or tomorrow
      const now = new Date();
      const emergencySlots = await smartScheduling.findNextAvailableSlots(now, 45, 3);
      
      if (emergencySlots.length > 0) {
        const slot = emergencySlots[0];
        state.pendingAppointment = {
          dateTime: slot.dateTime,
          type: 'emergency',
          duration: 45
        };
        
        return {
          success: true,
          message: `I understand this is urgent. I can see you for an emergency appointment ${slot.date} at ${slot.time}. This is our next available slot. To confirm, I'll need your name and contact information.`,
          isEmergency: true,
          newState: { ...state, step: 'collecting_emergency_info', pendingAppointment: state.pendingAppointment }
        };
      } else {
        return {
          success: false,
          message: "I'm very sorry, but we don't have any immediate openings. For severe dental emergencies, I recommend visiting the emergency room. Otherwise, I can add you to our emergency waitlist and we'll call you as soon as something opens up.",
          needsHumanHelp: true,
          isEmergency: true
        };
      }
    } catch (error) {
      logger.error('Error handling emergency:', error);
      return {
        success: false,
        message: "Let me immediately connect you with someone who can help with your emergency.",
        needsHumanHelp: true,
        isEmergency: true
      };
    }
  }

  // Suggest alternative appointment times
  async suggestAlternatives(data, state) {
    try {
      const duration = this.getAppointmentDuration(data.type);
      const baseDateTime = smartScheduling.parseDateTime(data.preferredDate, data.preferredTime);
      
      // Get more alternatives
      const alternatives = await smartScheduling.findNextAvailableSlots(baseDateTime, duration, 3);
      
      if (alternatives.length > 0) {
        state.suggestedSlots = alternatives;
        
        let message = "Let me check for other options... I have availability on:\n";
        alternatives.forEach((slot, index) => {
          message += `${index + 1}. ${slot.date} at ${slot.time}\n`;
        });
        message += "Which one works best for you?";
        
        return {
          success: true,
          message,
          alternatives,
          newState: { ...state, suggestedSlots: alternatives }
        };
      } else {
        return {
          success: false,
          message: "I'm having trouble finding suitable alternatives. Would you like to try a different week, or shall I have someone call you to discuss more options?",
          needsHumanHelp: true
        };
      }
    } catch (error) {
      logger.error('Error suggesting alternatives:', error);
      return {
        success: false,
        message: "Let me have someone help you find a better time.",
        needsHumanHelp: true
      };
    }
  }

  // Gather missing information
  async gatherMissingInfo(data, state) {
    const missing = [];
    
    if (!data.preferredDate) {
      return {
        success: true,
        message: "I'd be happy to schedule an appointment for you. What day works best for you?",
        newState: { ...state, step: 'collecting_date' }
      };
    }
    
    if (!data.preferredTime) {
      return {
        success: true,
        message: `Great! What time on ${data.preferredDate} would you prefer? We're open from 9 AM to 5 PM on weekdays.`,
        newState: { ...state, step: 'collecting_time' }
      };
    }
    
    if (!data.type) {
      return {
        success: true,
        message: "What type of appointment do you need? We offer cleanings, checkups, fillings, and other dental services.",
        newState: { ...state, step: 'collecting_type' }
      };
    }
    
    if (!data.patientName) {
      return {
        success: true,
        message: "To book your appointment, may I have your full name please?",
        newState: { ...state, step: 'collecting_name' }
      };
    }
    
    if (!data.patientPhone && !data.patientEmail) {
      return {
        success: true,
        message: "And what's the best phone number to reach you for appointment reminders?",
        newState: { ...state, step: 'collecting_contact' }
      };
    }
    
    // If we have all info, try to book
    return await this.checkAndBook(data, state);
  }

  // Cancel an appointment
  async cancelAppointment(data, state) {
    // Implementation would include finding the appointment and cancelling it
    return {
      success: true,
      message: "I can help you cancel your appointment. Do you have your confirmation number, or can you provide your name and appointment date?",
      newState: { ...state, step: 'cancelling' }
    };
  }

  // Reschedule an appointment
  async rescheduleAppointment(data, state) {
    return {
      success: true,
      message: "I'll help you reschedule. What's your current appointment date, and when would you like to reschedule to?",
      newState: { ...state, step: 'rescheduling' }
    };
  }

  // Get appointment duration based on type
  getAppointmentDuration(type) {
    const durations = {
      'cleaning': 60,
      'checkup': 30,
      'filling': 45,
      'root canal': 90,
      'crown': 60,
      'extraction': 45,
      'consultation': 30,
      'emergency': 45,
      'whitening': 60
    };
    
    return durations[type?.toLowerCase()] || 30;
  }

  // Clean up old conversation states
  cleanupOldConversations() {
    const cutoffTime = Date.now() - this.stateTimeout;
    let cleaned = 0;
    
    for (const [id, state] of this.conversationStates.entries()) {
      if (state.lastUpdated && state.lastUpdated < cutoffTime) {
        this.conversationStates.delete(id);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      logger.info(`Cleaned up ${cleaned} expired conversation states`);
    }
  }

  // Reset conversation state
  resetConversation(conversationId) {
    this.conversationStates.delete(conversationId);
  }
}

export default new AIAppointmentHandler();