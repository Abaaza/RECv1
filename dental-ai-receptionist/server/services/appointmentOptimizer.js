import moment from 'moment-timezone';

class AppointmentOptimizer {
  constructor() {
    this.workingHours = {
      monday: { start: '08:00', end: '18:00', breaks: [{ start: '12:00', end: '13:00' }] },
      tuesday: { start: '08:00', end: '18:00', breaks: [{ start: '12:00', end: '13:00' }] },
      wednesday: { start: '08:00', end: '18:00', breaks: [{ start: '12:00', end: '13:00' }] },
      thursday: { start: '08:00', end: '18:00', breaks: [{ start: '12:00', end: '13:00' }] },
      friday: { start: '08:00', end: '17:00', breaks: [{ start: '12:00', end: '13:00' }] },
      saturday: { start: '09:00', end: '14:00', breaks: [] },
      sunday: null // Closed
    };

    this.procedureDurations = {
      'checkup': 30,
      'cleaning': 45,
      'filling': 60,
      'extraction': 45,
      'root_canal': 90,
      'crown': 60,
      'implant': 120,
      'orthodontic': 30,
      'whitening': 60,
      'emergency': 45,
      'consultation': 30,
      'surgery': 120,
      'pediatric': 30,
      'xray': 15,
      'periodontal': 60
    };

    this.bufferTime = 15; // Minutes between appointments for sanitization
    this.emergencySlots = 2; // Reserved slots per day for emergencies
  }

  async findOptimalSlot(appointmentType, preferredDate, patientPreferences, existingAppointments, dentistId) {
    const duration = this.procedureDurations[appointmentType] || 30;
    const slots = await this.generateAvailableSlots(preferredDate, duration, existingAppointments, dentistId);
    
    // Score slots based on patient preferences
    const scoredSlots = slots.map(slot => ({
      ...slot,
      score: this.calculateSlotScore(slot, patientPreferences)
    }));

    // Sort by score (higher is better)
    scoredSlots.sort((a, b) => b.score - a.score);

    return scoredSlots.slice(0, 5); // Return top 5 options
  }

  async generateAvailableSlots(date, duration, existingAppointments, dentistId) {
    const dayOfWeek = moment(date).format('dddd').toLowerCase();
    const workingHours = this.workingHours[dayOfWeek];
    
    if (!workingHours) {
      return []; // Office closed
    }

    const slots = [];
    const startTime = moment(date).set({
      hour: parseInt(workingHours.start.split(':')[0]),
      minute: parseInt(workingHours.start.split(':')[1])
    });
    const endTime = moment(date).set({
      hour: parseInt(workingHours.end.split(':')[0]),
      minute: parseInt(workingHours.end.split(':')[1])
    });

    let currentTime = startTime.clone();

    while (currentTime.clone().add(duration, 'minutes').isSameOrBefore(endTime)) {
      // Check if slot is during break time
      const isDuringBreak = workingHours.breaks.some(breakTime => {
        const breakStart = moment(date).set({
          hour: parseInt(breakTime.start.split(':')[0]),
          minute: parseInt(breakTime.start.split(':')[1])
        });
        const breakEnd = moment(date).set({
          hour: parseInt(breakTime.end.split(':')[0]),
          minute: parseInt(breakTime.end.split(':')[1])
        });
        return currentTime.isBetween(breakStart, breakEnd, null, '[)') ||
               currentTime.clone().add(duration, 'minutes').isBetween(breakStart, breakEnd, null, '(]');
      });

      if (!isDuringBreak) {
        // Check for conflicts with existing appointments
        const hasConflict = existingAppointments.some(apt => {
          if (apt.dentistId !== dentistId) return false;
          const aptStart = moment(apt.startTime);
          const aptEnd = moment(apt.endTime).add(this.bufferTime, 'minutes');
          return currentTime.isBetween(aptStart, aptEnd, null, '[)') ||
                 currentTime.clone().add(duration + this.bufferTime, 'minutes').isBetween(aptStart, aptEnd, null, '(]') ||
                 aptStart.isBetween(currentTime, currentTime.clone().add(duration + this.bufferTime, 'minutes'), null, '[)');
        });

        if (!hasConflict) {
          slots.push({
            startTime: currentTime.toISOString(),
            endTime: currentTime.clone().add(duration, 'minutes').toISOString(),
            duration,
            dentistId
          });
        }
      }

      currentTime.add(15, 'minutes'); // Check every 15 minutes
    }

    return slots;
  }

  calculateSlotScore(slot, preferences) {
    let score = 100;
    const slotTime = moment(slot.startTime);
    const hour = slotTime.hour();

    // Time of day preferences
    if (preferences.preferredTimeOfDay) {
      if (preferences.preferredTimeOfDay === 'morning' && hour < 12) {
        score += 20;
      } else if (preferences.preferredTimeOfDay === 'afternoon' && hour >= 12 && hour < 17) {
        score += 20;
      } else if (preferences.preferredTimeOfDay === 'evening' && hour >= 17) {
        score += 20;
      }
    }

    // Urgency scoring
    if (preferences.urgency === 'high') {
      // Prefer earlier slots for urgent cases
      const daysFromNow = moment(slot.startTime).diff(moment(), 'days');
      score -= daysFromNow * 10;
    }

    // Avoid rush hours if specified
    if (preferences.avoidRushHours) {
      if ((hour >= 8 && hour <= 9) || (hour >= 17 && hour <= 18)) {
        score -= 15;
      }
    }

    // Prefer slots with less waiting time
    if (preferences.minimizeWaitTime) {
      const minutesUntilSlot = moment(slot.startTime).diff(moment(), 'minutes');
      if (minutesUntilSlot < 120) { // Within 2 hours
        score += 15;
      }
    }

    return score;
  }

  detectConflicts(newAppointment, existingAppointments) {
    const conflicts = [];
    const newStart = moment(newAppointment.startTime);
    const newEnd = moment(newAppointment.endTime).add(this.bufferTime, 'minutes');

    existingAppointments.forEach(apt => {
      if (apt.dentistId === newAppointment.dentistId || apt.patientId === newAppointment.patientId) {
        const aptStart = moment(apt.startTime);
        const aptEnd = moment(apt.endTime).add(this.bufferTime, 'minutes');

        if (newStart.isBetween(aptStart, aptEnd, null, '[)') ||
            newEnd.isBetween(aptStart, aptEnd, null, '(]') ||
            aptStart.isBetween(newStart, newEnd, null, '[)')) {
          conflicts.push({
            type: apt.dentistId === newAppointment.dentistId ? 'dentist' : 'patient',
            conflictingAppointment: apt,
            message: `Conflict with ${apt.type} appointment at ${aptStart.format('HH:mm')}`
          });
        }
      }
    });

    return conflicts;
  }

  suggestRescheduling(appointment, reason, existingAppointments) {
    const suggestions = [];
    const currentDate = moment(appointment.startTime);
    
    // Try to find slots on the same day first
    for (let i = 0; i < 7; i++) {
      const checkDate = currentDate.clone().add(i, 'days');
      const availableSlots = this.generateAvailableSlots(
        checkDate,
        appointment.duration,
        existingAppointments,
        appointment.dentistId
      );

      if (availableSlots.length > 0) {
        suggestions.push(...availableSlots.slice(0, 2).map(slot => ({
          ...slot,
          date: checkDate.format('YYYY-MM-DD'),
          reason: i === 0 ? 'Same day alternative' : `Available in ${i} days`
        })));
      }

      if (suggestions.length >= 5) break;
    }

    return suggestions;
  }

  optimizeDailySchedule(appointments, dentists) {
    // Group appointments by dentist
    const scheduleByDentist = {};
    
    appointments.forEach(apt => {
      if (!scheduleByDentist[apt.dentistId]) {
        scheduleByDentist[apt.dentistId] = [];
      }
      scheduleByDentist[apt.dentistId].push(apt);
    });

    const optimizationSuggestions = [];

    Object.keys(scheduleByDentist).forEach(dentistId => {
      const dentistAppointments = scheduleByDentist[dentistId];
      
      // Sort by start time
      dentistAppointments.sort((a, b) => 
        moment(a.startTime).diff(moment(b.startTime))
      );

      // Check for gaps that could be filled
      for (let i = 0; i < dentistAppointments.length - 1; i++) {
        const current = dentistAppointments[i];
        const next = dentistAppointments[i + 1];
        const gap = moment(next.startTime).diff(moment(current.endTime), 'minutes');

        if (gap > 45) { // Significant gap
          optimizationSuggestions.push({
            type: 'gap',
            dentistId,
            startTime: moment(current.endTime).toISOString(),
            endTime: moment(next.startTime).toISOString(),
            duration: gap,
            suggestion: `${gap} minute gap could accommodate a short procedure`
          });
        }
      }

      // Check for overtime
      const lastAppointment = dentistAppointments[dentistAppointments.length - 1];
      const dayOfWeek = moment(lastAppointment.startTime).format('dddd').toLowerCase();
      const workingHours = this.workingHours[dayOfWeek];
      
      if (workingHours) {
        const endOfDay = moment(lastAppointment.startTime).set({
          hour: parseInt(workingHours.end.split(':')[0]),
          minute: parseInt(workingHours.end.split(':')[1])
        });

        if (moment(lastAppointment.endTime).isAfter(endOfDay)) {
          optimizationSuggestions.push({
            type: 'overtime',
            dentistId,
            appointment: lastAppointment,
            overtime: moment(lastAppointment.endTime).diff(endOfDay, 'minutes'),
            suggestion: 'Consider rescheduling to avoid overtime'
          });
        }
      }
    });

    return optimizationSuggestions;
  }

  calculateUtilization(appointments, dentists, date) {
    const utilization = {};
    
    dentists.forEach(dentist => {
      const dayOfWeek = moment(date).format('dddd').toLowerCase();
      const workingHours = this.workingHours[dayOfWeek];
      
      if (!workingHours) {
        utilization[dentist.id] = 0;
        return;
      }

      const totalWorkMinutes = moment(date).set({
        hour: parseInt(workingHours.end.split(':')[0]),
        minute: parseInt(workingHours.end.split(':')[1])
      }).diff(moment(date).set({
        hour: parseInt(workingHours.start.split(':')[0]),
        minute: parseInt(workingHours.start.split(':')[1])
      }), 'minutes');

      // Subtract break time
      const breakMinutes = workingHours.breaks.reduce((total, breakTime) => {
        return total + moment.duration(
          moment(breakTime.end, 'HH:mm').diff(moment(breakTime.start, 'HH:mm'))
        ).asMinutes();
      }, 0);

      const availableMinutes = totalWorkMinutes - breakMinutes;

      // Calculate booked time
      const bookedMinutes = appointments
        .filter(apt => apt.dentistId === dentist.id)
        .reduce((total, apt) => {
          return total + moment(apt.endTime).diff(moment(apt.startTime), 'minutes');
        }, 0);

      utilization[dentist.id] = {
        percentage: Math.round((bookedMinutes / availableMinutes) * 100),
        bookedMinutes,
        availableMinutes,
        freeMinutes: availableMinutes - bookedMinutes
      };
    });

    return utilization;
  }

  predictNoShow(appointment, patientHistory) {
    let riskScore = 0;
    
    // Check patient's history
    if (patientHistory) {
      const totalAppointments = patientHistory.length;
      const noShows = patientHistory.filter(apt => apt.status === 'no-show').length;
      
      if (totalAppointments > 0) {
        const noShowRate = noShows / totalAppointments;
        riskScore += noShowRate * 50;
      }

      // Recent no-shows are more predictive
      const recentNoShows = patientHistory
        .slice(-5)
        .filter(apt => apt.status === 'no-show').length;
      
      riskScore += recentNoShows * 10;
    }

    // Time-based factors
    const appointmentTime = moment(appointment.startTime);
    const hour = appointmentTime.hour();
    
    // Early morning and late afternoon have higher no-show rates
    if (hour < 9 || hour > 16) {
      riskScore += 10;
    }

    // Monday and Friday have higher no-show rates
    const dayOfWeek = appointmentTime.day();
    if (dayOfWeek === 1 || dayOfWeek === 5) {
      riskScore += 5;
    }

    // Far future appointments have higher no-show risk
    const daysUntilAppointment = appointmentTime.diff(moment(), 'days');
    if (daysUntilAppointment > 30) {
      riskScore += 15;
    }

    return {
      risk: riskScore > 50 ? 'high' : riskScore > 25 ? 'medium' : 'low',
      score: Math.min(riskScore, 100),
      factors: {
        historicalNoShows: patientHistory ? patientHistory.filter(apt => apt.status === 'no-show').length : 0,
        timeOfDay: hour < 9 || hour > 16 ? 'suboptimal' : 'optimal',
        dayOfWeek: dayOfWeek === 1 || dayOfWeek === 5 ? 'high-risk' : 'normal',
        leadTime: daysUntilAppointment
      }
    };
  }
}

export default new AppointmentOptimizer();