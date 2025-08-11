import express from 'express';
import { body, validationResult } from 'express-validator';
import Appointment from '../models/Appointment.js';
import User from '../models/User.js';
import { sendEmail } from '../services/emailService.js';
import { sendSMS } from '../services/smsService.js';
import { authorizeRoles } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

router.post('/appointment-reminder', [
  authorizeRoles('admin', 'receptionist'),
  body('appointmentId').notEmpty(),
  body('method').isIn(['email', 'sms', 'both'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { appointmentId, method } = req.body;

    const appointment = await Appointment.findById(appointmentId)
      .populate('patientId', 'email profile preferences')
      .populate('dentistId', 'profile');

    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    const patient = appointment.patientId;
    const dentist = appointment.dentistId;
    
    const reminderData = {
      patientName: `${patient.profile.firstName} ${patient.profile.lastName}`,
      dentistName: `Dr. ${dentist.profile.lastName}`,
      date: appointment.date.toLocaleDateString(),
      time: appointment.startTime,
      type: appointment.type
    };

    const results = { email: false, sms: false };

    if (method === 'email' || method === 'both') {
      try {
        await sendEmail({
          to: patient.email,
          subject: 'Appointment Reminder',
          template: 'appointmentReminder',
          data: reminderData
        });
        results.email = true;
      } catch (error) {
        logger.error('Email reminder failed:', error);
      }
    }

    if (method === 'sms' || method === 'both') {
      try {
        await sendSMS({
          to: patient.profile.phone,
          message: `Reminder: You have a dental appointment with ${reminderData.dentistName} on ${reminderData.date} at ${reminderData.time}`
        });
        results.sms = true;
      } catch (error) {
        logger.error('SMS reminder failed:', error);
      }
    }

    appointment.reminders.push({
      type: method,
      scheduledFor: new Date(),
      sent: true,
      sentAt: new Date()
    });

    await appointment.save();

    logger.info(`Reminder sent for appointment ${appointmentId}`);

    res.json({ 
      message: 'Reminder sent successfully',
      results 
    });
  } catch (error) {
    logger.error('Error sending reminder:', error);
    res.status(500).json({ error: 'Failed to send reminder' });
  }
});

router.post('/bulk-reminders', [
  authorizeRoles('admin', 'receptionist'),
  body('days').isInt({ min: 1, max: 7 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { days } = req.body;
    
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + days);
    targetDate.setHours(0, 0, 0, 0);
    
    const endDate = new Date(targetDate);
    endDate.setHours(23, 59, 59, 999);

    const appointments = await Appointment.find({
      date: { $gte: targetDate, $lte: endDate },
      status: 'scheduled',
      'reminders.scheduledFor': { $ne: targetDate }
    })
    .populate('patientId', 'email profile preferences')
    .populate('dentistId', 'profile');

    let sent = 0;
    let failed = 0;

    for (const appointment of appointments) {
      try {
        const patient = appointment.patientId;
        const method = patient.preferences.notificationMethod;
        
        if (method === 'email' || method === 'both') {
          await sendEmail({
            to: patient.email,
            subject: 'Upcoming Appointment Reminder',
            template: 'appointmentReminder',
            data: {
              patientName: `${patient.profile.firstName} ${patient.profile.lastName}`,
              dentistName: `Dr. ${appointment.dentistId.profile.lastName}`,
              date: appointment.date.toLocaleDateString(),
              time: appointment.startTime,
              type: appointment.type
            }
          });
        }

        if (method === 'sms' || method === 'both') {
          await sendSMS({
            to: patient.profile.phone,
            message: `Reminder: Dental appointment on ${appointment.date.toLocaleDateString()} at ${appointment.startTime}`
          });
        }

        appointment.reminders.push({
          type: method,
          scheduledFor: targetDate,
          sent: true,
          sentAt: new Date()
        });

        await appointment.save();
        sent++;
      } catch (error) {
        logger.error(`Failed to send reminder for appointment ${appointment._id}:`, error);
        failed++;
      }
    }

    logger.info(`Bulk reminders: ${sent} sent, ${failed} failed`);

    res.json({
      message: 'Bulk reminders processed',
      sent,
      failed,
      total: appointments.length
    });
  } catch (error) {
    logger.error('Error sending bulk reminders:', error);
    res.status(500).json({ error: 'Failed to send bulk reminders' });
  }
});

router.get('/templates', authorizeRoles('admin', 'receptionist'), async (req, res) => {
  try {
    const templates = [
      {
        id: 'appointmentReminder',
        name: 'Appointment Reminder',
        type: 'email',
        variables: ['patientName', 'dentistName', 'date', 'time', 'type']
      },
      {
        id: 'appointmentConfirmation',
        name: 'Appointment Confirmation',
        type: 'email',
        variables: ['patientName', 'dentistName', 'date', 'time', 'type']
      },
      {
        id: 'appointmentCancellation',
        name: 'Appointment Cancellation',
        type: 'email',
        variables: ['patientName', 'date', 'time']
      },
      {
        id: 'welcomeEmail',
        name: 'Welcome Email',
        type: 'email',
        variables: ['patientName']
      },
      {
        id: 'smsReminder',
        name: 'SMS Reminder',
        type: 'sms',
        variables: ['date', 'time']
      }
    ];

    res.json({ templates });
  } catch (error) {
    logger.error('Error fetching templates:', error);
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
});

router.post('/test', [
  authorizeRoles('admin'),
  body('type').isIn(['email', 'sms']),
  body('to').notEmpty()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { type, to } = req.body;

    if (type === 'email') {
      await sendEmail({
        to,
        subject: 'Test Email - Dental AI System',
        template: 'test',
        data: {
          message: 'This is a test email from the Dental AI System'
        }
      });
    } else {
      await sendSMS({
        to,
        message: 'Test SMS from Dental AI System'
      });
    }

    logger.info(`Test ${type} sent to ${to}`);

    res.json({ message: `Test ${type} sent successfully` });
  } catch (error) {
    logger.error('Error sending test notification:', error);
    res.status(500).json({ error: 'Failed to send test notification' });
  }
});

export default router;