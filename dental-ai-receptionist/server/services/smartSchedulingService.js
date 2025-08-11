import mongoose from 'mongoose';
import Appointment from '../models/Appointment.js';
import Patient from '../models/Patient.js';
import { logger } from '../utils/logger.js';
import { addDays, addHours, format, parse, isAfter, isBefore, isEqual, startOfDay, endOfDay, addMinutes, setHours, setMinutes } from 'date-fns';

// Business hours configuration
const BUSINESS_HOURS = {
  monday: { start: '09:00', end: '17:00', isOpen: true },
  tuesday: { start: '09:00', end: '17:00', isOpen: true },
  wednesday: { start: '09:00', end: '17:00', isOpen: true },
  thursday: { start: '09:00', end: '17:00', isOpen: true },
  friday: { start: '09:00', end: '17:00', isOpen: true },
  saturday: { start: '09:00', end: '13:00', isOpen: true },
  sunday: { start: '00:00', end: '00:00', isOpen: false }
};

// Appointment types and their durations (in minutes)
const APPOINTMENT_TYPES = {
  'cleaning': 60,
  'checkup': 30,
  'filling': 45,
  'root canal': 90,
  'crown': 60,
  'extraction': 45,
  'consultation': 30,
  'emergency': 45,
  'whitening': 60,
  'general': 30,
  'dental': 30
};

// Break times when appointments can't be scheduled
const BREAK_TIMES = [
  { start: '12:00', end: '13:00', name: 'Lunch Break' }
];

class SmartSchedulingService {
  constructor() {
    this.slotDuration = 15; // Time slots in 15-minute intervals
  }

  // Parse natural language date/time to actual Date object
  parseDateTime(dateStr, timeStr) {
    const today = new Date();
    let targetDate = today;
    
    // Parse date
    if (dateStr) {
      const lowerDate = dateStr.toLowerCase().trim();
      
      // Handle relative dates
      if (lowerDate.includes('today') || lowerDate === 'now') {
        targetDate = today;
      } else if (lowerDate.includes('tomorrow')) {
        targetDate = addDays(today, 1);
      } else if (lowerDate.includes('day after tomorrow')) {
        targetDate = addDays(today, 2);
      } else if (lowerDate.includes('next week')) {
        targetDate = addDays(today, 7);
      } else if (lowerDate.includes('this week')) {
        // Find next available weekday
        targetDate = addDays(today, today.getDay() === 5 ? 3 : 1);
      } else if (lowerDate.includes('next month')) {
        targetDate = addDays(today, 30);
      } else if (lowerDate.match(/in (\d+) days?/)) {
        const daysMatch = lowerDate.match(/in (\d+) days?/);
        targetDate = addDays(today, parseInt(daysMatch[1]));
      } else if (lowerDate.includes('monday')) {
        targetDate = this.getNextWeekday(1, lowerDate.includes('next'));
      } else if (lowerDate.includes('tuesday')) {
        targetDate = this.getNextWeekday(2, lowerDate.includes('next'));
      } else if (lowerDate.includes('wednesday')) {
        targetDate = this.getNextWeekday(3, lowerDate.includes('next'));
      } else if (lowerDate.includes('thursday')) {
        targetDate = this.getNextWeekday(4, lowerDate.includes('next'));
      } else if (lowerDate.includes('friday')) {
        targetDate = this.getNextWeekday(5, lowerDate.includes('next'));
      } else if (lowerDate.includes('saturday')) {
        targetDate = this.getNextWeekday(6, lowerDate.includes('next'));
      } else if (lowerDate.includes('sunday')) {
        targetDate = this.getNextWeekday(0, lowerDate.includes('next'));
      } else {
        // Try to parse specific dates like "December 15" or "15th" or "12/25"
        const monthMatch = lowerDate.match(/(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/);
        const dayMatch = lowerDate.match(/(\d{1,2})(st|nd|rd|th)?/);
        const numericDateMatch = lowerDate.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/);
        
        if (numericDateMatch) {
          const month = parseInt(numericDateMatch[1]) - 1;
          const day = parseInt(numericDateMatch[2]);
          const year = numericDateMatch[3] ? 
            (numericDateMatch[3].length === 2 ? 2000 + parseInt(numericDateMatch[3]) : parseInt(numericDateMatch[3])) : 
            today.getFullYear();
          targetDate = new Date(year, month, day);
          
          // If date is in the past, assume next year
          if (isBefore(targetDate, today)) {
            targetDate = new Date(year + 1, month, day);
          }
        } else if (monthMatch && dayMatch) {
          const monthStr = monthMatch[1];
          const month = this.getMonthNumber(monthStr.length <= 3 ? this.expandMonth(monthStr) : monthStr);
          const day = parseInt(dayMatch[1]);
          targetDate = new Date(today.getFullYear(), month, day);
          
          // If date is in the past, assume next year
          if (isBefore(targetDate, today)) {
            targetDate = new Date(today.getFullYear() + 1, month, day);
          }
        } else if (dayMatch && !monthMatch) {
          // Just a day number, assume current month
          const day = parseInt(dayMatch[1]);
          targetDate = new Date(today.getFullYear(), today.getMonth(), day);
          
          // If date is in the past, go to next month
          if (isBefore(targetDate, today)) {
            targetDate = addDays(targetDate, 30);
          }
        }
      }
    }
    
    // Parse time
    if (timeStr) {
      const lowerTime = timeStr.toLowerCase().trim();
      let hour = 9; // Default to 9 AM
      let minute = 0;
      
      // Handle special time expressions
      if (lowerTime === 'noon' || lowerTime === 'midday') {
        hour = 12;
      } else if (lowerTime.includes('midnight')) {
        hour = 0;
      } else if (lowerTime.includes('early morning')) {
        hour = 7;
      } else if (lowerTime.includes('late morning')) {
        hour = 11;
      } else if (lowerTime.includes('early afternoon')) {
        hour = 13;
      } else if (lowerTime.includes('late afternoon')) {
        hour = 16;
      } else if (lowerTime.includes('morning')) {
        hour = 9;
      } else if (lowerTime.includes('afternoon')) {
        hour = 14;
      } else if (lowerTime.includes('evening')) {
        hour = 16;
      } else {
        // Parse time formats like "2 PM", "14:30", "2:30 PM", "half past 2"
        const timeMatch = lowerTime.match(/(\d{1,2}):?(\d{2})?\s*(am|pm|a\.m\.|p\.m\.)?/);
        const halfPastMatch = lowerTime.match(/half past (\d{1,2})/);
        const quarterMatch = lowerTime.match(/(quarter past|quarter to) (\d{1,2})/);
        
        if (halfPastMatch) {
          hour = parseInt(halfPastMatch[1]);
          minute = 30;
          // Assume PM for afternoon hours without explicit AM/PM
          if (hour < 7) hour += 12;
        } else if (quarterMatch) {
          hour = parseInt(quarterMatch[2]);
          minute = quarterMatch[1] === 'quarter past' ? 15 : 45;
          if (quarterMatch[1] === 'quarter to') hour -= 1;
          // Assume PM for afternoon hours
          if (hour < 7) hour += 12;
        } else if (timeMatch) {
          hour = parseInt(timeMatch[1]);
          minute = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
          
          // Handle AM/PM
          const meridiem = timeMatch[3];
          if (meridiem && (meridiem.includes('p') || meridiem.includes('P'))) {
            if (hour < 12) hour += 12;
          } else if (meridiem && (meridiem.includes('a') || meridiem.includes('A'))) {
            if (hour === 12) hour = 0;
          } else {
            // No AM/PM specified, make intelligent guess
            if (hour < 7) {
              // Assume PM for very low numbers
              hour += 12;
            }
          }
        }
      }
      
      // Round to nearest 15-minute slot
      minute = Math.round(minute / 15) * 15;
      if (minute === 60) {
        hour += 1;
        minute = 0;
      }
      
      targetDate = setHours(setMinutes(targetDate, minute), hour);
    } else {
      // No time specified, default to next available slot
      const now = new Date();
      if (targetDate.toDateString() === now.toDateString()) {
        // Today - find next available hour
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();
        
        if (currentHour < 9) {
          targetDate = setHours(setMinutes(targetDate, 0), 9);
        } else if (currentHour >= 17) {
          // After hours, go to tomorrow 9 AM
          targetDate = setHours(setMinutes(addDays(targetDate, 1), 0), 9);
        } else {
          // Round up to next hour
          targetDate = setHours(setMinutes(targetDate, 0), currentHour + 1);
        }
      } else {
        // Future date, default to 9 AM
        targetDate = setHours(setMinutes(targetDate, 0), 9);
      }
    }
    
    return targetDate;
  }

  // Expand abbreviated month names
  expandMonth(abbr) {
    const months = {
      'jan': 'january', 'feb': 'february', 'mar': 'march', 'apr': 'april',
      'may': 'may', 'jun': 'june', 'jul': 'july', 'aug': 'august',
      'sep': 'september', 'oct': 'october', 'nov': 'november', 'dec': 'december'
    };
    return months[abbr.toLowerCase()] || abbr;
  }

  // Get next occurrence of a weekday
  getNextWeekday(dayNumber, forceNextWeek = false) {
    const today = new Date();
    const currentDay = today.getDay();
    let daysToAdd = dayNumber - currentDay;
    
    if (daysToAdd <= 0 || forceNextWeek) {
      daysToAdd += 7; // Next week
    }
    
    return addDays(today, daysToAdd);
  }

  // Convert month name to number
  getMonthNumber(monthName) {
    const months = {
      january: 0, february: 1, march: 2, april: 3,
      may: 4, june: 5, july: 6, august: 7,
      september: 8, october: 9, november: 10, december: 11
    };
    return months[monthName.toLowerCase()];
  }

  // Check if a specific time slot is available
  async checkAvailability(dateTime, duration = 30) {
    try {
      const startTime = new Date(dateTime);
      const endTime = addMinutes(startTime, duration);
      
      // Add buffer time (5 minutes before and after appointments)
      const bufferMinutes = 5;
      const bufferedStartTime = addMinutes(startTime, -bufferMinutes);
      const bufferedEndTime = addMinutes(endTime, bufferMinutes);
      
      // Check if within business hours
      if (!this.isWithinBusinessHours(startTime, endTime)) {
        return { 
          available: false, 
          reason: 'outside_business_hours',
          details: {
            requested: format(startTime, 'h:mm a'),
            businessHours: this.getBusinessHoursForDay(startTime)
          }
        };
      }
      
      // Check if too close to current time (minimum 30 minutes advance booking)
      const now = new Date();
      const minimumAdvanceTime = addMinutes(now, 30);
      if (isBefore(startTime, minimumAdvanceTime)) {
        return { 
          available: false, 
          reason: 'too_soon',
          details: {
            earliestAvailable: format(minimumAdvanceTime, 'h:mm a')
          }
        };
      }
      
      // Check for conflicts with existing appointments (including buffer)
      const conflicts = await Appointment.find({
        date: {
          $gte: startOfDay(startTime),
          $lte: endOfDay(startTime)
        },
        status: { $nin: ['cancelled', 'no-show'] },
        $or: [
          // Check with buffer time
          {
            $and: [
              { date: { $lte: bufferedEndTime } },
              { date: { $gte: bufferedStartTime } }
            ]
          }
        ]
      }).populate('patientId', 'name');
      
      // More precise conflict checking with actual times
      const hasConflict = conflicts.some(apt => {
        const aptStart = parse(apt.startTime, 'HH:mm', apt.date);
        const aptEnd = parse(apt.endTime, 'HH:mm', apt.date);
        const aptBufferedStart = addMinutes(aptStart, -bufferMinutes);
        const aptBufferedEnd = addMinutes(aptEnd, bufferMinutes);
        
        return (
          (isAfter(startTime, aptBufferedStart) && isBefore(startTime, aptBufferedEnd)) ||
          (isAfter(endTime, aptBufferedStart) && isBefore(endTime, aptBufferedEnd)) ||
          (isBefore(startTime, aptBufferedStart) && isAfter(endTime, aptBufferedEnd)) ||
          isEqual(startTime, aptStart)
        );
      });
      
      if (hasConflict) {
        return { 
          available: false, 
          reason: 'conflict',
          conflicts: conflicts.map(c => ({
            time: `${c.startTime}-${c.endTime}`,
            type: c.type,
            patientInitials: c.patientId?.name ? 
              c.patientId.name.split(' ').map(n => n[0]).join('') : 'N/A'
          }))
        };
      }
      
      // Check if dentist has too many appointments in a row (max 4 consecutive without break)
      const dayAppointments = await Appointment.find({
        date: {
          $gte: startOfDay(startTime),
          $lte: endOfDay(startTime)
        },
        status: { $nin: ['cancelled', 'no-show'] }
      }).sort('startTime');
      
      let consecutiveCount = 0;
      for (const apt of dayAppointments) {
        const aptStart = parse(apt.startTime, 'HH:mm', apt.date);
        const aptEnd = parse(apt.endTime, 'HH:mm', apt.date);
        
        if (isAfter(aptEnd, addMinutes(startTime, -90)) && 
            isBefore(aptStart, addMinutes(endTime, 90))) {
          consecutiveCount++;
        }
      }
      
      if (consecutiveCount >= 4) {
        return { 
          available: false, 
          reason: 'dentist_break_needed',
          details: 'Dentist needs a break after consecutive appointments'
        };
      }
      
      return { available: true };
    } catch (error) {
      logger.error('Error checking availability:', error);
      throw error;
    }
  }

  // Get business hours for a specific day
  getBusinessHoursForDay(date) {
    const dayName = format(date, 'EEEE').toLowerCase();
    const hours = BUSINESS_HOURS[dayName];
    if (!hours.isOpen) {
      return 'Closed';
    }
    return `${hours.start} - ${hours.end}`;
  }

  // Check if time is within business hours
  isWithinBusinessHours(startTime, endTime) {
    const dayName = format(startTime, 'EEEE').toLowerCase();
    const businessDay = BUSINESS_HOURS[dayName];
    
    if (!businessDay.isOpen) {
      return false;
    }
    
    const businessStart = parse(businessDay.start, 'HH:mm', startTime);
    const businessEnd = parse(businessDay.end, 'HH:mm', startTime);
    
    // Check for break times
    for (const breakTime of BREAK_TIMES) {
      const breakStart = parse(breakTime.start, 'HH:mm', startTime);
      const breakEnd = parse(breakTime.end, 'HH:mm', startTime);
      
      if (
        (isAfter(startTime, breakStart) && isBefore(startTime, breakEnd)) ||
        (isAfter(endTime, breakStart) && isBefore(endTime, breakEnd))
      ) {
        return false;
      }
    }
    
    return !isBefore(startTime, businessStart) && !isAfter(endTime, businessEnd);
  }

  // Find available slots for a given day
  async findAvailableSlots(date, duration = 30) {
    const slots = [];
    const dayStart = startOfDay(date);
    const dayName = format(dayStart, 'EEEE').toLowerCase();
    const businessDay = BUSINESS_HOURS[dayName];
    
    if (!businessDay.isOpen) {
      return slots;
    }
    
    // Get all appointments for the day
    const existingAppointments = await Appointment.find({
      startTime: {
        $gte: dayStart,
        $lt: endOfDay(date)
      },
      status: { $ne: 'cancelled' }
    }).sort('startTime');
    
    // Generate time slots
    let currentTime = parse(businessDay.start, 'HH:mm', dayStart);
    const endTime = parse(businessDay.end, 'HH:mm', dayStart);
    
    while (isBefore(currentTime, endTime)) {
      const slotEnd = addMinutes(currentTime, duration);
      
      // Check if slot is available
      const availability = await this.checkAvailability(currentTime, duration);
      
      if (availability.available) {
        slots.push({
          startTime: currentTime,
          endTime: slotEnd,
          available: true
        });
      }
      
      currentTime = addMinutes(currentTime, this.slotDuration);
    }
    
    return slots;
  }

  // Find next available slots with intelligent suggestions
  async findNextAvailableSlots(preferredDateTime, duration = 30, count = 2) {
    const suggestions = [];
    const preferredHour = preferredDateTime.getHours();
    const preferredMinute = preferredDateTime.getMinutes();
    const isPreferredMorning = preferredHour < 12;
    const isPreferredAfternoon = preferredHour >= 12 && preferredHour < 17;
    
    // Strategy: First try same time on different days, then nearby times
    const searchStrategies = [
      { sameDayNearby: true, maxHourDiff: 1 },   // Same day, within 1 hour
      { sameTime: true, maxDays: 3 },             // Same time, next 3 days
      { samePartOfDay: true, maxDays: 3 },        // Same part of day (morning/afternoon)
      { anyTime: true, maxDays: 7 }               // Any available time within a week
    ];
    
    for (const strategy of searchStrategies) {
      if (suggestions.length >= count) break;
      
      let searchDate = new Date(preferredDateTime);
      let daysSearched = 0;
      const maxDays = strategy.maxDays || 14;
      
      while (suggestions.length < count && daysSearched < maxDays) {
        const daySlots = await this.findAvailableSlots(searchDate, duration);
        
        // Filter slots based on strategy
        let relevantSlots = daySlots;
        
        if (strategy.sameDayNearby && daysSearched === 0) {
          // Same day, nearby times only
          relevantSlots = daySlots.filter(slot => {
            const slotHour = slot.startTime.getHours();
            const hourDiff = Math.abs(slotHour - preferredHour);
            return isAfter(slot.startTime, preferredDateTime) && 
                   hourDiff <= (strategy.maxHourDiff || 1);
          });
        } else if (strategy.sameTime) {
          // Same time on different days
          relevantSlots = daySlots.filter(slot => {
            const slotHour = slot.startTime.getHours();
            const slotMinute = slot.startTime.getMinutes();
            return slotHour === preferredHour && 
                   Math.abs(slotMinute - preferredMinute) <= 30;
          });
        } else if (strategy.samePartOfDay) {
          // Same part of day (morning/afternoon/evening)
          relevantSlots = daySlots.filter(slot => {
            const slotHour = slot.startTime.getHours();
            if (isPreferredMorning) {
              return slotHour >= 9 && slotHour < 12;
            } else if (isPreferredAfternoon) {
              return slotHour >= 12 && slotHour < 17;
            } else {
              return slotHour >= 15 && slotHour < 17;
            }
          });
        }
        
        // Skip today's past slots
        if (daysSearched === 0) {
          relevantSlots = relevantSlots.filter(slot => 
            isAfter(slot.startTime, addMinutes(new Date(), 30))
          );
        }
        
        // Add slots to suggestions, prioritizing by proximity to preferred time
        const scoredSlots = relevantSlots.map(slot => {
          const timeDiff = Math.abs(
            slot.startTime.getHours() * 60 + slot.startTime.getMinutes() -
            (preferredHour * 60 + preferredMinute)
          );
          const dayDiff = Math.floor((slot.startTime - preferredDateTime) / (1000 * 60 * 60 * 24));
          return {
            ...slot,
            score: dayDiff * 100 + timeDiff // Lower score is better
          };
        }).sort((a, b) => a.score - b.score);
        
        for (const slot of scoredSlots) {
          if (suggestions.length < count) {
            // Check if this slot is not too similar to already suggested ones
            const isDuplicate = suggestions.some(s => 
              Math.abs(s.dateTime - slot.startTime) < 30 * 60 * 1000 // Within 30 minutes
            );
            
            if (!isDuplicate) {
              suggestions.push({
                date: format(slot.startTime, 'EEEE, MMMM d'),
                time: format(slot.startTime, 'h:mm a'),
                dateTime: slot.startTime,
                available: true,
                reason: strategy.sameDayNearby ? 'nearby_time' :
                        strategy.sameTime ? 'same_time_different_day' :
                        strategy.samePartOfDay ? 'same_part_of_day' : 'available'
              });
            }
          }
        }
        
        searchDate = addDays(searchDate, 1);
        daysSearched++;
      }
    }
    
    // If still not enough suggestions, add any available slots
    if (suggestions.length < count) {
      let searchDate = new Date(preferredDateTime);
      let daysSearched = 0;
      
      while (suggestions.length < count && daysSearched < 14) {
        const daySlots = await this.findAvailableSlots(searchDate, duration);
        
        for (const slot of daySlots) {
          if (suggestions.length < count && 
              isAfter(slot.startTime, addMinutes(new Date(), 30))) {
            suggestions.push({
              date: format(slot.startTime, 'EEEE, MMMM d'),
              time: format(slot.startTime, 'h:mm a'),
              dateTime: slot.startTime,
              available: true,
              reason: 'next_available'
            });
          }
        }
        
        searchDate = addDays(searchDate, 1);
        daysSearched++;
      }
    }
    
    return suggestions;
  }

  // Book an appointment
  async bookAppointment(appointmentData) {
    try {
      const {
        patientName,
        patientEmail,
        patientPhone,
        dateTime,
        type = 'general',
        notes,
        duration
      } = appointmentData;
      
      // Validate required fields
      if (!patientName || (!patientEmail && !patientPhone)) {
        return {
          success: false,
          message: 'Patient name and contact information are required',
          missingFields: {
            name: !patientName,
            contact: !patientEmail && !patientPhone
          }
        };
      }
      
      // Validate date is not in the past
      if (isBefore(new Date(dateTime), new Date())) {
        return {
          success: false,
          message: 'Cannot book appointments in the past',
          suggestedTime: addDays(new Date(dateTime), 1)
        };
      }
      
      // Sanitize and validate appointment type
      const validType = Object.keys(APPOINTMENT_TYPES).includes(type.toLowerCase()) ? 
                       type.toLowerCase() : 'general';
      
      // Calculate duration based on appointment type
      const appointmentDuration = duration || APPOINTMENT_TYPES[validType] || 30;
      
      // Check availability one more time
      const availability = await this.checkAvailability(dateTime, appointmentDuration);
      if (!availability.available) {
        return {
          success: false,
          reason: availability.reason,
          message: 'This time slot is no longer available'
        };
      }
      
      // Find or create patient with error handling
      let patient;
      try {
        // Try to find existing patient
        if (patientEmail || patientPhone) {
          const query = {};
          if (patientEmail) query.email = patientEmail;
          if (patientPhone) query.phone = patientPhone;
          
          patient = await Patient.findOne({ 
            $or: Object.keys(query).map(key => ({ [key]: query[key] }))
          });
        }
        
        if (!patient) {
          // Validate email format if provided
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          const validEmail = patientEmail && emailRegex.test(patientEmail) ? 
                           patientEmail : 
                           `${patientName.replace(/\s+/g, '').toLowerCase()}@placeholder.com`;
          
          // Validate phone format
          const phoneRegex = /^\d{3}[-.]?\d{3}[-.]?\d{4}$/;
          const validPhone = patientPhone && phoneRegex.test(patientPhone.replace(/\s/g, '')) ? 
                           patientPhone : 
                           '000-000-0000';
          
          patient = await Patient.create({
            name: patientName.trim(),
            email: validEmail,
            phone: validPhone,
            dateOfBirth: new Date('1990-01-01'), // Placeholder
            address: 'To be updated'
          });
        }
      } catch (dbError) {
        logger.error('Database error creating/finding patient:', dbError);
        
        // Try to continue with minimal patient info
        patient = {
          _id: new mongoose.Types.ObjectId(),
          name: patientName,
          email: patientEmail,
          phone: patientPhone
        };
      }
      
      // Get a default dentist (for now, we'll need to assign one)
      // In a real system, this would be based on availability and specialization
      const User = mongoose.model('User');
      let dentist = await User.findOne({ role: 'dentist' }).limit(1);
      
      if (!dentist) {
        // Create a default dentist if none exists
        dentist = await User.create({
          name: 'Dr. Smith',
          email: 'dr.smith@dentalcare.com',
          password: 'temp123456', // This should be hashed in production
          role: 'dentist',
          isActive: true,
          profile: {
            firstName: 'John',
            lastName: 'Smith',
            phone: '555-000-0001',
            dateOfBirth: new Date('1980-01-01'),
            address: {
              street: '123 Medical Plaza',
              city: 'San Francisco',
              state: 'CA',
              zipCode: '94102'
            }
          }
        });
      }
      
      // Create the appointment with the correct schema
      // Map common type variations to valid enum values
      const typeMapping = {
        'cleaning': 'cleaning',
        'checkup': 'checkup',
        'check-up': 'checkup',
        'filling': 'filling',
        'extraction': 'extraction',
        'root canal': 'root-canal',
        'root-canal': 'root-canal',
        'crown': 'crown',
        'emergency': 'emergency',
        'consultation': 'consultation',
        'whitening': 'other',
        'general': 'checkup',
        'dental': 'checkup'
      };
      
      const finalType = typeMapping[validType] || 'other';
      
      const appointment = await Appointment.create({
        patientId: patient._id,
        dentistId: dentist._id,
        date: dateTime,
        startTime: format(dateTime, 'HH:mm'),
        endTime: format(addMinutes(dateTime, appointmentDuration), 'HH:mm'),
        type: finalType,
        status: 'scheduled',
        reason: notes || `${type} appointment`,
        notes: `Appointment booked via AI receptionist`
      });
      
      // Populate patient details
      await appointment.populate('patientId');
      
      logger.info('Appointment booked successfully:', {
        appointmentId: appointment._id,
        patient: patientName,
        dateTime: dateTime
      });
      
      return {
        success: true,
        appointment,
        message: `Appointment confirmed for ${format(dateTime, 'EEEE, MMMM d')} at ${format(dateTime, 'h:mm a')}`
      };
    } catch (error) {
      logger.error('Error booking appointment:', error);
      return {
        success: false,
        message: 'There was an error booking your appointment. Please try again.'
      };
    }
  }

  // Cancel an appointment
  async cancelAppointment(identifier, reason = 'Patient requested cancellation') {
    try {
      const appointment = await Appointment.findOne({
        $or: [
          { _id: identifier },
          { confirmationCode: identifier }
        ],
        status: { $ne: 'cancelled' }
      });
      
      if (!appointment) {
        return {
          success: false,
          message: 'Appointment not found or already cancelled'
        };
      }
      
      appointment.status = 'cancelled';
      appointment.cancellationReason = reason;
      appointment.cancelledAt = new Date();
      await appointment.save();
      
      return {
        success: true,
        message: 'Appointment cancelled successfully',
        appointment
      };
    } catch (error) {
      logger.error('Error cancelling appointment:', error);
      return {
        success: false,
        message: 'Error cancelling appointment'
      };
    }
  }

  // Reschedule an appointment
  async rescheduleAppointment(identifier, newDateTime) {
    try {
      const appointment = await Appointment.findOne({
        $or: [
          { _id: identifier },
          { confirmationCode: identifier }
        ],
        status: { $ne: 'cancelled' }
      });
      
      if (!appointment) {
        return {
          success: false,
          message: 'Appointment not found'
        };
      }
      
      const duration = Math.floor((appointment.endTime - appointment.startTime) / 60000);
      
      // Check availability of new slot
      const availability = await this.checkAvailability(newDateTime, duration);
      if (!availability.available) {
        const alternatives = await this.findNextAvailableSlots(newDateTime, duration);
        return {
          success: false,
          reason: 'unavailable',
          message: 'That time is not available',
          alternatives
        };
      }
      
      // Update appointment
      appointment.startTime = newDateTime;
      appointment.endTime = addMinutes(newDateTime, duration);
      appointment.rescheduledAt = new Date();
      appointment.rescheduledCount = (appointment.rescheduledCount || 0) + 1;
      await appointment.save();
      
      return {
        success: true,
        message: `Appointment rescheduled to ${format(newDateTime, 'EEEE, MMMM d at h:mm a')}`,
        appointment
      };
    } catch (error) {
      logger.error('Error rescheduling appointment:', error);
      return {
        success: false,
        message: 'Error rescheduling appointment'
      };
    }
  }

  // Get patient's upcoming appointments
  async getPatientAppointments(patientIdentifier) {
    try {
      // Find patient
      const patient = await Patient.findOne({
        $or: [
          { email: patientIdentifier },
          { phone: patientIdentifier },
          { name: new RegExp(patientIdentifier, 'i') }
        ]
      });
      
      if (!patient) {
        return {
          success: false,
          message: 'Patient not found'
        };
      }
      
      // Get appointments
      const appointments = await Appointment.find({
        patient: patient._id,
        startTime: { $gte: new Date() },
        status: { $ne: 'cancelled' }
      }).sort('startTime').limit(5);
      
      return {
        success: true,
        appointments,
        patient
      };
    } catch (error) {
      logger.error('Error getting patient appointments:', error);
      return {
        success: false,
        message: 'Error retrieving appointments'
      };
    }
  }

  // Handle different appointment scenarios
  async handleAppointmentScenario(scenario, data) {
    switch (scenario) {
      case 'new_patient_emergency':
        // Find next available emergency slot
        const emergencySlot = await this.findNextAvailableSlots(new Date(), 45, 1);
        if (emergencySlot.length > 0) {
          return {
            action: 'book_emergency',
            slot: emergencySlot[0],
            message: `I can see you for an emergency appointment ${emergencySlot[0].date} at ${emergencySlot[0].time}`
          };
        }
        break;
        
      case 'recurring_appointment':
        // Book multiple appointments
        const recurringSlots = [];
        let recurringDate = new Date(data.startDate);
        for (let i = 0; i < data.occurrences; i++) {
          const slot = await this.findNextAvailableSlots(recurringDate, data.duration, 1);
          if (slot.length > 0) {
            recurringSlots.push(slot[0]);
          }
          recurringDate = addDays(recurringDate, data.interval || 7);
        }
        return {
          action: 'book_recurring',
          slots: recurringSlots,
          message: `I can book ${recurringSlots.length} appointments for you`
        };
        
      case 'group_appointment':
        // Handle family appointments
        const groupSlots = await this.findConsecutiveSlots(data.date, data.count * 30);
        return {
          action: 'book_group',
          slots: groupSlots,
          message: `I can schedule all ${data.count} appointments consecutively`
        };
        
      default:
        return null;
    }
  }

  // Find consecutive time slots for group bookings
  async findConsecutiveSlots(startDate, totalDuration) {
    const slots = await this.findAvailableSlots(startDate, totalDuration);
    return slots.filter(slot => {
      const duration = (slot.endTime - slot.startTime) / 60000;
      return duration >= totalDuration;
    });
  }
}

export default new SmartSchedulingService();