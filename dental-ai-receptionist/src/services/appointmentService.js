import { format, addDays, setHours, setMinutes, isBefore, isAfter, parseISO, isSameDay } from 'date-fns';
import apiService from './apiService';

class AppointmentService {
  constructor() {
    this.workingHours = {
      start: 9, // 9 AM
      end: 17,  // 5 PM
      lunchStart: 12, // 12 PM
      lunchEnd: 13,  // 1 PM
      slotDuration: 30 // minutes
    };
    this.workingDays = [1, 2, 3, 4, 5]; // Monday to Friday
    this.appointments = [];
    this.lastFetch = null;
    this.cacheTimeout = 60000; // 1 minute cache
  }

  async loadAppointments(forceRefresh = false) {
    // Use cache if available and not expired
    if (!forceRefresh && this.lastFetch && (Date.now() - this.lastFetch < this.cacheTimeout)) {
      return this.appointments;
    }

    try {
      const response = await apiService.getAppointments();
      this.appointments = Array.isArray(response) ? response : (response.appointments || []);
      this.lastFetch = Date.now();
      return this.appointments;
    } catch (error) {
      console.error('Failed to load appointments:', error);
      // Fall back to cached data if available
      return this.appointments || [];
    }
  }

  generateTimeSlots(date) {
    const slots = [];
    const dayOfWeek = date.getDay();
    
    // Check if it's a working day
    if (!this.workingDays.includes(dayOfWeek)) {
      return slots;
    }

    let currentTime = setMinutes(setHours(date, this.workingHours.start), 0);
    const endTime = setHours(date, this.workingHours.end);
    const lunchStart = setHours(date, this.workingHours.lunchStart);
    const lunchEnd = setHours(date, this.workingHours.lunchEnd);

    while (isBefore(currentTime, endTime)) {
      // Skip lunch hours
      if (!this.isLunchTime(currentTime, lunchStart, lunchEnd)) {
        const isAvailable = this.isSlotAvailable(currentTime);
        slots.push({
          time: currentTime,
          display: format(currentTime, 'h:mm a'),
          available: isAvailable
        });
      }
      currentTime = new Date(currentTime.getTime() + this.workingHours.slotDuration * 60000);
    }

    return slots;
  }

  isLunchTime(time, lunchStart, lunchEnd) {
    return !isBefore(time, lunchStart) && isBefore(time, lunchEnd);
  }

  isSlotAvailable(slotTime) {
    // Check if slot is in the past
    if (isBefore(slotTime, new Date())) {
      return false;
    }

    // Check if slot conflicts with existing appointments
    return !this.appointments.some(apt => {
      if (apt.status === 'cancelled') return false;
      
      const aptStart = typeof apt.startTime === 'string' ? parseISO(apt.startTime) : apt.startTime;
      const aptEnd = typeof apt.endTime === 'string' ? parseISO(apt.endTime) : apt.endTime;
      
      return !isBefore(slotTime, aptStart) && isBefore(slotTime, aptEnd);
    });
  }

  async getAvailableSlots(date, duration = 30) {
    // Ensure appointments are loaded
    await this.loadAppointments();
    
    const slots = this.generateTimeSlots(date);
    return slots.filter(slot => {
      if (!slot.available) return false;
      
      // Check if we have enough consecutive slots for the duration
      const requiredSlots = Math.ceil(duration / this.workingHours.slotDuration);
      let consecutiveAvailable = 0;
      
      for (let i = slots.indexOf(slot); i < slots.length && consecutiveAvailable < requiredSlots; i++) {
        if (slots[i] && slots[i].available) {
          consecutiveAvailable++;
        } else {
          break;
        }
      }
      
      return consecutiveAvailable >= requiredSlots;
    });
  }

  async createAppointment(appointmentData) {
    try {
      const response = await apiService.createAppointment({
        patientName: appointmentData.patientName,
        patientPhone: appointmentData.patientPhone,
        patientEmail: appointmentData.patientEmail,
        type: appointmentData.type || appointmentData.appointmentType,
        startTime: appointmentData.startTime,
        endTime: appointmentData.endTime,
        duration: appointmentData.duration,
        notes: appointmentData.notes || '',
        status: 'scheduled'
      });
      
      // Refresh appointments cache
      await this.loadAppointments(true);
      
      return response;
    } catch (error) {
      console.error('Failed to create appointment:', error);
      throw error;
    }
  }

  async cancelAppointment(appointmentId) {
    try {
      await apiService.cancelAppointment(appointmentId);
      // Refresh appointments cache
      await this.loadAppointments(true);
      return true;
    } catch (error) {
      console.error('Failed to cancel appointment:', error);
      return false;
    }
  }

  async rescheduleAppointment(appointmentId, newStartTime, newEndTime) {
    try {
      const response = await apiService.updateAppointment(appointmentId, {
        startTime: newStartTime,
        endTime: newEndTime,
        status: 'rescheduled'
      });
      
      // Refresh appointments cache
      await this.loadAppointments(true);
      
      return response;
    } catch (error) {
      console.error('Failed to reschedule appointment:', error);
      return null;
    }
  }

  async getAppointmentsByDate(date) {
    await this.loadAppointments();
    
    return this.appointments.filter(apt => {
      // Handle both date field and startTime field formats
      let aptDate;
      if (apt.date) {
        aptDate = typeof apt.date === 'string' ? parseISO(apt.date) : apt.date;
      } else if (apt.startTime) {
        aptDate = typeof apt.startTime === 'string' ? parseISO(apt.startTime) : apt.startTime;
      } else {
        return false;
      }
      return isSameDay(aptDate, date) && apt.status !== 'cancelled';
    });
  }

  async getUpcomingAppointments(limit = 10) {
    await this.loadAppointments();
    
    const now = new Date();
    return this.appointments
      .filter(apt => {
        const aptStart = typeof apt.startTime === 'string' ? parseISO(apt.startTime) : apt.startTime;
        return isAfter(aptStart, now) && apt.status !== 'cancelled';
      })
      .sort((a, b) => {
        const aStart = typeof a.startTime === 'string' ? parseISO(a.startTime) : a.startTime;
        const bStart = typeof b.startTime === 'string' ? parseISO(b.startTime) : b.startTime;
        return aStart - bStart;
      })
      .slice(0, limit);
  }

  async getNextAvailableSlot(appointmentType = 'Regular Checkup') {
    const durations = {
      'Regular Checkup': 30,
      'Emergency': 45,
      'Consultation': 20,
      'Filling': 60,
      'Root Canal': 90,
      'Extraction': 45,
      'Crown/Bridge': 60,
      'Orthodontic': 30
    };

    const duration = durations[appointmentType] || 30;
    let date = new Date();
    let maxDays = 30; // Look up to 30 days ahead

    while (maxDays > 0) {
      const availableSlots = await this.getAvailableSlots(date, duration);
      if (availableSlots.length > 0) {
        return {
          date: date,
          slot: availableSlots[0],
          formattedDate: format(date, 'EEEE, MMMM d, yyyy'),
          formattedTime: availableSlots[0].display
        };
      }
      date = addDays(date, 1);
      maxDays--;
    }

    return null;
  }

  async searchPatientAppointments(searchTerm) {
    await this.loadAppointments();
    
    const term = searchTerm.toLowerCase();
    return this.appointments.filter(apt => 
      (apt.patientName && apt.patientName.toLowerCase().includes(term)) ||
      (apt.patientPhone && apt.patientPhone.includes(term)) ||
      (apt.patientEmail && apt.patientEmail.toLowerCase().includes(term))
    );
  }
}

export default new AppointmentService();