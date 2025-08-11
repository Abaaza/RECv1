import cron from 'node-cron';
import { logger } from '../utils/logger.js';
import Appointment from '../models/Appointment.js';
import Patient from '../models/Patient.js';
import emailService from './emailService.js';
import smsService from './smsService.js';
import { addDays, addWeeks, addMonths, format, isBefore, isAfter } from 'date-fns';

class RecurringAppointmentService {
  constructor() {
    this.recurringPatterns = {
      DAILY: 'daily',
      WEEKLY: 'weekly',
      BIWEEKLY: 'biweekly',
      MONTHLY: 'monthly',
      QUARTERLY: 'quarterly',
      BIANNUAL: 'biannual',
      ANNUAL: 'annual',
      CUSTOM: 'custom'
    };
    
    this.appointmentRules = new Map();
    this.scheduledJobs = new Map();
    
    this.initializeScheduler();
  }

  // Initialize the scheduler
  initializeScheduler() {
    // Run every day at 2 AM to generate recurring appointments
    cron.schedule('0 2 * * *', async () => {
      logger.info('Running recurring appointment generation...');
      await this.generateRecurringAppointments();
    });
    
    // Run every day at 9 AM to send reminders
    cron.schedule('0 9 * * *', async () => {
      logger.info('Sending appointment reminders...');
      await this.sendAppointmentReminders();
    });
    
    // Run every Monday at 10 AM to check for recall appointments
    cron.schedule('0 10 * * 1', async () => {
      logger.info('Checking for recall appointments...');
      await this.generateRecallAppointments();
    });
  }

  // Create a recurring appointment rule
  async createRecurringRule(options) {
    const {
      patientId,
      dentistId,
      appointmentType,
      pattern,
      frequency,
      customInterval,
      startDate,
      endDate,
      occurrences,
      timeSlot,
      duration,
      notes,
      autoConfirm = false
    } = options;
    
    try {
      const rule = {
        id: `rule_${Date.now()}`,
        patientId,
        dentistId,
        appointmentType,
        pattern,
        frequency: pattern === 'custom' ? customInterval : this.getFrequencyDays(pattern),
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : null,
        occurrences: occurrences || null,
        timeSlot,
        duration,
        notes,
        autoConfirm,
        createdAt: new Date(),
        active: true,
        generatedAppointments: []
      };
      
      // Validate the rule
      this.validateRecurringRule(rule);
      
      // Store the rule
      this.appointmentRules.set(rule.id, rule);
      
      // Generate initial appointments
      const appointments = await this.generateAppointmentsFromRule(rule);
      
      // Save rule to database
      await this.saveRuleToDatabase(rule);
      
      logger.info(`Created recurring appointment rule: ${rule.id}`);
      
      return {
        ruleId: rule.id,
        appointmentsCreated: appointments.length,
        nextAppointment: appointments[0],
        pattern: rule.pattern,
        frequency: rule.frequency
      };
    } catch (error) {
      logger.error('Error creating recurring rule:', error);
      throw error;
    }
  }

  // Generate appointments from a rule
  async generateAppointmentsFromRule(rule, lookaheadDays = 90) {
    const appointments = [];
    const endDate = rule.endDate || addDays(new Date(), lookaheadDays);
    let currentDate = new Date(rule.startDate);
    let occurrenceCount = 0;
    
    while (
      isBefore(currentDate, endDate) &&
      (!rule.occurrences || occurrenceCount < rule.occurrences)
    ) {
      // Check if appointment already exists
      const existingAppointment = await Appointment.findOne({
        patientId: rule.patientId,
        dentistId: rule.dentistId,
        dateTime: currentDate,
        recurringRuleId: rule.id
      });
      
      if (!existingAppointment) {
        // Create new appointment
        const appointment = await this.createAppointmentFromRule(rule, currentDate);
        appointments.push(appointment);
        rule.generatedAppointments.push(appointment._id);
      }
      
      // Calculate next date based on pattern
      currentDate = this.getNextDate(currentDate, rule.pattern, rule.frequency);
      occurrenceCount++;
    }
    
    return appointments;
  }

  // Create a single appointment from rule
  async createAppointmentFromRule(rule, date) {
    const appointmentDate = new Date(date);
    appointmentDate.setHours(rule.timeSlot.hour, rule.timeSlot.minute, 0, 0);
    
    const appointment = new Appointment({
      patientId: rule.patientId,
      dentistId: rule.dentistId,
      dateTime: appointmentDate,
      duration: rule.duration,
      type: rule.appointmentType,
      status: rule.autoConfirm ? 'confirmed' : 'scheduled',
      notes: rule.notes || 'Recurring appointment',
      recurringRuleId: rule.id,
      createdBy: 'system',
      createdAt: new Date()
    });
    
    await appointment.save();
    
    // Send notification if autoConfirm is true
    if (rule.autoConfirm) {
      await this.sendAppointmentNotification(appointment);
    }
    
    return appointment;
  }

  // Get next date based on pattern
  getNextDate(currentDate, pattern, customInterval) {
    switch (pattern) {
      case 'daily':
        return addDays(currentDate, 1);
      case 'weekly':
        return addWeeks(currentDate, 1);
      case 'biweekly':
        return addWeeks(currentDate, 2);
      case 'monthly':
        return addMonths(currentDate, 1);
      case 'quarterly':
        return addMonths(currentDate, 3);
      case 'biannual':
        return addMonths(currentDate, 6);
      case 'annual':
        return addMonths(currentDate, 12);
      case 'custom':
        return addDays(currentDate, customInterval);
      default:
        return addMonths(currentDate, 1);
    }
  }

  // Get frequency in days
  getFrequencyDays(pattern) {
    const frequencies = {
      daily: 1,
      weekly: 7,
      biweekly: 14,
      monthly: 30,
      quarterly: 90,
      biannual: 180,
      annual: 365
    };
    
    return frequencies[pattern] || 30;
  }

  // Validate recurring rule
  validateRecurringRule(rule) {
    if (!rule.patientId || !rule.dentistId) {
      throw new Error('Patient and dentist are required');
    }
    
    if (!rule.startDate || isNaN(rule.startDate.getTime())) {
      throw new Error('Valid start date is required');
    }
    
    if (rule.endDate && isBefore(rule.endDate, rule.startDate)) {
      throw new Error('End date must be after start date');
    }
    
    if (rule.occurrences && rule.occurrences < 1) {
      throw new Error('Occurrences must be at least 1');
    }
    
    if (!rule.timeSlot || !rule.timeSlot.hour === undefined) {
      throw new Error('Time slot is required');
    }
    
    return true;
  }

  // Update recurring rule
  async updateRecurringRule(ruleId, updates) {
    const rule = this.appointmentRules.get(ruleId);
    
    if (!rule) {
      throw new Error('Recurring rule not found');
    }
    
    // Update rule properties
    Object.assign(rule, updates);
    
    // Revalidate
    this.validateRecurringRule(rule);
    
    // Cancel future appointments if pattern changed
    if (updates.pattern || updates.frequency || updates.timeSlot) {
      await this.cancelFutureAppointments(ruleId);
      await this.generateAppointmentsFromRule(rule);
    }
    
    // Save updates to database
    await this.saveRuleToDatabase(rule);
    
    return rule;
  }

  // Cancel recurring rule
  async cancelRecurringRule(ruleId, cancelFutureAppointments = true) {
    const rule = this.appointmentRules.get(ruleId);
    
    if (!rule) {
      throw new Error('Recurring rule not found');
    }
    
    rule.active = false;
    
    if (cancelFutureAppointments) {
      await this.cancelFutureAppointments(ruleId);
    }
    
    this.appointmentRules.delete(ruleId);
    
    logger.info(`Cancelled recurring rule: ${ruleId}`);
    
    return { success: true, appointmentsCancelled: rule.generatedAppointments.length };
  }

  // Cancel future appointments for a rule
  async cancelFutureAppointments(ruleId) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const result = await Appointment.updateMany(
      {
        recurringRuleId: ruleId,
        dateTime: { $gte: today },
        status: { $in: ['scheduled', 'confirmed'] }
      },
      {
        status: 'cancelled',
        cancellationReason: 'Recurring rule cancelled',
        cancelledAt: new Date()
      }
    );
    
    logger.info(`Cancelled ${result.modifiedCount} future appointments for rule ${ruleId}`);
    
    return result.modifiedCount;
  }

  // Generate recurring appointments (daily job)
  async generateRecurringAppointments() {
    const activeRules = Array.from(this.appointmentRules.values()).filter(r => r.active);
    let totalGenerated = 0;
    
    for (const rule of activeRules) {
      try {
        const appointments = await this.generateAppointmentsFromRule(rule);
        totalGenerated += appointments.length;
      } catch (error) {
        logger.error(`Error generating appointments for rule ${rule.id}:`, error);
      }
    }
    
    logger.info(`Generated ${totalGenerated} recurring appointments`);
    
    return totalGenerated;
  }

  // Generate recall appointments
  async generateRecallAppointments() {
    try {
      // Find patients due for recall
      const sixMonthsAgo = addMonths(new Date(), -6);
      const oneYearAgo = addMonths(new Date(), -12);
      
      // Find patients who haven't had a checkup in 6 months
      const patientsForRecall = await Patient.aggregate([
        {
          $lookup: {
            from: 'appointments',
            localField: '_id',
            foreignField: 'patientId',
            as: 'appointments'
          }
        },
        {
          $addFields: {
            lastCheckup: {
              $max: {
                $filter: {
                  input: '$appointments',
                  cond: {
                    $and: [
                      { $eq: ['$$this.type', 'checkup'] },
                      { $eq: ['$$this.status', 'completed'] }
                    ]
                  }
                }
              }
            }
          }
        },
        {
          $match: {
            $or: [
              { lastCheckup: { $lt: sixMonthsAgo } },
              { lastCheckup: null }
            ]
          }
        }
      ]);
      
      let recallsGenerated = 0;
      
      for (const patient of patientsForRecall) {
        // Create recall appointment suggestion
        const recallDate = addWeeks(new Date(), 2); // 2 weeks from now
        
        // Check if recall already exists
        const existingRecall = await Appointment.findOne({
          patientId: patient._id,
          type: 'checkup',
          dateTime: { $gte: new Date() },
          status: { $in: ['scheduled', 'confirmed'] }
        });
        
        if (!existingRecall) {
          // Send recall notification
          await this.sendRecallNotification(patient, recallDate);
          recallsGenerated++;
        }
      }
      
      logger.info(`Generated ${recallsGenerated} recall notifications`);
      
      return recallsGenerated;
    } catch (error) {
      logger.error('Error generating recall appointments:', error);
      throw error;
    }
  }

  // Send appointment reminder
  async sendAppointmentReminders() {
    try {
      // Find appointments for tomorrow
      const tomorrow = addDays(new Date(), 1);
      tomorrow.setHours(0, 0, 0, 0);
      const dayAfterTomorrow = addDays(tomorrow, 1);
      
      const appointments = await Appointment.find({
        dateTime: {
          $gte: tomorrow,
          $lt: dayAfterTomorrow
        },
        status: { $in: ['scheduled', 'confirmed'] },
        reminderSent: { $ne: true }
      }).populate('patientId');
      
      let remindersSent = 0;
      
      for (const appointment of appointments) {
        try {
          await this.sendReminderNotification(appointment);
          
          // Mark reminder as sent
          appointment.reminderSent = true;
          await appointment.save();
          
          remindersSent++;
        } catch (error) {
          logger.error(`Error sending reminder for appointment ${appointment._id}:`, error);
        }
      }
      
      logger.info(`Sent ${remindersSent} appointment reminders`);
      
      return remindersSent;
    } catch (error) {
      logger.error('Error sending appointment reminders:', error);
      throw error;
    }
  }

  // Send appointment notification
  async sendAppointmentNotification(appointment) {
    const patient = await Patient.findById(appointment.patientId);
    
    if (patient.preferences?.notifications?.email) {
      await emailService.sendAppointmentConfirmation(patient.email, appointment);
    }
    
    if (patient.preferences?.notifications?.sms && patient.phoneNumber) {
      await smsService.sendAppointmentConfirmation(patient.phoneNumber, appointment);
    }
  }

  // Send reminder notification
  async sendReminderNotification(appointment) {
    const patient = appointment.patientId;
    
    const message = `Reminder: You have a dental appointment tomorrow at ${format(appointment.dateTime, 'h:mm a')}. Reply CONFIRM to confirm or CANCEL to cancel.`;
    
    if (patient.preferences?.notifications?.email) {
      await emailService.sendReminder(patient.email, message, appointment);
    }
    
    if (patient.preferences?.notifications?.sms && patient.phoneNumber) {
      await smsService.sendReminder(patient.phoneNumber, message);
    }
  }

  // Send recall notification
  async sendRecallNotification(patient, suggestedDate) {
    const message = `It's time for your dental checkup! It's been over 6 months since your last visit. Would you like to schedule an appointment for ${format(suggestedDate, 'MMMM d, yyyy')}?`;
    
    if (patient.preferences?.notifications?.email) {
      await emailService.sendRecallNotice(patient.email, message, suggestedDate);
    }
    
    if (patient.preferences?.notifications?.sms && patient.phoneNumber) {
      await smsService.sendRecallNotice(patient.phoneNumber, message);
    }
  }

  // Get recurring rules for a patient
  async getPatientRecurringRules(patientId) {
    const rules = Array.from(this.appointmentRules.values()).filter(
      r => r.patientId === patientId && r.active
    );
    
    return rules.map(rule => ({
      id: rule.id,
      pattern: rule.pattern,
      frequency: rule.frequency,
      nextAppointment: this.getNextDate(new Date(), rule.pattern, rule.frequency),
      appointmentType: rule.appointmentType,
      dentistId: rule.dentistId,
      timeSlot: rule.timeSlot,
      autoConfirm: rule.autoConfirm
    }));
  }

  // Save rule to database (placeholder)
  async saveRuleToDatabase(rule) {
    // In production, this would save to MongoDB
    logger.info(`Saving rule ${rule.id} to database`);
    return true;
  }

  // Load rules from database on startup
  async loadRulesFromDatabase() {
    // In production, this would load from MongoDB
    logger.info('Loading recurring rules from database');
    return [];
  }
}

// Create singleton instance
const recurringAppointmentService = new RecurringAppointmentService();

// Load existing rules on startup
recurringAppointmentService.loadRulesFromDatabase().catch(error => {
  logger.error('Error loading recurring rules:', error);
});

export default recurringAppointmentService;