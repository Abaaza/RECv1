import nodemailer from 'nodemailer';
import { logger } from '../utils/logger.js';

// Create transporter only if credentials are provided
const transporter = process.env.SMTP_USER && process.env.SMTP_PASS
  ? nodemailer.createTransporter({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: process.env.SMTP_PORT || 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    })
  : null;

const emailTemplates = {
  appointmentReminder: (data) => ({
    subject: 'Appointment Reminder',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Appointment Reminder</h2>
        <p>Dear ${data.patientName},</p>
        <p>This is a reminder about your upcoming dental appointment:</p>
        <div style="background-color: #f3f4f6; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p><strong>Date:</strong> ${data.date}</p>
          <p><strong>Time:</strong> ${data.time}</p>
          <p><strong>Doctor:</strong> ${data.dentistName}</p>
          <p><strong>Type:</strong> ${data.type}</p>
        </div>
        <p>Please arrive 10 minutes early to complete any necessary paperwork.</p>
        <p>If you need to reschedule, please call us at (555) 123-4567.</p>
        <p>Best regards,<br>SmileCare Dental Clinic</p>
      </div>
    `
  }),

  appointmentConfirmation: (data) => ({
    subject: 'Appointment Confirmation',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Appointment Confirmed</h2>
        <p>Dear ${data.patientName},</p>
        <p>Your appointment has been successfully scheduled:</p>
        <div style="background-color: #f3f4f6; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p><strong>Date:</strong> ${data.date}</p>
          <p><strong>Time:</strong> ${data.time}</p>
          <p><strong>Doctor:</strong> ${data.dentistName}</p>
          <p><strong>Type:</strong> ${data.type}</p>
        </div>
        <p>We'll send you a reminder 24 hours before your appointment.</p>
        <p>Thank you for choosing SmileCare Dental Clinic!</p>
      </div>
    `
  }),

  appointmentCancellation: (data) => ({
    subject: 'Appointment Cancelled',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #dc2626;">Appointment Cancelled</h2>
        <p>Dear ${data.patientName},</p>
        <p>Your appointment on ${data.date} at ${data.time} has been cancelled.</p>
        <p>If you'd like to reschedule, please call us at (555) 123-4567 or book online.</p>
        <p>Best regards,<br>SmileCare Dental Clinic</p>
      </div>
    `
  }),

  welcomeEmail: (data) => ({
    subject: 'Welcome to SmileCare Dental Clinic',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Welcome to SmileCare!</h2>
        <p>Dear ${data.patientName},</p>
        <p>Thank you for registering with SmileCare Dental Clinic. We're excited to help you maintain a healthy, beautiful smile!</p>
        <h3>What's Next?</h3>
        <ul>
          <li>Schedule your first appointment online or by calling (555) 123-4567</li>
          <li>Complete your medical history form in the patient portal</li>
          <li>Review our patient resources and dental care tips</li>
        </ul>
        <p>If you have any questions, our team is here to help!</p>
        <p>Best regards,<br>The SmileCare Team</p>
      </div>
    `
  }),

  followUp: (data) => ({
    subject: 'How was your recent visit?',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">We'd Love Your Feedback</h2>
        <p>Dear ${data.patientName},</p>
        <p>Thank you for visiting SmileCare Dental Clinic on ${data.appointmentDate}.</p>
        <p>We hope you had a positive experience with ${data.dentistName}. Your feedback helps us improve our services.</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="#" style="background-color: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px;">Rate Your Visit</a>
        </div>
        <p>Thank you for choosing SmileCare!</p>
        <p>Best regards,<br>The SmileCare Team</p>
      </div>
    `
  }),

  monthlyReport: (data) => ({
    subject: `Monthly Report - ${data.month}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Monthly Report - ${data.month}</h2>
        <h3>Appointment Summary</h3>
        <ul>
          ${data.appointments.map(a => `<li>${a._id}: ${a.count} appointments</li>`).join('')}
        </ul>
        <h3>Key Metrics</h3>
        <div style="background-color: #f3f4f6; padding: 15px; border-radius: 5px;">
          <p><strong>New Patients:</strong> ${data.newPatients}</p>
          <p><strong>Total Revenue:</strong> $${data.revenue.toFixed(2)}</p>
        </div>
        <p>Full analytics available in the admin dashboard.</p>
        <p>Best regards,<br>SmileCare Dental System</p>
      </div>
    `
  }),

  test: (data) => ({
    subject: 'Test Email',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Test Email</h2>
        <p>${data.message}</p>
        <p>This is a test email from the SmileCare Dental AI System.</p>
      </div>
    `
  })
};

export const sendEmail = async ({ to, subject, template, data }) => {
  try {
    // If no transporter configured, just log the email
    if (!transporter) {
      logger.info('📧 Email (Mock Mode):', {
        to,
        subject: template ? emailTemplates[template](data).subject : subject,
        template,
        data
      });
      return { messageId: `mock-${Date.now()}`, accepted: [to] };
    }
    
    const templateFunc = emailTemplates[template];
    
    if (!templateFunc) {
      throw new Error(`Email template '${template}' not found`);
    }

    const emailContent = templateFunc(data);

    const mailOptions = {
      from: process.env.SMTP_FROM || '"SmileCare Dental" <noreply@smilecare.com>',
      to,
      subject: emailContent.subject || subject,
      html: emailContent.html
    };

    const info = await transporter.sendMail(mailOptions);
    
    logger.info(`Email sent to ${to}: ${info.messageId}`);
    
    return info;
  } catch (error) {
    logger.error(`Failed to send email to ${to}:`, error);
    throw error;
  }
};

export const verifyEmailConfiguration = async () => {
  try {
    if (!transporter) {
      logger.info('Email service running in mock mode (no credentials provided)');
      return true;
    }
    await transporter.verify();
    logger.info('Email configuration verified successfully');
    return true;
  } catch (error) {
    logger.error('Email configuration verification failed:', error);
    return false;
  }
};

export default { sendEmail, verifyEmailConfiguration };