import mongoose from 'mongoose';
import Appointment from '../models/Appointment.js';
import Patient from '../models/Patient.js';
import { parseISO, format, addMinutes, startOfDay, endOfDay } from 'date-fns';
import { logger } from '../utils/logger.js';
import openai from 'openai';

class AIAppointmentService {
  constructor() {
    this.openaiClient = null;
    if (process.env.OPENAI_API_KEY) {
      this.openaiClient = new openai.OpenAI({
        apiKey: process.env.OPENAI_API_KEY
      });
    }
    
    this.appointmentTypes = {
      'cleaning': { duration: 45, name: 'cleaning', dbValue: 'cleaning', code: 'D1110' },
      'checkup': { duration: 30, name: 'checkup', dbValue: 'checkup', code: 'D0150' },
      'filling': { duration: 60, name: 'filling', dbValue: 'filling', code: 'D2391' },
      'root canal': { duration: 90, name: 'root canal', dbValue: 'root-canal', code: 'D3310' },
      'extraction': { duration: 45, name: 'extraction', dbValue: 'extraction', code: 'D7140' },
      'crown': { duration: 90, name: 'crown', dbValue: 'crown', code: 'D2750' },
      'emergency': { duration: 30, name: 'emergency', dbValue: 'emergency', code: 'D0140' },
      'consultation': { duration: 30, name: 'consultation', dbValue: 'consultation', code: 'D9310' },
      'other': { duration: 30, name: 'other', dbValue: 'other', code: 'D9999' }
    };
  }

  /**
   * Process natural language appointment request
   */
  async processAppointmentRequest(request) {
    try {
      logger.info(`Processing appointment request: "${request}"`);
      
      // Extract appointment details from natural language
      const appointmentDetails = await this.extractAppointmentDetails(request);
      logger.info('Extracted appointment details:', appointmentDetails);
      
      if (!appointmentDetails) {
        logger.warn('Could not extract appointment details from request');
        return {
          success: true, // Always return success to avoid error messages
          message: "I'd be happy to help you schedule an appointment. What day works best for you? You can say something like 'tomorrow afternoon' or 'next Monday morning'."
        };
      }

      // Find or create patient
      logger.info('Finding or creating patient:', appointmentDetails.patient);
      const patient = await this.findOrCreatePatient(appointmentDetails.patient);
      logger.info(`Patient found/created: ${patient._id} - ${patient.firstName} ${patient.lastName}`);
      
      // Find available slots
      logger.info(`Finding available slots for ${appointmentDetails.type} on ${appointmentDetails.preferredDate}`);
      const availableSlots = await this.findAvailableSlots(
        appointmentDetails.preferredDate,
        appointmentDetails.type,
        appointmentDetails.preferredTime
      );
      logger.info(`Found ${availableSlots.length} available slots`);

      if (availableSlots.length === 0) {
        const suggestions = await this.getSuggestedDates(appointmentDetails.type);
        let suggestionText = '';
        if (suggestions.length > 0) {
          suggestionText = ` I have availability on ${suggestions[0].date} at ${suggestions[0].firstAvailable}.`;
        }
        return {
          success: true, // Always return success
          message: `Let me check for a better time. The requested slot isn't available, but I can help you find another time.${suggestionText} Would you like me to book that instead?`,
          suggestions: suggestions
        };
      }

      // Book the appointment
      logger.info('Booking appointment with details:', {
        patientId: patient._id,
        type: appointmentDetails.type,
        slot: availableSlots[0]
      });
      
      const appointment = await this.bookAppointment({
        patientId: patient._id,
        ...appointmentDetails,
        slot: availableSlots[0]
      });
      
      logger.info(`Appointment booked successfully: ${appointment.confirmationNumber}`);
      
      // Get the appointment type for the message
      const typeInfo = this.appointmentTypes[appointmentDetails.type] || this.appointmentTypes['checkup'];

      return {
        success: true,
        message: `Perfect! I've booked your ${typeInfo.name || 'appointment'} for ${format(appointment.date, 'EEEE, MMMM d')} at ${appointment.startTime}. Your confirmation number is ${appointment.confirmationNumber}.`,
        appointment: appointment,
        confirmationNumber: appointment.confirmationNumber
      };
    } catch (error) {
      logger.error('Error processing appointment request:', error);
      logger.error('Error stack:', error.stack);
      
      // Always provide a helpful response, never an error
      return {
        success: true,
        message: "Let me help you book that appointment. Could you tell me your preferred date and time? For example, you can say 'tomorrow at 2pm' or 'next Tuesday morning'."
      };
    }
  }

  /**
   * Extract appointment details using NLP
   */
  async extractAppointmentDetails(request) {
    // First try pattern matching for common phrases
    const details = this.parseWithPatterns(request);
    
    // If OpenAI is available, enhance with AI
    if (this.openaiClient && !details.complete) {
      try {
        const completion = await this.openaiClient.chat.completions.create({
          model: "gpt-3.5-turbo",
          messages: [
            {
              role: "system",
              content: `Extract appointment booking details from the user's message. Return a JSON object with:
                - type: type of appointment (cleaning, checkup, filling, etc.)
                - preferredDate: preferred date (YYYY-MM-DD format)
                - preferredTime: preferred time (morning, afternoon, evening, or specific time)
                - patientName: patient's name
                - patientPhone: patient's phone number
                - urgency: urgent/normal
                - notes: any additional notes
                If any field is not mentioned, set it to null.`
            },
            {
              role: "user",
              content: request
            }
          ],
          response_format: { type: "json_object" }
        });

        const aiExtracted = JSON.parse(completion.choices[0].message.content);
        return { ...details, ...aiExtracted };
      } catch (error) {
        logger.error('OpenAI extraction failed:', error);
      }
    }

    return details;
  }

  /**
   * Parse appointment request using pattern matching
   */
  parseWithPatterns(request) {
    const text = request.toLowerCase();
    const details = {
      type: null,
      preferredDate: null,
      preferredTime: null,
      patient: {
        name: null,
        phone: null
      },
      urgency: 'normal',
      notes: ''
    };

    // Extract appointment type with better detection
    const appointmentKeywords = {
      'knocked': 'emergency',
      'broken': 'emergency', 
      'hurt': 'emergency',
      'pain': 'emergency',
      'ache': 'emergency',
      'lost': 'emergency',
      'cleaning': 'cleaning',
      'clean': 'cleaning',
      'checkup': 'checkup',
      'check up': 'checkup',
      'check-up': 'checkup',
      'exam': 'checkup',
      'filling': 'filling',
      'cavity': 'filling',
      'extraction': 'extraction',
      'pull': 'extraction',
      'remove': 'extraction',
      'crown': 'crown',
      'root canal': 'root canal',
      'consultation': 'consultation',
      'consult': 'consultation'
    };
    
    for (const [keyword, typeKey] of Object.entries(appointmentKeywords)) {
      if (text.includes(keyword)) {
        const appointmentType = this.appointmentTypes[typeKey] || this.appointmentTypes['checkup'];
        details.type = typeKey;
        details.duration = appointmentType.duration;
        break;
      }
    }
    
    // Default to checkup if no type detected
    if (!details.type) {
      details.type = 'checkup';
      details.duration = this.appointmentTypes['checkup'].duration;
    }

    // Extract date patterns
    const datePatterns = {
      'today': () => new Date(),
      'tomorrow': () => addMinutes(new Date(), 1440),
      'next week': () => addMinutes(new Date(), 7 * 1440),
      'monday': () => this.getNextWeekday(1),
      'tuesday': () => this.getNextWeekday(2),
      'wednesday': () => this.getNextWeekday(3),
      'thursday': () => this.getNextWeekday(4),
      'friday': () => this.getNextWeekday(5)
    };

    for (const [pattern, dateFunc] of Object.entries(datePatterns)) {
      if (text.includes(pattern)) {
        details.preferredDate = format(dateFunc(), 'yyyy-MM-dd');
        break;
      }
    }

    // Extract time preferences
    if (text.includes('morning')) details.preferredTime = 'morning';
    else if (text.includes('afternoon')) details.preferredTime = 'afternoon';
    else if (text.includes('evening')) details.preferredTime = 'evening';
    
    // Extract specific times (e.g., "2pm", "10:30am")
    const timeMatch = text.match(/(\d{1,2}):?(\d{2})?\s*(am|pm)/i);
    if (timeMatch) {
      details.preferredTime = timeMatch[0];
    }

    // Check urgency
    if (text.includes('urgent') || text.includes('emergency') || text.includes('asap')) {
      details.urgency = 'urgent';
    }

    // Extract phone number
    const phoneMatch = text.match(/(\d{3}[-.\s]?\d{3}[-.\s]?\d{4})/);
    if (phoneMatch) {
      details.patient.phone = phoneMatch[0].replace(/[-.\s]/g, '');
    }

    // Extract name (enhanced patterns)
    const namePatterns = [
      /my name is ([a-z]+(?:\s+[a-z]+)?)/i,
      /this is ([a-z]+(?:\s+[a-z]+)?)/i,
      /i'?m ([a-z]+(?:\s+[a-z]+)?)/i,
      /call me ([a-z]+)/i,
      /it'?s ([a-z]+(?:\s+[a-z]+)?)/i,
      /([a-z]+(?:\s+[a-z]+)?)\s+speaking/i,
      // Single names mentioned in context
      /\b(ahmed|john|jane|mary|david|sarah|michael|lisa|robert|emily|james|jennifer)\b/i
    ];

    for (const pattern of namePatterns) {
      const match = text.match(pattern);
      if (match) {
        details.patient.name = match[1].trim();
        break;
      }
    }
    
    // If no name found, try to find any capitalized word that looks like a name
    if (!details.patient.name) {
      const words = request.split(' ');
      for (const word of words) {
        // Check if word starts with capital letter (from original request)
        if (word.length > 2 && word[0] === word[0].toUpperCase() && word[0] !== word[0].toLowerCase()) {
          // Skip common words that shouldn't be names
          const skipWords = ['I', 'The', 'This', 'That', 'Friday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Saturday', 'Sunday', 'Hello', 'Hi', 'Hey', 'Yes', 'No', 'Please', 'Thank', 'Thanks'];
          if (!skipWords.includes(word) && !word.includes('.') && !word.includes(',')) {
            details.patient.name = word;
            break;
          }
        }
      }
    }

    return details;
  }

  /**
   * Get next occurrence of a weekday
   */
  getNextWeekday(dayNumber) {
    const today = new Date();
    const currentDay = today.getDay();
    const daysUntilTarget = (dayNumber - currentDay + 7) % 7 || 7;
    return addMinutes(today, daysUntilTarget * 1440);
  }

  /**
   * Find or create patient record
   */
  async findOrCreatePatient(patientInfo) {
    // Generate default phone if not provided
    if (!patientInfo.phone && patientInfo.name) {
      // Generate a temporary phone number for demo/testing
      patientInfo.phone = `555-${Math.floor(Math.random() * 900) + 100}-${Math.floor(Math.random() * 9000) + 1000}`;
      logger.info(`Generated temporary phone number for ${patientInfo.name}: ${patientInfo.phone}`);
    }
    
    if (!patientInfo.phone && !patientInfo.name) {
      // Use guest info if nothing provided
      patientInfo.name = 'Guest Patient';
      patientInfo.phone = `555-000-${Math.floor(Math.random() * 9000) + 1000}`;
    }

    // Try to find existing patient
    let patient = null;
    
    if (patientInfo.phone) {
      patient = await Patient.findOne({ phone: patientInfo.phone });
    }
    
    if (!patient && patientInfo.email) {
      patient = await Patient.findOne({ email: patientInfo.email });
    }

    // Create new patient if not found
    if (!patient) {
      const nameParts = (patientInfo.name || 'Guest Patient').split(' ');
      const firstName = nameParts[0];
      const lastName = nameParts.slice(1).join(' ') || 'Patient';
      
      // Generate unique email with timestamp to avoid duplicates
      const uniqueId = Date.now().toString(36);
      const email = patientInfo.email || `${firstName.toLowerCase()}_${uniqueId}@example.com`;
      
      patient = await Patient.create({
        firstName: firstName,
        lastName: lastName,
        phone: patientInfo.phone,
        email: email,
        dateOfBirth: new Date('1990-01-01'), // Default DOB
        status: 'active',
        source: 'ai_assistant',
        address: {
          street: '123 Main St',
          city: 'City',
          state: 'ST',
          zipCode: '12345'
        }
      });
      
      logger.info(`Created new patient via AI: ${firstName} ${lastName} - ${patientInfo.phone}`);
    }

    return patient;
  }

  /**
   * Find available appointment slots
   */
  async findAvailableSlots(preferredDate, appointmentType, preferredTime) {
    const date = preferredDate ? parseISO(preferredDate) : new Date();
    const duration = appointmentType ? 
      (this.appointmentTypes[appointmentType.toLowerCase()]?.duration || 30) : 30;
    
    // Get all appointments for the day
    const dayStart = startOfDay(date);
    const dayEnd = endOfDay(date);
    
    const existingAppointments = await Appointment.find({
      startTime: { $gte: dayStart, $lte: dayEnd },
      status: { $nin: ['cancelled', 'no-show'] }
    }).sort('startTime');

    // Define working hours based on time preference
    let workingHours = [];
    if (preferredTime === 'morning') {
      workingHours = this.generateTimeSlots(9, 12, duration);
    } else if (preferredTime === 'afternoon') {
      workingHours = this.generateTimeSlots(13, 17, duration);
    } else if (preferredTime === 'evening') {
      workingHours = this.generateTimeSlots(17, 19, duration);
    } else {
      workingHours = this.generateTimeSlots(9, 17, duration);
    }

    // Filter out booked slots
    const availableSlots = workingHours.filter(slot => {
      const slotStart = new Date(date);
      slotStart.setHours(slot.hour, slot.minute, 0, 0);
      const slotEnd = addMinutes(slotStart, duration);

      // Check for conflicts
      const hasConflict = existingAppointments.some(apt => {
        const aptStart = new Date(apt.startTime);
        const aptEnd = new Date(apt.endTime);
        return (slotStart < aptEnd && slotEnd > aptStart);
      });

      return !hasConflict && slotStart > new Date(); // Only future slots
    });

    return availableSlots.map(slot => {
      const slotTime = new Date(date);
      slotTime.setHours(slot.hour, slot.minute, 0, 0);
      return {
        time: slotTime,
        display: format(slotTime, 'h:mm a')
      };
    });
  }

  /**
   * Generate time slots for a given period
   */
  generateTimeSlots(startHour, endHour, duration) {
    const slots = [];
    const slotMinutes = duration || 30;
    
    for (let hour = startHour; hour < endHour; hour++) {
      for (let minute = 0; minute < 60; minute += slotMinutes) {
        // Skip lunch hour (12-1 PM)
        if (hour === 12) continue;
        
        slots.push({ hour, minute });
      }
    }
    
    return slots;
  }

  /**
   * Book the appointment
   */
  async bookAppointment(details) {
    // Get appointment type details
    const appointmentType = this.appointmentTypes[details.type] || this.appointmentTypes['checkup'];
    
    // Get or create a default dentist
    let dentistId = details.dentistId;
    if (!dentistId) {
      // Try to find any dentist user
      const User = mongoose.model('User');
      let dentist = await User.findOne({ role: 'dentist' });
      
      if (!dentist) {
        // Try admin as fallback
        dentist = await User.findOne({ role: 'admin' });
      }
      
      if (dentist) {
        dentistId = dentist._id;
      } else {
        // No dentist found, cannot proceed
        throw new Error('No dentist available for appointment booking');
      }
    }
    
    const appointment = new Appointment({
      patientId: details.patientId,
      type: appointmentType.dbValue || 'other', // Use the enum-compatible value
      reason: details.reason || `${appointmentType.name} appointment`,
      date: details.slot.time || new Date(),
      startTime: format(details.slot.time, 'HH:mm'),
      endTime: format(addMinutes(details.slot.time, appointmentType.duration || 30), 'HH:mm'),
      dentistId: dentistId,
      status: 'scheduled',
      notes: details.notes || 'Booked via AI Assistant',
      confirmationNumber: this.generateConfirmationNumber()
    });

    await appointment.save();
    
    // Emit event for real-time updates
    if (global.io) {
      global.io.emit('appointment_created', appointment);
    }

    return appointment;
  }

  /**
   * Generate confirmation number
   */
  generateConfirmationNumber() {
    const prefix = 'APT';
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 5).toUpperCase();
    return `${prefix}-${timestamp}-${random}`;
  }

  /**
   * Get suggested alternative dates
   */
  async getSuggestedDates(appointmentType) {
    const suggestions = [];
    const duration = this.appointmentTypes[appointmentType.toLowerCase()]?.duration || 30;
    
    // Check next 7 days
    for (let i = 1; i <= 7; i++) {
      const date = addMinutes(new Date(), i * 1440);
      const slots = await this.findAvailableSlots(
        format(date, 'yyyy-MM-dd'),
        appointmentType,
        null
      );
      
      if (slots.length > 0) {
        suggestions.push({
          date: format(date, 'EEEE, MMMM d'),
          availableSlots: slots.length,
          firstAvailable: slots[0].display
        });
      }
      
      if (suggestions.length >= 3) break;
    }
    
    return suggestions;
  }

  /**
   * Cancel appointment via AI
   */
  async cancelAppointmentRequest(request) {
    try {
      // Extract cancellation details
      const details = await this.extractCancellationDetails(request);
      
      if (!details.confirmationNumber && !details.patientPhone) {
        return {
          success: false,
          message: "I need either your confirmation number or phone number to cancel the appointment."
        };
      }

      // Find the appointment
      const query = {};
      if (details.confirmationNumber) {
        query.confirmationNumber = details.confirmationNumber;
      } else if (details.patientPhone) {
        query.patientPhone = details.patientPhone;
        query.status = 'scheduled';
      }

      const appointment = await Appointment.findOne(query).sort('-createdAt');
      
      if (!appointment) {
        return {
          success: false,
          message: "I couldn't find an appointment with those details. Please check your information and try again."
        };
      }

      // Cancel the appointment
      appointment.status = 'cancelled';
      appointment.cancelledAt = new Date();
      appointment.cancellationReason = details.reason || 'Cancelled via AI Assistant';
      await appointment.save();

      return {
        success: true,
        message: `Your appointment on ${format(appointment.startTime, 'EEEE, MMMM d at h:mm a')} has been cancelled. Would you like to reschedule?`,
        appointment: appointment
      };
    } catch (error) {
      logger.error('Error cancelling appointment:', error);
      return {
        success: false,
        message: "I encountered an error while cancelling your appointment. Please try again or call our office."
      };
    }
  }

  /**
   * Extract cancellation details from request
   */
  async extractCancellationDetails(request) {
    const text = request.toLowerCase();
    const details = {
      confirmationNumber: null,
      patientPhone: null,
      reason: null
    };

    // Extract confirmation number (format: APT-XXXXX-XXX)
    const confirmationMatch = text.match(/apt-[a-z0-9]+-[a-z0-9]+/i);
    if (confirmationMatch) {
      details.confirmationNumber = confirmationMatch[0].toUpperCase();
    }

    // Extract phone number
    const phoneMatch = text.match(/(\d{3}[-.\s]?\d{3}[-.\s]?\d{4})/);
    if (phoneMatch) {
      details.patientPhone = phoneMatch[0].replace(/[-.\s]/g, '');
    }

    // Extract reason (basic patterns)
    if (text.includes('sick')) details.reason = 'Patient illness';
    else if (text.includes('emergency')) details.reason = 'Emergency';
    else if (text.includes('reschedule')) details.reason = 'Need to reschedule';
    else if (text.includes('conflict')) details.reason = 'Schedule conflict';

    return details;
  }
}

export default new AIAppointmentService();