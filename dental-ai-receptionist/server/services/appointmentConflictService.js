import Appointment from '../models/Appointment.js';
import { addMinutes, isWithinInterval, parseISO, isSameDay } from 'date-fns';

class AppointmentConflictService {
  constructor() {
    this.bufferTime = 15; // Minutes buffer between appointments
    this.maxAppointmentsPerDay = 20; // Maximum appointments per dentist per day
    this.emergencySlotDuration = 30; // Keep emergency slots available
  }

  /**
   * Check for conflicts when scheduling a new appointment
   */
  async checkConflicts(appointmentData) {
    const conflicts = {
      hasConflict: false,
      conflicts: [],
      warnings: [],
      suggestions: []
    };

    // Parse dates
    const startTime = typeof appointmentData.startTime === 'string' 
      ? parseISO(appointmentData.startTime) 
      : appointmentData.startTime;
    
    const endTime = typeof appointmentData.endTime === 'string'
      ? parseISO(appointmentData.endTime)
      : appointmentData.endTime;

    // Add buffer time
    const bufferedStart = addMinutes(startTime, -this.bufferTime);
    const bufferedEnd = addMinutes(endTime, this.bufferTime);

    // Check for time slot conflicts
    const timeConflicts = await this.findTimeSlotConflicts(
      bufferedStart,
      bufferedEnd,
      appointmentData.dentistId,
      appointmentData.roomId
    );

    if (timeConflicts.length > 0) {
      conflicts.hasConflict = true;
      conflicts.conflicts.push(...timeConflicts);
    }

    // Check for patient double-booking
    const patientConflicts = await this.checkPatientDoubleBooking(
      appointmentData.patientId,
      startTime,
      endTime,
      appointmentData.id
    );

    if (patientConflicts.length > 0) {
      conflicts.hasConflict = true;
      conflicts.conflicts.push(...patientConflicts);
    }

    // Check for resource conflicts (equipment, rooms)
    const resourceConflicts = await this.checkResourceConflicts(
      appointmentData.resources,
      startTime,
      endTime
    );

    if (resourceConflicts.length > 0) {
      conflicts.hasConflict = true;
      conflicts.conflicts.push(...resourceConflicts);
    }

    // Check for dentist workload
    const workloadIssues = await this.checkDentistWorkload(
      appointmentData.dentistId,
      startTime
    );

    if (workloadIssues.length > 0) {
      conflicts.warnings.push(...workloadIssues);
    }

    // Generate suggestions if conflicts exist
    if (conflicts.hasConflict) {
      conflicts.suggestions = await this.generateAlternativeSlots(
        appointmentData,
        startTime
      );
    }

    // Check for special considerations
    const specialConsiderations = await this.checkSpecialConsiderations(appointmentData);
    if (specialConsiderations.length > 0) {
      conflicts.warnings.push(...specialConsiderations);
    }

    return conflicts;
  }

  /**
   * Find time slot conflicts with existing appointments
   */
  async findTimeSlotConflicts(startTime, endTime, dentistId, roomId) {
    const conflicts = [];

    // Check dentist availability
    if (dentistId) {
      const dentistConflicts = await Appointment.find({
        dentistId,
        status: { $nin: ['cancelled', 'no-show'] },
        $or: [
          {
            startTime: { $lt: endTime },
            endTime: { $gt: startTime }
          },
          {
            startTime: { $gte: startTime, $lt: endTime }
          },
          {
            endTime: { $gt: startTime, $lte: endTime }
          }
        ]
      });

      dentistConflicts.forEach(apt => {
        conflicts.push({
          type: 'dentist_conflict',
          message: `Dr. ${apt.dentistName || 'Dentist'} is already booked at this time`,
          conflictingAppointment: apt._id,
          severity: 'high'
        });
      });
    }

    // Check room availability
    if (roomId) {
      const roomConflicts = await Appointment.find({
        roomId,
        status: { $nin: ['cancelled', 'no-show'] },
        $or: [
          {
            startTime: { $lt: endTime },
            endTime: { $gt: startTime }
          }
        ]
      });

      roomConflicts.forEach(apt => {
        conflicts.push({
          type: 'room_conflict',
          message: `Room ${apt.roomNumber || roomId} is already booked at this time`,
          conflictingAppointment: apt._id,
          severity: 'high'
        });
      });
    }

    return conflicts;
  }

  /**
   * Check if patient has another appointment at the same time
   */
  async checkPatientDoubleBooking(patientId, startTime, endTime, excludeAppointmentId) {
    const conflicts = [];

    const patientAppointments = await Appointment.find({
      patientId,
      _id: { $ne: excludeAppointmentId },
      status: { $nin: ['cancelled', 'no-show'] },
      $or: [
        {
          startTime: { $lt: endTime },
          endTime: { $gt: startTime }
        }
      ]
    });

    patientAppointments.forEach(apt => {
      conflicts.push({
        type: 'patient_double_booking',
        message: 'Patient already has an appointment at this time',
        conflictingAppointment: apt._id,
        severity: 'high'
      });
    });

    // Check for same-day multiple appointments (warning only)
    const sameDayAppointments = await Appointment.find({
      patientId,
      _id: { $ne: excludeAppointmentId },
      status: { $nin: ['cancelled', 'no-show'] }
    });

    const sameDayCount = sameDayAppointments.filter(apt => 
      isSameDay(parseISO(apt.startTime), startTime)
    ).length;

    if (sameDayCount > 0) {
      conflicts.push({
        type: 'same_day_multiple',
        message: `Patient already has ${sameDayCount} appointment(s) on this day`,
        severity: 'warning'
      });
    }

    return conflicts;
  }

  /**
   * Check for resource conflicts (equipment, special rooms)
   */
  async checkResourceConflicts(resources, startTime, endTime) {
    const conflicts = [];

    if (!resources || resources.length === 0) {
      return conflicts;
    }

    for (const resource of resources) {
      const resourceConflicts = await Appointment.find({
        'resources.id': resource.id,
        status: { $nin: ['cancelled', 'no-show'] },
        $or: [
          {
            startTime: { $lt: endTime },
            endTime: { $gt: startTime }
          }
        ]
      });

      if (resourceConflicts.length > 0) {
        conflicts.push({
          type: 'resource_conflict',
          message: `${resource.name} is not available at this time`,
          resource: resource.name,
          severity: 'medium'
        });
      }
    }

    return conflicts;
  }

  /**
   * Check dentist workload and schedule constraints
   */
  async checkDentistWorkload(dentistId, date) {
    const warnings = [];

    // Count appointments for the day
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);

    const dayAppointments = await Appointment.countDocuments({
      dentistId,
      startTime: { $gte: dayStart, $lte: dayEnd },
      status: { $nin: ['cancelled', 'no-show'] }
    });

    if (dayAppointments >= this.maxAppointmentsPerDay) {
      warnings.push({
        type: 'workload_exceeded',
        message: `Dentist already has ${dayAppointments} appointments this day (max: ${this.maxAppointmentsPerDay})`,
        severity: 'warning'
      });
    }

    // Check for back-to-back appointments
    const nearbyAppointments = await Appointment.find({
      dentistId,
      startTime: {
        $gte: addMinutes(date, -60),
        $lte: addMinutes(date, 60)
      },
      status: { $nin: ['cancelled', 'no-show'] }
    }).sort('startTime');

    let consecutiveCount = 0;
    let lastEndTime = null;

    nearbyAppointments.forEach(apt => {
      if (lastEndTime && (new Date(apt.startTime) - lastEndTime) < 15 * 60000) {
        consecutiveCount++;
      } else {
        consecutiveCount = 1;
      }
      lastEndTime = new Date(apt.endTime);
    });

    if (consecutiveCount >= 3) {
      warnings.push({
        type: 'consecutive_appointments',
        message: 'Dentist has multiple back-to-back appointments. Consider adding a break.',
        severity: 'warning'
      });
    }

    // Check for lunch break
    const lunchStart = new Date(date);
    lunchStart.setHours(12, 0, 0, 0);
    const lunchEnd = new Date(date);
    lunchEnd.setHours(13, 0, 0, 0);

    const lunchConflicts = await Appointment.find({
      dentistId,
      startTime: { $lt: lunchEnd },
      endTime: { $gt: lunchStart },
      status: { $nin: ['cancelled', 'no-show'] }
    });

    if (lunchConflicts.length > 0) {
      warnings.push({
        type: 'lunch_break_conflict',
        message: 'Appointment scheduled during typical lunch hours',
        severity: 'info'
      });
    }

    return warnings;
  }

  /**
   * Check for special considerations (emergencies, high-priority patients)
   */
  async checkSpecialConsiderations(appointmentData) {
    const warnings = [];

    // Check if emergency slots are being used for non-emergency
    if (!appointmentData.isEmergency && appointmentData.type !== 'Emergency') {
      const hour = new Date(appointmentData.startTime).getHours();
      if (hour === 11 || hour === 15) { // Reserved emergency hours
        warnings.push({
          type: 'emergency_slot_usage',
          message: 'This time slot is typically reserved for emergencies',
          severity: 'info'
        });
      }
    }

    // Check for patient special needs
    if (appointmentData.patientSpecialNeeds) {
      warnings.push({
        type: 'special_needs',
        message: 'Patient has special needs - ensure appropriate resources are available',
        severity: 'info'
      });
    }

    // Check for complex procedures needing extra time
    const complexProcedures = ['Root Canal', 'Oral Surgery', 'Multiple Extractions', 'Full Mouth Restoration'];
    if (complexProcedures.includes(appointmentData.type)) {
      const duration = (new Date(appointmentData.endTime) - new Date(appointmentData.startTime)) / 60000;
      if (duration < 90) {
        warnings.push({
          type: 'insufficient_time',
          message: `${appointmentData.type} typically requires at least 90 minutes`,
          severity: 'warning'
        });
      }
    }

    return warnings;
  }

  /**
   * Generate alternative time slots if conflicts exist
   */
  async generateAlternativeSlots(appointmentData, preferredTime) {
    const suggestions = [];
    const duration = (new Date(appointmentData.endTime) - new Date(appointmentData.startTime)) / 60000;
    
    // Look for slots in the next 7 days
    for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
      const checkDate = new Date(preferredTime);
      checkDate.setDate(checkDate.getDate() + dayOffset);
      
      // Check morning, afternoon, and late afternoon slots
      const timeSlots = [
        { hour: 9, minute: 0 },
        { hour: 10, minute: 30 },
        { hour: 14, minute: 0 },
        { hour: 15, minute: 30 }
      ];

      for (const slot of timeSlots) {
        const slotStart = new Date(checkDate);
        slotStart.setHours(slot.hour, slot.minute, 0, 0);
        const slotEnd = addMinutes(slotStart, duration);

        // Check if this slot is available
        const conflicts = await this.findTimeSlotConflicts(
          slotStart,
          slotEnd,
          appointmentData.dentistId,
          appointmentData.roomId
        );

        if (conflicts.length === 0) {
          suggestions.push({
            startTime: slotStart,
            endTime: slotEnd,
            date: slotStart.toLocaleDateString(),
            time: slotStart.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            available: true
          });

          if (suggestions.length >= 5) {
            return suggestions;
          }
        }
      }
    }

    return suggestions;
  }

  /**
   * Optimize schedule by rearranging appointments
   */
  async optimizeSchedule(date, dentistId) {
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);

    const appointments = await Appointment.find({
      dentistId,
      startTime: { $gte: dayStart, $lte: dayEnd },
      status: { $nin: ['cancelled', 'no-show'] }
    }).sort('startTime');

    const optimizations = [];

    // Check for gaps that could be filled
    for (let i = 0; i < appointments.length - 1; i++) {
      const gap = new Date(appointments[i + 1].startTime) - new Date(appointments[i].endTime);
      const gapMinutes = gap / 60000;

      if (gapMinutes > 30 && gapMinutes < 60) {
        optimizations.push({
          type: 'gap_optimization',
          message: `${gapMinutes} minute gap between appointments could be optimized`,
          suggestion: 'Consider moving appointments closer or scheduling a quick procedure'
        });
      }
    }

    // Check for inefficient procedure ordering
    const procedures = appointments.map(a => a.type);
    if (procedures.includes('Cleaning') && procedures.includes('X-Ray')) {
      optimizations.push({
        type: 'procedure_ordering',
        message: 'Consider grouping similar procedures together for efficiency',
        suggestion: 'Schedule all cleanings together, then X-rays'
      });
    }

    return optimizations;
  }
}

export default new AppointmentConflictService();