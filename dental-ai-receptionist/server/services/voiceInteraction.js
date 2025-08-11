import { Deepgram } from '@deepgram/sdk';
import OpenAI from 'openai';
import twilio from 'twilio';
import { logger } from '../utils/logger.js';
import appointmentOptimizer from './appointmentOptimizer.js';
import insuranceVerification from './insuranceVerification.js';
import emergencyTriage from './emergencyTriage.js';
import Patient from '../models/Patient.js';
import Appointment from '../models/Appointment.js';

class VoiceInteractionService {
  constructor() {
    this.deepgram = new Deepgram(process.env.DEEPGRAM_API_KEY);
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    this.twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    
    this.activeCalls = new Map();
    this.conversationHistory = new Map();
    
    this.voicePersonalities = {
      professional: {
        name: 'Sarah',
        style: 'professional, warm, and efficient',
        speed: 1.0,
        pitch: 1.0
      },
      friendly: {
        name: 'Emma',
        style: 'friendly, conversational, and empathetic',
        speed: 0.95,
        pitch: 1.05
      },
      calm: {
        name: 'Michael',
        style: 'calm, reassuring, and patient',
        speed: 0.9,
        pitch: 0.95
      }
    };

    this.conversationStates = {
      GREETING: 'greeting',
      IDENTIFYING: 'identifying',
      UNDERSTANDING_NEED: 'understanding_need',
      BOOKING: 'booking',
      EMERGENCY: 'emergency',
      INSURANCE: 'insurance',
      BILLING: 'billing',
      GENERAL_INQUIRY: 'general_inquiry',
      CONFIRMING: 'confirming',
      CLOSING: 'closing'
    };

    this.intents = {
      BOOK_APPOINTMENT: ['appointment', 'schedule', 'book', 'visit', 'see dentist'],
      EMERGENCY: ['emergency', 'urgent', 'pain', 'bleeding', 'swelling', 'hurt'],
      CANCEL: ['cancel', 'reschedule', 'change', 'move'],
      INSURANCE: ['insurance', 'coverage', 'benefits', 'claim'],
      BILLING: ['bill', 'payment', 'cost', 'price', 'owe'],
      HOURS: ['hours', 'open', 'closed', 'time'],
      LOCATION: ['where', 'location', 'address', 'directions'],
      SERVICES: ['services', 'procedures', 'offer', 'provide']
    };
  }

  async handleIncomingCall(callSid, from, to) {
    try {
      const callContext = {
        callSid,
        from,
        to,
        startTime: new Date(),
        state: this.conversationStates.GREETING,
        personality: this.voicePersonalities.professional,
        language: 'en',
        patientInfo: null,
        currentIntent: null,
        extractedData: {},
        conversationTurns: []
      };

      this.activeCalls.set(callSid, callContext);

      // Start with greeting
      const greeting = await this.generateGreeting(callContext);
      await this.speak(callSid, greeting);
      
      // Start listening
      await this.startListening(callSid);

      return callContext;
    } catch (error) {
      logger.error('Error handling incoming call:', error);
      throw error;
    }
  }

  async generateGreeting(context) {
    const timeOfDay = new Date().getHours();
    let greeting = timeOfDay < 12 ? 'Good morning' : timeOfDay < 17 ? 'Good afternoon' : 'Good evening';
    
    // Check if returning patient
    const phoneNumber = context.from;
    const patient = await Patient.findOne({ phone: phoneNumber });
    
    if (patient) {
      context.patientInfo = patient;
      return `${greeting}, ${patient.firstName}! This is ${context.personality.name} from SmileCare Dental. How may I assist you today?`;
    } else {
      return `${greeting}! Thank you for calling SmileCare Dental. This is ${context.personality.name}, your AI receptionist. How may I help you today?`;
    }
  }

  async processTranscript(callSid, transcript) {
    const context = this.activeCalls.get(callSid);
    if (!context) return;

    try {
      // Add to conversation history
      context.conversationTurns.push({
        speaker: 'caller',
        text: transcript,
        timestamp: new Date()
      });

      // Detect intent and extract entities
      const analysis = await this.analyzeTranscript(transcript, context);
      
      // Update context
      context.currentIntent = analysis.intent;
      Object.assign(context.extractedData, analysis.entities);

      // Route based on state and intent
      const response = await this.routeConversation(context, analysis);
      
      // Add AI response to history
      context.conversationTurns.push({
        speaker: 'ai',
        text: response,
        timestamp: new Date()
      });

      // Speak response
      await this.speak(callSid, response);

      // Update conversation state if needed
      if (analysis.nextState) {
        context.state = analysis.nextState;
      }

      // Continue listening unless call is ending
      if (context.state !== this.conversationStates.CLOSING) {
        await this.continueListening(callSid);
      } else {
        await this.endCall(callSid);
      }
    } catch (error) {
      logger.error('Error processing transcript:', error);
      await this.handleError(callSid, error);
    }
  }

  async analyzeTranscript(transcript, context) {
    const prompt = `Analyze this dental office phone conversation transcript and extract relevant information.

Current conversation state: ${context.state}
Patient info available: ${context.patientInfo ? 'Yes' : 'No'}
Transcript: "${transcript}"

Extract:
1. Primary intent (book_appointment, emergency, cancel, insurance, billing, hours, location, services, other)
2. Entities (name, phone, date, time, procedure type, symptoms, etc.)
3. Urgency level (1-5, 5 being most urgent)
4. Suggested next conversation state
5. Any red flags for emergency triage

Return as JSON.`;

    const completion = await this.openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: 'You are analyzing dental office phone conversations to extract structured data.' },
        { role: 'user', content: prompt }
      ],
      response_format: { type: 'json_object' }
    });

    return JSON.parse(completion.choices[0].message.content);
  }

  async routeConversation(context, analysis) {
    switch (context.state) {
      case this.conversationStates.GREETING:
        return await this.handleGreetingState(context, analysis);
      
      case this.conversationStates.IDENTIFYING:
        return await this.handleIdentifyingState(context, analysis);
      
      case this.conversationStates.UNDERSTANDING_NEED:
        return await this.handleUnderstandingNeedState(context, analysis);
      
      case this.conversationStates.BOOKING:
        return await this.handleBookingState(context, analysis);
      
      case this.conversationStates.EMERGENCY:
        return await this.handleEmergencyState(context, analysis);
      
      case this.conversationStates.INSURANCE:
        return await this.handleInsuranceState(context, analysis);
      
      case this.conversationStates.BILLING:
        return await this.handleBillingState(context, analysis);
      
      case this.conversationStates.CONFIRMING:
        return await this.handleConfirmingState(context, analysis);
      
      default:
        return await this.handleGeneralInquiry(context, analysis);
    }
  }

  async handleGreetingState(context, analysis) {
    if (analysis.urgency >= 4 || analysis.intent === 'emergency') {
      context.state = this.conversationStates.EMERGENCY;
      return "I understand this is urgent. Can you describe your symptoms? Are you experiencing severe pain, bleeding, or swelling?";
    }

    if (!context.patientInfo && !analysis.entities.name) {
      context.state = this.conversationStates.IDENTIFYING;
      return "I'd be happy to help you. May I have your full name, please?";
    }

    context.state = this.conversationStates.UNDERSTANDING_NEED;
    
    switch (analysis.intent) {
      case 'book_appointment':
        context.state = this.conversationStates.BOOKING;
        return "I can help you schedule an appointment. What type of service do you need?";
      
      case 'insurance':
        context.state = this.conversationStates.INSURANCE;
        return "I can help with insurance questions. Are you looking to verify coverage or check benefits?";
      
      case 'billing':
        context.state = this.conversationStates.BILLING;
        return "I can assist with billing inquiries. Are you calling about a specific invoice or payment?";
      
      default:
        return "How can I assist you today? I can help with appointments, insurance, billing, or answer general questions.";
    }
  }

  async handleBookingState(context, analysis) {
    const missingInfo = [];
    
    if (!context.extractedData.procedureType) {
      missingInfo.push('type of appointment');
    }
    if (!context.extractedData.preferredDate && !context.extractedData.preferredTime) {
      missingInfo.push('preferred date or time');
    }
    
    if (missingInfo.length > 0) {
      return `To find the best appointment for you, could you tell me the ${missingInfo.join(' and ')}?`;
    }

    // Find available slots
    const slots = await appointmentOptimizer.findOptimalSlot(
      context.extractedData.procedureType,
      context.extractedData.preferredDate || new Date(),
      {
        preferredTimeOfDay: context.extractedData.preferredTime,
        urgency: analysis.urgency > 3 ? 'high' : 'normal'
      },
      [],
      null
    );

    if (slots.length === 0) {
      return "I'm sorry, but I don't have any available slots that match your preferences. Would you like me to check alternative times?";
    }

    context.proposedAppointment = slots[0];
    context.state = this.conversationStates.CONFIRMING;

    const slotDate = new Date(slots[0].startTime);
    return `I found an available appointment on ${this.formatDate(slotDate)} at ${this.formatTime(slotDate)}. Would this work for you?`;
  }

  async handleEmergencyState(context, analysis) {
    if (!context.extractedData.symptoms) {
      return "To better assist you, can you describe your symptoms? For example, are you experiencing pain, swelling, bleeding, or did you have a dental trauma?";
    }

    // Perform triage
    const triageResult = await emergencyTriage.triagePatient(
      {
        name: context.patientInfo?.fullName || context.extractedData.name || 'Unknown',
        phone: context.from
      },
      {
        description: context.extractedData.symptoms,
        pain_level: analysis.entities.painLevel || 5,
        bleeding: context.extractedData.symptoms.includes('bleed'),
        swelling: context.extractedData.symptoms.includes('swell')
      }
    );

    if (triageResult.requiresImmediate911) {
      return "Based on your symptoms, you need immediate medical attention. Please hang up and call 911 right now, or have someone drive you to the nearest emergency room.";
    }

    const instructions = triageResult.instructions.slice(0, 3).join(' ');
    
    if (triageResult.appointmentSlot) {
      const slotTime = new Date(triageResult.appointmentSlot.startTime);
      return `${instructions} I've reserved an emergency appointment for you ${this.formatRelativeTime(slotTime)}. Please come to the office as soon as possible.`;
    }

    return `${instructions} We'll fit you in as soon as possible. Can you come to the office within the next ${triageResult.estimatedWaitTime} minutes?`;
  }

  async handleInsuranceState(context, analysis) {
    if (!context.patientInfo?.insurance) {
      return "To check your insurance benefits, I'll need your insurance provider name and member ID. Can you provide those?";
    }

    if (analysis.entities.procedureType) {
      // Check specific procedure coverage
      const coverage = await insuranceVerification.checkProcedureCoverage(
        context.patientInfo.insurance,
        analysis.entities.procedureType,
        analysis.entities.estimatedCost || 500
      );

      if (coverage.covered) {
        return `For ${coverage.procedureName}, your insurance covers ${coverage.coveragePercentage}%. Your estimated cost would be $${coverage.estimatedPatientResponsibility}. ${coverage.preAuthorizationRequired ? 'This procedure requires pre-authorization.' : ''} Would you like to schedule this procedure?`;
      } else {
        return `Unfortunately, ${analysis.entities.procedureType} is not covered by your current plan. The full cost would be approximately $${analysis.entities.estimatedCost || 'varies'}. We do offer payment plans if you're interested.`;
      }
    }

    return "What specific insurance question can I help you with? I can check coverage for procedures, verify benefits, or explain your plan details.";
  }

  async handleBillingState(context, analysis) {
    if (!context.patientInfo) {
      context.state = this.conversationStates.IDENTIFYING;
      return "To access your billing information, I'll need to verify your identity. Can you provide your full name and date of birth?";
    }

    if (context.patientInfo.balance > 0) {
      return `Your current balance is $${context.patientInfo.balance.toFixed(2)}. Would you like to make a payment over the phone, set up a payment plan, or have questions about specific charges?`;
    }

    return "Your account is current with no outstanding balance. Is there a specific invoice or charge you'd like to discuss?";
  }

  async handleConfirmingState(context, analysis) {
    const response = analysis.entities.confirmation || analysis.entities.response;
    
    if (response === 'yes' || response === 'confirm') {
      if (context.proposedAppointment) {
        // Book the appointment
        const appointment = await this.bookAppointment(context);
        
        if (appointment) {
          await this.sendConfirmationSMS(context, appointment);
          context.state = this.conversationStates.CLOSING;
          return `Perfect! I've booked your appointment for ${this.formatDate(appointment.startTime)} at ${this.formatTime(appointment.startTime)}. You'll receive a confirmation text shortly. Is there anything else I can help you with?`;
        }
      }
    } else if (response === 'no' || response === 'cancel') {
      return "No problem. Would you like me to check for alternative times, or is there something else I can help you with?";
    }

    return "I didn't catch that. Could you please confirm with 'yes' or 'no'?";
  }

  async bookAppointment(context) {
    try {
      const appointment = new Appointment({
        patient: context.patientInfo?._id,
        type: context.extractedData.procedureType,
        startTime: context.proposedAppointment.startTime,
        endTime: context.proposedAppointment.endTime,
        status: 'scheduled',
        bookedVia: 'phone_ai',
        notes: `Booked via AI phone system. Call ID: ${context.callSid}`
      });

      await appointment.save();
      return appointment;
    } catch (error) {
      logger.error('Error booking appointment:', error);
      return null;
    }
  }

  async sendConfirmationSMS(context, appointment) {
    try {
      await this.twilioClient.messages.create({
        body: `Appointment confirmed at SmileCare Dental on ${this.formatDate(appointment.startTime)} at ${this.formatTime(appointment.startTime)}. Reply CANCEL to cancel or CHANGE to reschedule.`,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: context.from
      });
    } catch (error) {
      logger.error('Error sending confirmation SMS:', error);
    }
  }

  async speak(callSid, text) {
    const context = this.activeCalls.get(callSid);
    if (!context) return;

    try {
      // Generate speech using OpenAI TTS
      const mp3 = await this.openai.audio.speech.create({
        model: 'tts-1',
        voice: 'alloy',
        input: text,
        speed: context.personality.speed
      });

      // Stream to Twilio
      const buffer = Buffer.from(await mp3.arrayBuffer());
      
      // This would integrate with Twilio's media streams
      // For now, we'll use Twilio's built-in TTS
      await this.twilioClient.calls(callSid).update({
        twiml: `<Response><Say voice="Polly.Joanna">${text}</Say><Gather input="speech" timeout="3" speechTimeout="auto" action="/voice/process" method="POST"/></Response>`
      });
    } catch (error) {
      logger.error('Error speaking:', error);
    }
  }

  async startListening(callSid) {
    // Set up Deepgram live transcription
    const deepgramLive = this.deepgram.transcription.live({
      punctuate: true,
      interim_results: true,
      language: 'en-US',
      model: 'nova-2'
    });

    deepgramLive.on('transcriptReceived', (transcript) => {
      const data = JSON.parse(transcript);
      if (data.is_final && data.channel.alternatives[0].transcript) {
        this.processTranscript(callSid, data.channel.alternatives[0].transcript);
      }
    });

    this.activeCalls.get(callSid).transcriptionStream = deepgramLive;
  }

  async continueListening(callSid) {
    // Continue the existing Deepgram stream
    const context = this.activeCalls.get(callSid);
    if (context && context.transcriptionStream) {
      // Stream is already active
      return;
    }
    
    await this.startListening(callSid);
  }

  async handleError(callSid, error) {
    logger.error(`Error in call ${callSid}:`, error);
    
    await this.speak(callSid, "I'm sorry, I'm having a bit of trouble understanding. Let me transfer you to a team member who can assist you better.");
    
    // Transfer to human agent
    await this.transferToHuman(callSid);
  }

  async transferToHuman(callSid) {
    try {
      await this.twilioClient.calls(callSid).update({
        twiml: '<Response><Say>Transferring you to a team member. Please hold.</Say><Dial>+1234567890</Dial></Response>'
      });
    } catch (error) {
      logger.error('Error transferring call:', error);
    }
  }

  async endCall(callSid) {
    const context = this.activeCalls.get(callSid);
    if (context) {
      // Save conversation history
      await this.saveConversation(context);
      
      // Clean up
      if (context.transcriptionStream) {
        context.transcriptionStream.finish();
      }
      
      this.activeCalls.delete(callSid);
    }

    try {
      await this.twilioClient.calls(callSid).update({
        twiml: '<Response><Say>Thank you for calling SmileCare Dental. Have a wonderful day!</Say><Hangup/></Response>'
      });
    } catch (error) {
      logger.error('Error ending call:', error);
    }
  }

  async saveConversation(context) {
    // Save to database for analysis and improvement
    const conversation = {
      callSid: context.callSid,
      from: context.from,
      startTime: context.startTime,
      endTime: new Date(),
      duration: (new Date() - context.startTime) / 1000,
      patientId: context.patientInfo?._id,
      conversationTurns: context.conversationTurns,
      extractedData: context.extractedData,
      outcome: context.state === this.conversationStates.CLOSING ? 'completed' : 'incomplete'
    };

    // Store in database (implementation depends on your schema)
    logger.info('Conversation saved:', conversation);
  }

  formatDate(date) {
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric'
    }).format(date);
  }

  formatTime(date) {
    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }).format(date);
  }

  formatRelativeTime(date) {
    const now = new Date();
    const diff = date - now;
    const minutes = Math.floor(diff / 60000);
    
    if (minutes < 60) {
      return `in ${minutes} minutes`;
    } else if (minutes < 120) {
      return 'in about an hour';
    } else {
      return `today at ${this.formatTime(date)}`;
    }
  }
}

export default new VoiceInteractionService();