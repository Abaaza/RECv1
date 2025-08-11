import nodemailer from 'nodemailer';
import twilio from 'twilio';
import { logger } from '../utils/logger.js';

class NotificationService {
  constructor() {
    // Email configuration
    this.emailTransporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST || 'smtp.gmail.com',
      port: process.env.EMAIL_PORT || 587,
      secure: false,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    // Twilio configuration
    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
      this.twilioClient = twilio(
        process.env.TWILIO_ACCOUNT_SID,
        process.env.TWILIO_AUTH_TOKEN
      );
      this.twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;
    }
  }

  async sendEmail(to, subject, html, text) {
    try {
      const mailOptions = {
        from: process.env.EMAIL_USER,
        to,
        subject,
        html,
        text: text || html.replace(/<[^>]*>/g, '')
      };

      const info = await this.emailTransporter.sendMail(mailOptions);
      logger.info('Email sent successfully', { to, subject, messageId: info.messageId });
      return info;
    } catch (error) {
      logger.error('Error sending email', { error: error.message, to, subject });
      throw error;
    }
  }

  async sendSMS(to, message) {
    if (!this.twilioClient) {
      logger.warn('Twilio not configured, SMS not sent');
      return null;
    }

    try {
      const result = await this.twilioClient.messages.create({
        body: message,
        from: this.twilioPhoneNumber,
        to
      });
      logger.info('SMS sent successfully', { to, sid: result.sid });
      return result;
    } catch (error) {
      logger.error('Error sending SMS', { error: error.message, to });
      throw error;
    }
  }

  async sendAppointmentConfirmation(appointment, patient) {
    const subject = 'Appointment Confirmation - Dental AI Clinic';
    const html = `
      <h2>Appointment Confirmed</h2>
      <p>Dear ${patient.firstName},</p>
      <p>Your appointment has been confirmed for:</p>
      <p><strong>Date:</strong> ${new Date(appointment.dateTime).toLocaleDateString()}</p>
      <p><strong>Time:</strong> ${new Date(appointment.dateTime).toLocaleTimeString()}</p>
      <p><strong>Type:</strong> ${appointment.type}</p>
      <p>Please arrive 10 minutes early to complete any necessary paperwork.</p>
      <p>If you need to reschedule, please call us at (555) 123-4567.</p>
      <p>Best regards,<br>Dental AI Clinic</p>
    `;

    if (patient.email) {
      await this.sendEmail(patient.email, subject, html);
    }

    if (patient.phoneNumber && this.twilioClient) {
      const smsMessage = `Appointment confirmed for ${new Date(appointment.dateTime).toLocaleDateString()} at ${new Date(appointment.dateTime).toLocaleTimeString()}. Reply CANCEL to cancel.`;
      await this.sendSMS(patient.phoneNumber, smsMessage);
    }
  }

  async sendAppointmentReminder(appointment, patient) {
    const subject = 'Appointment Reminder - Dental AI Clinic';
    const html = `
      <h2>Appointment Reminder</h2>
      <p>Dear ${patient.firstName},</p>
      <p>This is a reminder about your upcoming appointment:</p>
      <p><strong>Date:</strong> ${new Date(appointment.dateTime).toLocaleDateString()}</p>
      <p><strong>Time:</strong> ${new Date(appointment.dateTime).toLocaleTimeString()}</p>
      <p><strong>Type:</strong> ${appointment.type}</p>
      <p>If you need to reschedule, please call us at (555) 123-4567.</p>
      <p>Best regards,<br>Dental AI Clinic</p>
    `;

    if (patient.email) {
      await this.sendEmail(patient.email, subject, html);
    }

    if (patient.phoneNumber && this.twilioClient) {
      const smsMessage = `Reminder: You have an appointment tomorrow at ${new Date(appointment.dateTime).toLocaleTimeString()}. Reply CONFIRM to confirm or CANCEL to cancel.`;
      await this.sendSMS(patient.phoneNumber, smsMessage);
    }
  }

  async sendCancellationNotification(appointment, patient) {
    const subject = 'Appointment Cancelled - Dental AI Clinic';
    const html = `
      <h2>Appointment Cancelled</h2>
      <p>Dear ${patient.firstName},</p>
      <p>Your appointment scheduled for ${new Date(appointment.dateTime).toLocaleDateString()} at ${new Date(appointment.dateTime).toLocaleTimeString()} has been cancelled.</p>
      <p>If you would like to reschedule, please call us at (555) 123-4567 or book online.</p>
      <p>Best regards,<br>Dental AI Clinic</p>
    `;

    if (patient.email) {
      await this.sendEmail(patient.email, subject, html);
    }
  }
}

const notificationService = new NotificationService();

// Export both the service and individual methods
export default notificationService;
export const sendAppointmentReminder = (appointment, patient) => 
  notificationService.sendAppointmentReminder(appointment, patient);
export const sendAppointmentConfirmation = (appointment, patient) => 
  notificationService.sendAppointmentConfirmation(appointment, patient);
export const sendCancellationNotification = (appointment, patient) => 
  notificationService.sendCancellationNotification(appointment, patient);