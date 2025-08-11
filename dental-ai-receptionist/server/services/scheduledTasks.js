import cron from 'node-cron';
import Appointment from '../models/Appointment.js';
import User from '../models/User.js';
import { sendEmail } from './emailService.js';
import { sendSMS } from './smsService.js';
import { logger } from '../utils/logger.js';

export const initScheduledTasks = () => {
  
  cron.schedule('0 9 * * *', async () => {
    logger.info('Running daily appointment reminders task');
    await sendDailyReminders();
  });

  cron.schedule('0 10 * * 1', async () => {
    logger.info('Running weekly follow-up task');
    await sendWeeklyFollowUps();
  });

  cron.schedule('0 0 1 * *', async () => {
    logger.info('Running monthly report generation');
    await generateMonthlyReports();
  });

  cron.schedule('*/15 * * * *', async () => {
    await updateAppointmentStatuses();
  });

  logger.info('Scheduled tasks initialized');
};

async function sendDailyReminders() {
  try {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    
    const dayAfter = new Date(tomorrow);
    dayAfter.setDate(dayAfter.getDate() + 1);

    const appointments = await Appointment.find({
      date: { $gte: tomorrow, $lt: dayAfter },
      status: 'scheduled',
      'reminders.sentAt': { 
        $not: { 
          $gte: new Date(new Date().setHours(0, 0, 0, 0)) 
        } 
      }
    })
    .populate('patientId', 'email profile preferences')
    .populate('dentistId', 'profile');

    for (const appointment of appointments) {
      try {
        const patient = appointment.patientId;
        const method = patient.preferences.notificationMethod;
        
        const reminderData = {
          patientName: `${patient.profile.firstName} ${patient.profile.lastName}`,
          dentistName: `Dr. ${appointment.dentistId.profile.lastName}`,
          date: appointment.date.toLocaleDateString(),
          time: appointment.startTime,
          type: appointment.type
        };

        if (method === 'email' || method === 'both') {
          await sendEmail({
            to: patient.email,
            subject: 'Appointment Reminder - Tomorrow',
            template: 'appointmentReminder',
            data: reminderData
          });
        }

        if (method === 'sms' || method === 'both') {
          await sendSMS({
            to: patient.profile.phone,
            message: `Reminder: Dental appointment tomorrow at ${appointment.startTime} with Dr. ${appointment.dentistId.profile.lastName}`
          });
        }

        appointment.reminders.push({
          type: method,
          scheduledFor: new Date(),
          sent: true,
          sentAt: new Date()
        });

        await appointment.save();
        
        logger.info(`Reminder sent for appointment ${appointment._id}`);
      } catch (error) {
        logger.error(`Failed to send reminder for appointment ${appointment._id}:`, error);
      }
    }
  } catch (error) {
    logger.error('Error in daily reminders task:', error);
  }
}

async function sendWeeklyFollowUps() {
  try {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    oneWeekAgo.setHours(0, 0, 0, 0);
    
    const eightDaysAgo = new Date();
    eightDaysAgo.setDate(eightDaysAgo.getDate() - 8);

    const appointments = await Appointment.find({
      date: { $gte: eightDaysAgo, $lt: oneWeekAgo },
      status: 'completed',
      'rating.score': { $exists: false }
    })
    .populate('patientId', 'email profile')
    .populate('dentistId', 'profile');

    for (const appointment of appointments) {
      try {
        const patient = appointment.patientId;
        
        await sendEmail({
          to: patient.email,
          subject: 'How was your recent dental visit?',
          template: 'followUp',
          data: {
            patientName: `${patient.profile.firstName} ${patient.profile.lastName}`,
            appointmentDate: appointment.date.toLocaleDateString(),
            dentistName: `Dr. ${appointment.dentistId.profile.lastName}`
          }
        });
        
        logger.info(`Follow-up sent for appointment ${appointment._id}`);
      } catch (error) {
        logger.error(`Failed to send follow-up for appointment ${appointment._id}:`, error);
      }
    }
  } catch (error) {
    logger.error('Error in weekly follow-up task:', error);
  }
}

async function generateMonthlyReports() {
  try {
    const lastMonth = new Date();
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    lastMonth.setDate(1);
    lastMonth.setHours(0, 0, 0, 0);
    
    const thisMonth = new Date();
    thisMonth.setDate(1);
    thisMonth.setHours(0, 0, 0, 0);

    const [appointments, newPatients, revenue] = await Promise.all([
      Appointment.aggregate([
        {
          $match: {
            date: { $gte: lastMonth, $lt: thisMonth }
          }
        },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]),
      User.countDocuments({
        role: 'patient',
        createdAt: { $gte: lastMonth, $lt: thisMonth }
      }),
      Appointment.aggregate([
        {
          $match: {
            date: { $gte: lastMonth, $lt: thisMonth },
            status: 'completed',
            'billing.paid': true
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$billing.totalCost' }
          }
        }
      ])
    ]);

    const report = {
      month: lastMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      appointments,
      newPatients,
      revenue: revenue[0]?.total || 0
    };

    const admins = await User.find({ role: 'admin', isActive: true });
    
    for (const admin of admins) {
      await sendEmail({
        to: admin.email,
        subject: `Monthly Report - ${report.month}`,
        template: 'monthlyReport',
        data: report
      });
    }

    logger.info('Monthly reports generated and sent');
  } catch (error) {
    logger.error('Error generating monthly reports:', error);
  }
}

async function updateAppointmentStatuses() {
  try {
    const now = new Date();
    
    await Appointment.updateMany(
      {
        date: { $lt: now },
        endTime: { $lt: now.toTimeString().slice(0, 5) },
        status: 'scheduled'
      },
      {
        $set: { 
          status: 'no-show',
          updatedAt: now
        }
      }
    );

    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    
    await Appointment.updateMany(
      {
        date: { $lte: now },
        startTime: { $lte: twoHoursAgo.toTimeString().slice(0, 5) },
        status: 'in-progress'
      },
      {
        $set: { 
          status: 'completed',
          updatedAt: now
        }
      }
    );
  } catch (error) {
    logger.error('Error updating appointment statuses:', error);
  }
}

export default { initScheduledTasks };