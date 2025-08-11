import cron from 'node-cron';
import moment from 'moment-timezone';
import Patient from '../models/Patient.js';
import Appointment from '../models/Appointment.js';
import TreatmentPlan from '../models/TreatmentPlan.js';
import { sendEmail } from './emailService.js';
import { sendSMS } from './smsService.js';
import { logger } from '../utils/logger.js';

class AutomatedFollowUpService {
  constructor() {
    this.tasks = new Map();
    this.templates = {
      appointment_reminder: {
        email: {
          subject: 'Appointment Reminder - SmileCare Dental',
          body: `Dear {patientName},

This is a friendly reminder of your upcoming appointment:

Date: {appointmentDate}
Time: {appointmentTime}
Procedure: {procedureType}
Doctor: Dr. {dentistName}

Please arrive 10 minutes early to complete any necessary paperwork.

If you need to reschedule, please call us at (555) 123-4567 or reply to this email.

Best regards,
SmileCare Dental Team`
        },
        sms: `Hi {patientName}! Reminder: Dental appointment on {appointmentDate} at {appointmentTime} with Dr. {dentistName}. Reply CONFIRM to confirm or CANCEL to cancel.`
      },
      recall_reminder: {
        email: {
          subject: 'Time for Your Regular Dental Checkup!',
          body: `Dear {patientName},

It's been {monthsSinceLastVisit} months since your last dental visit. Regular checkups are important for maintaining good oral health!

We recommend scheduling your next cleaning and examination. 

Available times this week:
{availableSlots}

Click here to book online: {bookingLink}
Or call us at (555) 123-4567

We look forward to seeing you soon!

Best regards,
SmileCare Dental Team`
        },
        sms: `Hi {patientName}! It's time for your dental checkup. It's been {monthsSinceLastVisit} months since your last visit. Call (555) 123-4567 to schedule!`
      },
      treatment_followup: {
        email: {
          subject: 'How are you feeling after your recent procedure?',
          body: `Dear {patientName},

We hope you're recovering well from your {procedureName} on {procedureDate}.

A few reminders for your recovery:
{postOpInstructions}

If you're experiencing any of the following, please contact us immediately:
- Severe pain not relieved by medication
- Excessive bleeding
- Signs of infection (fever, swelling, discharge)
- Any other concerns

Your comfort and health are our priority. Don't hesitate to reach out if you need anything.

Best regards,
Dr. {dentistName} and the SmileCare Team`
        },
        sms: `Hi {patientName}! Checking in after your {procedureName}. How are you feeling? Reply with any concerns or call us at (555) 123-4567.`
      },
      birthday_greeting: {
        email: {
          subject: 'Happy Birthday from SmileCare Dental! 🎉',
          body: `Dear {patientName},

The entire SmileCare Dental team wishes you a very Happy Birthday!

As a birthday gift, we're offering you 20% off your next cosmetic dental procedure or a complimentary teeth whitening session with your next cleaning.

This offer is valid for 30 days. Call us at (555) 123-4567 to schedule!

Have a wonderful day!

Warm regards,
SmileCare Dental Team`
        },
        sms: `Happy Birthday {patientName}! 🎂 Enjoy 20% off cosmetic procedures this month. Call (555) 123-4567 to book! - SmileCare Dental`
      },
      insurance_renewal: {
        email: {
          subject: 'Maximize Your Dental Benefits Before They Expire',
          body: `Dear {patientName},

Your dental insurance benefits will reset on {renewalDate}. You have ${remainingBenefits} in unused benefits that will expire soon.

Don't let these benefits go to waste! Schedule your appointment today for:
- Preventive care (cleanings, x-rays)
- Any pending treatment
- Cosmetic procedures that may be partially covered

Current available benefits:
{benefitsSummary}

Call us at (555) 123-4567 or reply to this email to schedule.

Best regards,
SmileCare Dental Team`
        },
        sms: `Hi {patientName}! You have ${remainingBenefits} in dental benefits expiring on {renewalDate}. Schedule now: (555) 123-4567`
      },
      no_show_followup: {
        email: {
          subject: 'We Missed You Today',
          body: `Dear {patientName},

We noticed you weren't able to make your appointment today at {appointmentTime}. We hope everything is okay!

Your oral health is important to us, and we'd like to help you reschedule at a more convenient time.

Click here to view available times: {reschedulingLink}
Or call us at (555) 123-4567

If you're experiencing any dental pain or emergencies, please let us know immediately.

Best regards,
SmileCare Dental Team`
        },
        sms: `Hi {patientName}, we missed you at your {appointmentTime} appointment today. Please call (555) 123-4567 to reschedule. We're here to help!`
      },
      payment_reminder: {
        email: {
          subject: 'Payment Reminder - SmileCare Dental',
          body: `Dear {patientName},

This is a friendly reminder about your outstanding balance of ${balance}.

Payment Details:
- Amount Due: ${balance}
- Due Date: {dueDate}
- Invoice Number: {invoiceNumber}

Payment Options:
- Pay online: {paymentLink}
- Call us with card details: (555) 123-4567
- Mail a check to: 123 Main St, City, State 12345

If you have questions about your bill or need to set up a payment plan, please don't hesitate to contact us.

Thank you,
SmileCare Dental Billing Department`
        },
        sms: `Hi {patientName}, reminder: ${balance} payment due on {dueDate}. Pay online: {paymentLink} or call (555) 123-4567`
      },
      review_request: {
        email: {
          subject: 'How was your experience at SmileCare Dental?',
          body: `Dear {patientName},

Thank you for choosing SmileCare Dental for your recent {procedureName}. We hope you had a positive experience!

Your feedback helps us improve our services and helps other patients make informed decisions. Would you mind taking a moment to share your experience?

Leave a review:
- Google: {googleReviewLink}
- Yelp: {yelpReviewLink}
- Facebook: {facebookReviewLink}

If you had any concerns about your visit, please reply to this email or call us directly at (555) 123-4567. We value your feedback and want to ensure your complete satisfaction.

Thank you for your time!

Best regards,
SmileCare Dental Team`
        },
        sms: `Hi {patientName}! Thanks for visiting SmileCare Dental. We'd love your feedback! Leave a review: {reviewLink}`
      }
    };
  }

  initialize() {
    // Schedule daily tasks
    this.scheduleTask('daily-followups', '0 9 * * *', () => this.runDailyFollowUps());
    this.scheduleTask('appointment-reminders', '0 10,14,18 * * *', () => this.sendAppointmentReminders());
    this.scheduleTask('recall-reminders', '0 10 * * MON', () => this.sendRecallReminders());
    this.scheduleTask('birthday-greetings', '0 9 * * *', () => this.sendBirthdayGreetings());
    this.scheduleTask('insurance-reminders', '0 10 1,15 * *', () => this.sendInsuranceReminders());
    this.scheduleTask('payment-reminders', '0 10 * * *', () => this.sendPaymentReminders());
    this.scheduleTask('review-requests', '0 14 * * *', () => this.sendReviewRequests());
    
    logger.info('Automated follow-up service initialized');
  }

  scheduleTask(name, schedule, handler) {
    if (this.tasks.has(name)) {
      this.tasks.get(name).stop();
    }
    
    const task = cron.schedule(schedule, async () => {
      try {
        logger.info(`Running scheduled task: ${name}`);
        await handler();
      } catch (error) {
        logger.error(`Error in scheduled task ${name}:`, error);
      }
    }, {
      scheduled: true,
      timezone: 'America/New_York'
    });
    
    this.tasks.set(name, task);
  }

  async runDailyFollowUps() {
    await Promise.all([
      this.followUpAfterProcedures(),
      this.checkNoShows(),
      this.followUpOnTreatmentPlans()
    ]);
  }

  async sendAppointmentReminders() {
    const reminderWindows = [
      { hours: 48, type: 'two_day' },
      { hours: 24, type: 'one_day' },
      { hours: 2, type: 'two_hour' }
    ];

    for (const window of reminderWindows) {
      const windowStart = moment().add(window.hours, 'hours').subtract(30, 'minutes').toDate();
      const windowEnd = moment().add(window.hours, 'hours').add(30, 'minutes').toDate();

      const appointments = await Appointment.find({
        startTime: { $gte: windowStart, $lte: windowEnd },
        status: 'scheduled',
        [`reminders.${window.type}`]: { $ne: true }
      }).populate('patient dentist');

      for (const appointment of appointments) {
        await this.sendReminder(appointment, window.type);
        
        // Mark reminder as sent
        if (!appointment.reminders) appointment.reminders = {};
        appointment.reminders[window.type] = true;
        await appointment.save();
      }
    }
  }

  async sendReminder(appointment, reminderType) {
    const patient = appointment.patient;
    const preferences = patient.preferences?.appointmentReminders;
    
    if (!preferences) return;

    const data = {
      patientName: patient.fullName,
      appointmentDate: moment(appointment.startTime).format('MMMM Do, YYYY'),
      appointmentTime: moment(appointment.startTime).format('h:mm A'),
      procedureType: appointment.type,
      dentistName: appointment.dentist?.lastName || 'TBD'
    };

    const template = this.templates.appointment_reminder;

    if (preferences.email) {
      await sendEmail({
        to: patient.email,
        subject: this.interpolateTemplate(template.email.subject, data),
        html: this.interpolateTemplate(template.email.body, data).replace(/\n/g, '<br>')
      });
    }

    if (preferences.sms) {
      await sendSMS({
        to: patient.phone,
        body: this.interpolateTemplate(template.sms, data)
      });
    }

    logger.info(`Sent ${reminderType} reminder for appointment ${appointment._id}`);
  }

  async sendRecallReminders() {
    const patients = await Patient.find({
      status: 'active',
      nextRecallDate: {
        $gte: moment().toDate(),
        $lte: moment().add(30, 'days').toDate()
      },
      'lastRecallReminder': {
        $not: {
          $gte: moment().subtract(30, 'days').toDate()
        }
      }
    });

    for (const patient of patients) {
      const monthsSinceLastVisit = patient.lastVisit 
        ? moment().diff(moment(patient.lastVisit), 'months')
        : 6;

      const availableSlots = await this.getAvailableSlots(5);
      
      const data = {
        patientName: patient.fullName,
        monthsSinceLastVisit,
        availableSlots: this.formatAvailableSlots(availableSlots),
        bookingLink: `${process.env.APP_URL}/book?patient=${patient._id}`
      };

      const template = this.templates.recall_reminder;

      if (patient.preferences?.appointmentReminders?.email) {
        await sendEmail({
          to: patient.email,
          subject: this.interpolateTemplate(template.email.subject, data),
          html: this.interpolateTemplate(template.email.body, data).replace(/\n/g, '<br>')
        });
      }

      if (patient.preferences?.appointmentReminders?.sms) {
        await sendSMS({
          to: patient.phone,
          body: this.interpolateTemplate(template.sms, data)
        });
      }

      patient.lastRecallReminder = new Date();
      await patient.save();
    }
  }

  async followUpAfterProcedures() {
    // Follow up 1 day after major procedures
    const yesterday = moment().subtract(1, 'day').startOf('day').toDate();
    const yesterdayEnd = moment().subtract(1, 'day').endOf('day').toDate();

    const appointments = await Appointment.find({
      completedAt: { $gte: yesterday, $lte: yesterdayEnd },
      type: { $in: ['extraction', 'root_canal', 'surgery', 'implant'] },
      'followUp.sent': { $ne: true }
    }).populate('patient dentist');

    for (const appointment of appointments) {
      const patient = appointment.patient;
      
      const data = {
        patientName: patient.fullName,
        procedureName: appointment.type,
        procedureDate: moment(appointment.completedAt).format('MMMM Do'),
        dentistName: appointment.dentist?.lastName || 'your dentist',
        postOpInstructions: this.getPostOpInstructions(appointment.type)
      };

      const template = this.templates.treatment_followup;

      await sendEmail({
        to: patient.email,
        subject: this.interpolateTemplate(template.email.subject, data),
        html: this.interpolateTemplate(template.email.body, data).replace(/\n/g, '<br>')
      });

      if (patient.preferences?.appointmentReminders?.sms) {
        await sendSMS({
          to: patient.phone,
          body: this.interpolateTemplate(template.sms, data)
        });
      }

      appointment.followUp = { sent: true, sentAt: new Date() };
      await appointment.save();
    }
  }

  async sendBirthdayGreetings() {
    const today = moment().startOf('day');
    
    const patients = await Patient.find({
      status: 'active',
      $expr: {
        $and: [
          { $eq: [{ $dayOfMonth: '$dateOfBirth' }, today.date()] },
          { $eq: [{ $month: '$dateOfBirth' }, today.month() + 1] }
        ]
      }
    });

    for (const patient of patients) {
      const data = {
        patientName: patient.firstName
      };

      const template = this.templates.birthday_greeting;

      await sendEmail({
        to: patient.email,
        subject: this.interpolateTemplate(template.email.subject, data),
        html: this.interpolateTemplate(template.email.body, data).replace(/\n/g, '<br>')
      });

      if (patient.preferences?.communicationPreference !== 'email') {
        await sendSMS({
          to: patient.phone,
          body: this.interpolateTemplate(template.sms, data)
        });
      }

      logger.info(`Sent birthday greeting to patient ${patient._id}`);
    }
  }

  async sendInsuranceReminders() {
    const yearEnd = moment().endOf('year');
    const monthsRemaining = yearEnd.diff(moment(), 'months');
    
    if (monthsRemaining <= 3) {
      const patients = await Patient.find({
        status: 'active',
        'insurance.verified': true,
        'insurance.coverageDetails.annualMaximum.remaining': { $gt: 100 }
      });

      for (const patient of patients) {
        const remaining = patient.insurance.coverageDetails.annualMaximum.remaining;
        
        const data = {
          patientName: patient.fullName,
          remainingBenefits: `$${remaining}`,
          renewalDate: yearEnd.format('MMMM Do, YYYY'),
          benefitsSummary: this.formatBenefitsSummary(patient.insurance.coverageDetails)
        };

        const template = this.templates.insurance_renewal;

        await sendEmail({
          to: patient.email,
          subject: this.interpolateTemplate(template.email.subject, data),
          html: this.interpolateTemplate(template.email.body, data).replace(/\n/g, '<br>')
        });

        logger.info(`Sent insurance reminder to patient ${patient._id}`);
      }
    }
  }

  async checkNoShows() {
    const twoHoursAgo = moment().subtract(2, 'hours').toDate();
    const now = new Date();

    const noShows = await Appointment.find({
      startTime: { $gte: twoHoursAgo, $lte: now },
      status: 'scheduled',
      'noShowFollowUp': { $ne: true }
    }).populate('patient');

    for (const appointment of noShows) {
      appointment.status = 'no_show';
      appointment.noShowFollowUp = true;
      await appointment.save();

      const patient = appointment.patient;
      
      const data = {
        patientName: patient.fullName,
        appointmentTime: moment(appointment.startTime).format('h:mm A'),
        reschedulingLink: `${process.env.APP_URL}/reschedule?appointment=${appointment._id}`
      };

      const template = this.templates.no_show_followup;

      await sendEmail({
        to: patient.email,
        subject: this.interpolateTemplate(template.email.subject, data),
        html: this.interpolateTemplate(template.email.body, data).replace(/\n/g, '<br>')
      });

      await sendSMS({
        to: patient.phone,
        body: this.interpolateTemplate(template.sms, data)
      });

      logger.info(`Sent no-show follow-up for appointment ${appointment._id}`);
    }
  }

  async sendPaymentReminders() {
    const patients = await Patient.find({
      balance: { $gt: 0 },
      'lastPaymentReminder': {
        $not: {
          $gte: moment().subtract(7, 'days').toDate()
        }
      }
    });

    for (const patient of patients) {
      const data = {
        patientName: patient.fullName,
        balance: patient.balance.toFixed(2),
        dueDate: moment().add(7, 'days').format('MMMM Do, YYYY'),
        invoiceNumber: `INV-${patient._id.toString().slice(-6).toUpperCase()}`,
        paymentLink: `${process.env.APP_URL}/pay?patient=${patient._id}`
      };

      const template = this.templates.payment_reminder;

      await sendEmail({
        to: patient.email,
        subject: this.interpolateTemplate(template.email.subject, data),
        html: this.interpolateTemplate(template.email.body, data).replace(/\n/g, '<br>')
      });

      patient.lastPaymentReminder = new Date();
      await patient.save();
    }
  }

  async sendReviewRequests() {
    // Send review requests 3 days after completed appointments
    const threeDaysAgo = moment().subtract(3, 'days').startOf('day').toDate();
    const threeDaysAgoEnd = moment().subtract(3, 'days').endOf('day').toDate();

    const appointments = await Appointment.find({
      completedAt: { $gte: threeDaysAgo, $lte: threeDaysAgoEnd },
      status: 'completed',
      'reviewRequested': { $ne: true }
    }).populate('patient');

    for (const appointment of appointments) {
      const patient = appointment.patient;
      
      const data = {
        patientName: patient.firstName,
        procedureName: appointment.type,
        googleReviewLink: process.env.GOOGLE_REVIEW_URL,
        yelpReviewLink: process.env.YELP_REVIEW_URL,
        facebookReviewLink: process.env.FACEBOOK_REVIEW_URL,
        reviewLink: process.env.GOOGLE_REVIEW_URL // For SMS
      };

      const template = this.templates.review_request;

      await sendEmail({
        to: patient.email,
        subject: this.interpolateTemplate(template.email.subject, data),
        html: this.interpolateTemplate(template.email.body, data).replace(/\n/g, '<br>')
      });

      appointment.reviewRequested = true;
      await appointment.save();
    }
  }

  async followUpOnTreatmentPlans() {
    // Follow up on accepted treatment plans with pending procedures
    const treatmentPlans = await TreatmentPlan.find({
      status: 'accepted',
      'phases.procedures.status': 'planned',
      'lastFollowUp': {
        $not: {
          $gte: moment().subtract(14, 'days').toDate()
        }
      }
    }).populate('patient');

    for (const plan of treatmentPlans) {
      const nextProcedures = plan.getNextProcedures(3);
      
      if (nextProcedures.length > 0) {
        const patient = plan.patient;
        
        const procedureList = nextProcedures
          .map(p => `- ${p.procedure.procedureName}`)
          .join('\n');
        
        const emailBody = `Dear ${patient.fullName},

We wanted to follow up on your treatment plan created on ${moment(plan.createdAt).format('MMMM Do, YYYY')}.

The following procedures are ready to be scheduled:
${procedureList}

Would you like to schedule these appointments? Please call us at (555) 123-4567 or reply to this email.

Your oral health is our priority, and we're here to help you complete your treatment plan comfortably.

Best regards,
SmileCare Dental Team`;

        await sendEmail({
          to: patient.email,
          subject: 'Follow-up on Your Treatment Plan - SmileCare Dental',
          html: emailBody.replace(/\n/g, '<br>')
        });

        plan.lastFollowUp = new Date();
        await plan.save();
      }
    }
  }

  interpolateTemplate(template, data) {
    return template.replace(/{(\w+)}/g, (match, key) => {
      return data[key] || match;
    });
  }

  async getAvailableSlots(count) {
    // Mock implementation - would integrate with appointment system
    const slots = [];
    const startDate = moment().add(1, 'day').startOf('day');
    
    for (let i = 0; i < 7 && slots.length < count; i++) {
      const date = startDate.clone().add(i, 'days');
      if (date.day() !== 0) { // Not Sunday
        slots.push({
          date: date.format('MMMM Do'),
          time: '9:00 AM'
        });
        if (slots.length < count) {
          slots.push({
            date: date.format('MMMM Do'),
            time: '2:00 PM'
          });
        }
      }
    }
    
    return slots.slice(0, count);
  }

  formatAvailableSlots(slots) {
    return slots.map(slot => `- ${slot.date} at ${slot.time}`).join('\n');
  }

  formatBenefitsSummary(coverageDetails) {
    const lines = [];
    lines.push(`Annual Maximum Remaining: $${coverageDetails.annualMaximum.remaining}`);
    lines.push(`Deductible Met: $${coverageDetails.deductible.met} of $${coverageDetails.deductible.individual}`);
    
    for (const [category, coverage] of Object.entries(coverageDetails.coverageByCategory)) {
      lines.push(`${category}: ${coverage.coverage}% coverage`);
    }
    
    return lines.join('\n');
  }

  getPostOpInstructions(procedureType) {
    const instructions = {
      extraction: `- Bite on gauze for 30-45 minutes
- Avoid smoking and straws for 48 hours
- Take prescribed pain medication as directed
- Apply ice to reduce swelling
- Eat soft foods for 2-3 days`,
      root_canal: `- Avoid chewing on the treated tooth until permanent restoration
- Take prescribed antibiotics as directed
- Some sensitivity is normal for a few days
- Maintain good oral hygiene`,
      surgery: `- Follow all post-operative instructions provided
- Take medications as prescribed
- Rest for 24-48 hours
- Call immediately if excessive bleeding or fever occurs`,
      implant: `- Avoid disturbing the implant site
- Use prescribed mouth rinse
- Eat soft foods for the first week
- Do not smoke during healing period`
    };
    
    return instructions[procedureType] || 'Follow the post-operative instructions provided by your dentist.';
  }

  stop() {
    for (const [name, task] of this.tasks) {
      task.stop();
      logger.info(`Stopped scheduled task: ${name}`);
    }
    this.tasks.clear();
  }
}

export default new AutomatedFollowUpService();