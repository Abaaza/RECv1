import twilio from 'twilio';
import { logger } from '../utils/logger.js';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromNumber = process.env.TWILIO_PHONE_NUMBER;

let client;

if (accountSid && authToken) {
  client = twilio(accountSid, authToken);
}

export const sendSMS = async ({ to, message }) => {
  try {
    if (!client) {
      logger.warn('Twilio client not configured - SMS not sent');
      return { status: 'skipped', reason: 'Twilio not configured' };
    }

    const formattedNumber = formatPhoneNumber(to);

    const result = await client.messages.create({
      body: message,
      from: fromNumber,
      to: formattedNumber
    });

    logger.info(`SMS sent to ${formattedNumber}: ${result.sid}`);
    
    return {
      status: 'sent',
      sid: result.sid,
      to: formattedNumber
    };
  } catch (error) {
    logger.error(`Failed to send SMS to ${to}:`, error);
    throw error;
  }
};

export const sendBulkSMS = async (recipients) => {
  const results = [];
  
  for (const recipient of recipients) {
    try {
      const result = await sendSMS(recipient);
      results.push({ ...recipient, ...result });
    } catch (error) {
      results.push({ 
        ...recipient, 
        status: 'failed', 
        error: error.message 
      });
    }
  }
  
  return results;
};

export const verifySMSConfiguration = async () => {
  try {
    if (!client) {
      logger.warn('Twilio client not configured');
      return false;
    }

    const account = await client.api.accounts(accountSid).fetch();
    logger.info(`Twilio account verified: ${account.friendlyName}`);
    return true;
  } catch (error) {
    logger.error('SMS configuration verification failed:', error);
    return false;
  }
};

function formatPhoneNumber(phone) {
  const cleaned = phone.replace(/\D/g, '');
  
  if (cleaned.length === 10) {
    return `+1${cleaned}`;
  }
  
  if (cleaned.length === 11 && cleaned[0] === '1') {
    return `+${cleaned}`;
  }
  
  if (cleaned.startsWith('+')) {
    return cleaned;
  }
  
  return `+${cleaned}`;
}

export const smsTemplates = {
  appointmentReminder: (data) => 
    `Reminder: Dental appointment on ${data.date} at ${data.time} with ${data.dentistName}. Reply CONFIRM to confirm or CANCEL to cancel.`,
  
  appointmentConfirmation: (data) => 
    `Your dental appointment is confirmed for ${data.date} at ${data.time} with ${data.dentistName}. See you then!`,
  
  appointmentCancellation: (data) => 
    `Your appointment on ${data.date} at ${data.time} has been cancelled. Call (555) 123-4567 to reschedule.`,
  
  emergencyResponse: (data) => 
    `We received your emergency request. ${data.instructions}. Our team will contact you shortly.`,
  
  test: () => 
    `Test SMS from SmileCare Dental AI System. Message received successfully.`
};

export const formatSMSFromTemplate = (template, data) => {
  const templateFunc = smsTemplates[template];
  
  if (!templateFunc) {
    throw new Error(`SMS template '${template}' not found`);
  }
  
  return templateFunc(data);
};

export default { 
  sendSMS, 
  sendBulkSMS, 
  verifySMSConfiguration,
  formatSMSFromTemplate
};