import cron from 'node-cron';
import Appointment from '../models/Appointment.js';
import Patient from '../models/Patient.js';
import twilio from 'twilio';
import nodemailer from 'nodemailer';
import { format, addDays, isTomorrow, isToday, differenceInHours } from 'date-fns';
import { logger } from '../utils/logger.js';

class ReminderService {
  constructor() {
    this.twilioClient = null;
    this.emailTransporter = null;
    this.reminders = new Map();
    this.initializeServices();
    this.startScheduledReminders();
  }

  initializeServices() {
    // Initialize Twilio for SMS
    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
      this.twilioClient = twilio(
        process.env.TWILIO_ACCOUNT_SID,
        process.env.TWILIO_AUTH_TOKEN
      );
      logger.info('Twilio SMS service initialized');
    }

    // Initialize email transporter
    if (process.env.SMTP_HOST) {
      this.emailTransporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT || 587,
        secure: false,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      });
      logger.info('Email service initialized');
    }
  }

  startScheduledReminders() {
    // Check for reminders every 15 minutes
    cron.schedule('*/15 * * * *', () => {
      this.processScheduledReminders();
    });

    // Send daily morning reminders at 9 AM
    cron.schedule('0 9 * * *', () => {
      this.sendDayOfReminders();
    });

    // Send next-day reminders at 6 PM
    cron.schedule('0 18 * * *', () => {
      this.sendNextDayReminders();
    });

    // Send weekly follow-ups on Monday at 10 AM
    cron.schedule('0 10 * * 1', () => {
      this.sendWeeklyFollowUps();
    });

    logger.info('Reminder schedules initialized');
  }

  async processScheduledReminders() {
    try {
      const now = new Date();
      const upcoming = await Appointment.find({
        status: 'scheduled',
        reminderSent: { $ne: true },
        startTime: {
          $gte: now,
          $lte: addDays(now, 2)
        }
      }).populate('patientId');

      for (const appointment of upcoming) {
        const hoursUntil = differenceInHours(new Date(appointment.startTime), now);
        
        // Send reminders based on time until appointment
        if (hoursUntil <= 48 && !appointment.reminder48h) {
          await this.send48HourReminder(appointment);
        }
        if (hoursUntil <= 24 && !appointment.reminder24h) {
          await this.send24HourReminder(appointment);
        }
        if (hoursUntil <= 2 && !appointment.reminder2h) {
          await this.send2HourReminder(appointment);
        }
      }
    } catch (error) {
      logger.error('Error processing scheduled reminders:', error);
    }
  }

  async send48HourReminder(appointment) {
    const patient = appointment.patientId;
    const message = this.generateReminderMessage(appointment, '48 hours');

    const sent = await this.sendReminder(patient, message, appointment);
    
    if (sent) {
      appointment.reminder48h = true;
      await appointment.save();
      logger.info(`48-hour reminder sent for appointment ${appointment._id}`);
    }
  }

  async send24HourReminder(appointment) {
    const patient = appointment.patientId;
    const message = this.generateReminderMessage(appointment, '24 hours');

    const sent = await this.sendReminder(patient, message, appointment);
    
    if (sent) {
      appointment.reminder24h = true;
      await appointment.save();
      logger.info(`24-hour reminder sent for appointment ${appointment._id}`);
    }
  }

  async send2HourReminder(appointment) {
    const patient = appointment.patientId;
    const message = this.generateReminderMessage(appointment, '2 hours');

    const sent = await this.sendReminder(patient, message, appointment);
    
    if (sent) {
      appointment.reminder2h = true;
      appointment.reminderSent = true;
      await appointment.save();
      logger.info(`2-hour reminder sent for appointment ${appointment._id}`);
    }
  }

  async sendDayOfReminders() {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = addDays(today, 1);

      const todayAppointments = await Appointment.find({
        status: 'scheduled',
        startTime: {
          $gte: today,
          $lt: tomorrow
        }
      }).populate('patientId');

      for (const appointment of todayAppointments) {
        const message = this.generateDayOfMessage(appointment);
        await this.sendReminder(appointment.patientId, message, appointment);
      }

      logger.info(`Sent ${todayAppointments.length} day-of reminders`);
    } catch (error) {
      logger.error('Error sending day-of reminders:', error);
    }
  }

  async sendNextDayReminders() {
    try {
      const tomorrow = addDays(new Date(), 1);
      tomorrow.setHours(0, 0, 0, 0);
      const dayAfter = addDays(tomorrow, 1);

      const tomorrowAppointments = await Appointment.find({
        status: 'scheduled',
        startTime: {
          $gte: tomorrow,
          $lt: dayAfter
        }
      }).populate('patientId');

      for (const appointment of tomorrowAppointments) {
        const message = this.generateNextDayMessage(appointment);
        await this.sendReminder(appointment.patientId, message, appointment);
      }

      logger.info(`Sent ${tomorrowAppointments.length} next-day reminders`);
    } catch (error) {
      logger.error('Error sending next-day reminders:', error);
    }
  }

  async sendWeeklyFollowUps() {
    try {
      const oneWeekAgo = addDays(new Date(), -7);
      const twoWeeksAgo = addDays(new Date(), -14);

      // Find completed appointments from last week
      const completedAppointments = await Appointment.find({
        status: 'completed',
        endTime: {
          $gte: twoWeeksAgo,
          $lt: oneWeekAgo
        },
        followUpSent: { $ne: true }
      }).populate('patientId');

      for (const appointment of completedAppointments) {
        await this.sendFollowUpMessage(appointment);
        appointment.followUpSent = true;
        await appointment.save();
      }

      logger.info(`Sent ${completedAppointments.length} follow-up messages`);
    } catch (error) {
      logger.error('Error sending follow-ups:', error);
    }
  }

  generateReminderMessage(appointment, timeframe) {
    const appointmentTime = format(new Date(appointment.startTime), 'EEEE, MMMM d at h:mm a');
    
    return {
      subject: `Appointment Reminder - ${timeframe}`,
      text: `Hi ${appointment.patientId.firstName},\n\nThis is a reminder that you have an appointment scheduled for ${appointmentTime}.\n\nAppointment Type: ${appointment.type}\nDuration: ${appointment.duration} minutes\n\nPlease arrive 10 minutes early to complete any necessary paperwork.\n\nTo confirm, reply 'YES'. To reschedule, reply 'RESCHEDULE' or call us at ${process.env.CLINIC_PHONE}.\n\nThank you,\n${process.env.CLINIC_NAME}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">Appointment Reminder</h2>
          <p>Hi ${appointment.patientId.firstName},</p>
          <p>This is a reminder that you have an appointment scheduled in <strong>${timeframe}</strong>.</p>
          <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 5px 0;"><strong>Date & Time:</strong> ${appointmentTime}</p>
            <p style="margin: 5px 0;"><strong>Type:</strong> ${appointment.type}</p>
            <p style="margin: 5px 0;"><strong>Duration:</strong> ${appointment.duration} minutes</p>
          </div>
          <p>Please arrive 10 minutes early to complete any necessary paperwork.</p>
          <div style="margin: 20px 0;">
            <a href="${process.env.PORTAL_URL}/confirm/${appointment._id}" style="background: #10b981; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Confirm Appointment</a>
            <a href="${process.env.PORTAL_URL}/reschedule/${appointment._id}" style="background: #f59e0b; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block; margin-left: 10px;">Reschedule</a>
          </div>
          <p>Thank you,<br>${process.env.CLINIC_NAME}</p>
        </div>
      `
    };
  }

  generateDayOfMessage(appointment) {
    const appointmentTime = format(new Date(appointment.startTime), 'h:mm a');
    
    return {
      subject: `Today's Appointment at ${appointmentTime}`,
      text: `Good morning ${appointment.patientId.firstName}!\n\nThis is a reminder that you have an appointment today at ${appointmentTime}.\n\nWe look forward to seeing you!\n\n${process.env.CLINIC_NAME}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">Today's Appointment</h2>
          <p>Good morning ${appointment.patientId.firstName}!</p>
          <p>This is a reminder that you have an appointment <strong>today at ${appointmentTime}</strong>.</p>
          <p>We look forward to seeing you!</p>
          <p>Best regards,<br>${process.env.CLINIC_NAME}</p>
        </div>
      `
    };
  }

  generateNextDayMessage(appointment) {
    const appointmentTime = format(new Date(appointment.startTime), 'h:mm a');
    
    return {
      subject: `Tomorrow's Appointment at ${appointmentTime}`,
      text: `Hi ${appointment.patientId.firstName},\n\nJust a reminder that you have an appointment tomorrow at ${appointmentTime}.\n\nPlease remember to:\n- Bring your insurance card\n- Arrive 10 minutes early\n- Bring a list of current medications\n\nSee you tomorrow!\n\n${process.env.CLINIC_NAME}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">Tomorrow's Appointment</h2>
          <p>Hi ${appointment.patientId.firstName},</p>
          <p>Just a reminder that you have an appointment <strong>tomorrow at ${appointmentTime}</strong>.</p>
          <h3>Please remember to:</h3>
          <ul>
            <li>Bring your insurance card</li>
            <li>Arrive 10 minutes early</li>
            <li>Bring a list of current medications</li>
          </ul>
          <p>See you tomorrow!</p>
          <p>Best regards,<br>${process.env.CLINIC_NAME}</p>
        </div>
      `
    };
  }

  async sendFollowUpMessage(appointment) {
    const message = {
      subject: 'How was your recent visit?',
      text: `Hi ${appointment.patientId.firstName},\n\nWe hope you're doing well after your recent visit. We'd love to hear about your experience!\n\nIf you have any questions or concerns, please don't hesitate to reach out.\n\nYou can leave a review at: ${process.env.REVIEW_URL}\n\nThank you for choosing ${process.env.CLINIC_NAME}!`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">How was your recent visit?</h2>
          <p>Hi ${appointment.patientId.firstName},</p>
          <p>We hope you're doing well after your recent visit on ${format(new Date(appointment.startTime), 'MMMM d')}.</p>
          <p>We'd love to hear about your experience!</p>
          <div style="margin: 20px 0;">
            <a href="${process.env.REVIEW_URL}" style="background: #2563eb; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Leave a Review</a>
          </div>
          <p>If you have any questions or concerns, please don't hesitate to reach out.</p>
          <p>Thank you for choosing ${process.env.CLINIC_NAME}!</p>
        </div>
      `
    };

    return this.sendReminder(appointment.patientId, message, appointment);
  }

  async sendReminder(patient, message, appointment) {
    const results = {
      sms: false,
      email: false
    };

    // Send SMS if available
    if (patient.phone && patient.preferences?.smsReminders !== false && this.twilioClient) {
      try {
        await this.twilioClient.messages.create({
          body: message.text,
          from: process.env.TWILIO_PHONE_NUMBER,
          to: patient.phone
        });
        results.sms = true;
        logger.info(`SMS reminder sent to ${patient.phone}`);
      } catch (error) {
        logger.error('Failed to send SMS reminder:', error);
      }
    }

    // Send email if available
    if (patient.email && patient.preferences?.emailReminders !== false && this.emailTransporter) {
      try {
        await this.emailTransporter.sendMail({
          from: process.env.SMTP_FROM || 'noreply@dentalclinic.com',
          to: patient.email,
          subject: message.subject,
          text: message.text,
          html: message.html
        });
        results.email = true;
        logger.info(`Email reminder sent to ${patient.email}`);
      } catch (error) {
        logger.error('Failed to send email reminder:', error);
      }
    }

    // Log reminder in database
    await this.logReminder(appointment._id, patient._id, results);

    return results.sms || results.email;
  }

  async logReminder(appointmentId, patientId, results) {
    try {
      // You could create a ReminderLog model to track all reminders
      logger.info(`Reminder logged - Appointment: ${appointmentId}, SMS: ${results.sms}, Email: ${results.email}`);
    } catch (error) {
      logger.error('Failed to log reminder:', error);
    }
  }

  async sendCustomReminder(appointmentId, message) {
    try {
      const appointment = await Appointment.findById(appointmentId).populate('patientId');
      if (!appointment) {
        throw new Error('Appointment not found');
      }

      return await this.sendReminder(appointment.patientId, message, appointment);
    } catch (error) {
      logger.error('Failed to send custom reminder:', error);
      throw error;
    }
  }

  async updateReminderPreferences(patientId, preferences) {
    try {
      const patient = await Patient.findById(patientId);
      if (!patient) {
        throw new Error('Patient not found');
      }

      patient.preferences = {
        ...patient.preferences,
        ...preferences
      };

      await patient.save();
      return patient.preferences;
    } catch (error) {
      logger.error('Failed to update reminder preferences:', error);
      throw error;
    }
  }
}

export default new ReminderService();