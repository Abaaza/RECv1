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
      'cleaning': { duration: 45, name: 'Regular Cleaning', code: 'D1110' },
      'checkup': { duration: 30, name: 'Regular Checkup', code: 'D0150' },
      'filling': { duration: 60, name: 'Filling', code: 'D2391' },
      'root canal': { duration: 90, name: 'Root Canal', code: 'D3310' },
      'extraction': { duration: 45, name: 'Tooth Extraction', code: 'D7140' },
      'crown': { duration: 90, name: 'Crown Preparation', code: 'D2750' },
      'emergency': { duration: 30, name: 'Emergency Visit', code: 'D0140' },
      'consultation': { duration: 30, name: 'Consultation', code: 'D9310' },
      'whitening': { duration: 60, name: 'Teeth Whitening', code: 'D9972' },
      'xray': { duration: 20, name: 'X-Ray', code: 'D0274' }
    };
  }

  /**
   * Process natural language appointment request
   */
  async processAppointmentRequest(request) {
    try {
      // Extract appointment details from natural language
      const appointmentDetails = await this.extractAppointmentDetails(request);
      
      if (!appointmentDetails) {
        return {
          success: false,
          message: "I couldn't understand your appointment request. Could you please provide more details?"
        };
      }

      // Find or create patient
      const patient = await this.findOrCreatePatient(appointmentDetails.patient);
      
      // Find available slots
      const availableSlots = await this.findAvailableSlots(
        appointmentDetails.preferredDate,
        appointmentDetails.type,
        appointmentDetails.preferredTime
      );

      if (availableSlots.length === 0) {
        return {
          success: false,
          message: `I'm sorry, there are no available slots for ${appointmentDetails.type} on ${appointmentDetails.preferredDate}. Would you like me to check another day?`,
          suggestions: await this.getSuggestedDates(appointmentDetails.type)
        };
      }

      // Book the appointment
      const appointment = await this.bookAppointment({
        patientId: patient._id,
        ...appointmentDetails,
        slot: availableSlots[0]
      });

      return {
        success: true,
        message: `Perfect! I've booked your ${appointmentDetails.type} appointment for ${format(appointment.startTime, 'EEEE, MMMM d at h:mm a')}. You'll receive a confirmation shortly.`,
        appointment: appointment,
        confirmationNumber: appointment.confirmationNumber
      };
    } catch (error) {
      logger.error('Error processing appointment request:', error);
      return {
        success: false,
        message: "I encountered an error while booking your appointment. Please try again or call our office directly."
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

    // Extract appointment type
    for (const [key, value] of Object.entries(this.appointmentTypes)) {
      if (text.includes(key)) {
        details.type = value.name;
        details.duration = value.duration;
        break;
      }
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

    // Extract name (basic pattern - looks for "my name is" or "this is")
    const namePatterns = [
      /my name is ([a-z]+ [a-z]+)/i,
      /this is ([a-z]+ [a-z]+)/i,
      /i'?m ([a-z]+ [a-z]+)/i,
      /call me ([a-z]+)/i
    ];

    for (const pattern of namePatterns) {
      const match = text.match(pattern);
      if (match) {
        details.patient.name = match[1];
        break;
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
    if (!patientInfo.phone && !patientInfo.name) {
      throw new Error('Patient identification required');
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
      patient = await Patient.create({
        firstName: nameParts[0],
        lastName: nameParts.slice(1).join(' ') || 'Patient',
        phone: patientInfo.phone,
        email: patientInfo.email,
        status: 'active',
        source: 'ai_assistant'
      });
    }

    return patient;
  }

  /**
   * Find available appointment slots
   */
  async findAvailableSlots(preferredDate, appointmentType, preferredTime) {
    const date = preferredDate ? parseISO(preferredDate) : new Date();
    const duration = this.appointmentTypes[appointmentType.toLowerCase()]?.duration || 30;
    
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
    const appointment = new Appointment({
      patientId: details.patientId,
      patientName: details.patient?.name,
      patientPhone: details.patient?.phone,
      type: details.type,
      startTime: details.slot.time,
      endTime: addMinutes(details.slot.time, details.duration || 30),
      status: 'scheduled',
      source: 'ai_assistant',
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