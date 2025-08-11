export const dentalTraumaGuide = {
  scenarios: [
    {
      id: 'tooth_knocked_out',
      condition: 'Tooth completely knocked out',
      questions: [
        'Is this a baby tooth or permanent tooth?',
        'How long ago did this happen?',
        'Is the tooth intact?'
      ],
      instructions: {
        immediate: [
          'Find the tooth and pick it up by the crown (white part), not the root',
          'If dirty, rinse gently with milk or saline solution for 10 seconds',
          'Try to reinsert the tooth into the socket if possible',
          'If cannot reinsert, store in milk, saliva, or saline solution',
          'Come to the clinic immediately - time is critical'
        ],
        urgency: 'EMERGENCY - See dentist within 30 minutes'
      }
    },
    {
      id: 'tooth_loose',
      condition: 'Tooth is loose or displaced',
      questions: [
        'Can you describe how loose the tooth is?',
        'Is there any bleeding from the gums?',
        'Is the tooth painful to touch?'
      ],
      instructions: {
        immediate: [
          'Avoid touching or wiggling the tooth',
          'Bite gently on a clean cloth to keep tooth in position',
          'Apply cold compress to reduce swelling',
          'Take over-the-counter pain medication if needed'
        ],
        urgency: 'URGENT - See dentist within 2-6 hours'
      }
    },
    {
      id: 'tooth_chipped',
      condition: 'Tooth is chipped or fractured',
      questions: [
        'Is the tooth sensitive to hot or cold?',
        'Can you see any pink or red tissue in the broken area?',
        'Is there active bleeding?'
      ],
      instructions: {
        immediate: [
          'Rinse mouth with warm water',
          'Apply cold compress to reduce swelling',
          'Save any broken pieces if possible',
          'Cover sharp edges with dental wax if available'
        ],
        urgency: 'Schedule appointment within 24-48 hours'
      }
    },
    {
      id: 'soft_tissue_injury',
      condition: 'Cut or injury to lips, gums, or tongue',
      questions: [
        'Where exactly is the injury?',
        'Is the bleeding controlled?',
        'How deep does the cut appear?'
      ],
      instructions: {
        immediate: [
          'Apply direct pressure with clean gauze for 10-15 minutes',
          'Use ice wrapped in cloth on the outside',
          'Rinse with salt water after bleeding stops'
        ],
        urgency: 'If bleeding persists after 15 minutes, seek immediate care'
      }
    },
    {
      id: 'jaw_injury',
      condition: 'Possible jaw fracture or dislocation',
      questions: [
        'Can you open and close your mouth normally?',
        'Is there severe pain when moving the jaw?',
        'Is there visible swelling or deformity?'
      ],
      instructions: {
        immediate: [
          'Immobilize the jaw with a bandage if possible',
          'Apply ice to reduce swelling',
          'Do not attempt to correct the position',
          'Go to emergency room immediately'
        ],
        urgency: 'EMERGENCY - Seek immediate medical attention'
      }
    }
  ],

  greetings: {
    initial: "Hello! This is SmileCare Dental Clinic. I'm Sarah, your AI dental receptionist. How may I assist you today?",
    emergency: "I understand this is a dental emergency. Let me help you right away. Can you briefly describe what happened?",
    appointment: "I'd be happy to help you schedule an appointment. May I have your name and preferred date and time?",
    followUp: "Is there anything else I can help you with today?"
  },

  appointmentTypes: [
    { type: 'Regular Checkup', duration: 30, description: 'Routine dental examination and cleaning' },
    { type: 'Emergency', duration: 45, description: 'Urgent dental care for pain or trauma' },
    { type: 'Consultation', duration: 20, description: 'Initial consultation for treatment planning' },
    { type: 'Filling', duration: 60, description: 'Cavity filling procedure' },
    { type: 'Root Canal', duration: 90, description: 'Root canal treatment' },
    { type: 'Extraction', duration: 45, description: 'Tooth extraction procedure' },
    { type: 'Crown/Bridge', duration: 60, description: 'Crown or bridge fitting' },
    { type: 'Orthodontic', duration: 30, description: 'Braces adjustment or consultation' }
  ]
};

export class DentalAIAgent {
  constructor() {
    this.currentContext = null;
    this.conversationHistory = [];
    this.patientInfo = {};
    this.appointmentState = {
      step: 'initial',
      details: {}
    };
  }

  processInput(transcript) {
    const lowerTranscript = transcript.toLowerCase();
    
    // Add to conversation history
    this.conversationHistory.push({ role: 'user', message: transcript });
    
    // Check for emergency keywords
    const emergencyKeywords = ['emergency', 'knocked out', 'bleeding', 'severe pain', 'broken', 'trauma', 'accident'];
    const isEmergency = emergencyKeywords.some(keyword => lowerTranscript.includes(keyword));
    
    if (isEmergency) {
      return this.handleEmergency(transcript);
    }
    
    // If we're in the middle of booking an appointment, continue that flow
    if (this.appointmentState.step !== 'initial') {
      return this.continueAppointmentFlow(transcript);
    }
    
    // Check for appointment-related keywords
    const appointmentKeywords = ['appointment', 'schedule', 'book', 'booking', 'available', 'opening', 'dental'];
    const isAppointment = appointmentKeywords.some(keyword => lowerTranscript.includes(keyword));
    
    if (isAppointment) {
      return this.handleAppointment(transcript);
    }
    
    // Default response
    return this.generateResponse(transcript);
  }

  extractAppointmentDetails(transcript) {
    const details = {};
    const lowerTranscript = transcript.toLowerCase();
    
    // Extract month names
    const months = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
    months.forEach((month, index) => {
      if (lowerTranscript.includes(month)) {
        details.month = month;
        details.monthNum = index + 1;
      }
    });
    
    // Extract day names
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    days.forEach(day => {
      if (lowerTranscript.includes(day)) {
        details.dayOfWeek = day;
      }
    });
    
    // Extract date numbers
    const dateMatch = transcript.match(/\b([1-9]|[12][0-9]|3[01])(st|nd|rd|th)?\b/);
    if (dateMatch) {
      details.date = parseInt(dateMatch[1]);
    }
    
    // Extract time
    const timeMatch = transcript.match(/\b(\d{1,2}):?(\d{2})?\s*(am|pm|AM|PM)?\b/);
    if (timeMatch) {
      details.time = timeMatch[0];
    }
    
    // Extract service type
    if (lowerTranscript.includes('cleaning')) details.service = 'cleaning';
    else if (lowerTranscript.includes('checkup')) details.service = 'checkup';
    else if (lowerTranscript.includes('filling')) details.service = 'filling';
    else if (lowerTranscript.includes('dental')) details.service = 'general dental';
    else if (lowerTranscript.includes('teeth')) details.service = 'dental care';
    
    return details;
  }

  continueAppointmentFlow(transcript) {
    // Extract any new details from this message
    const newDetails = this.extractAppointmentDetails(transcript);
    this.appointmentState.details = { ...this.appointmentState.details, ...newDetails };
    
    const hasDate = this.appointmentState.details.date || 
                   this.appointmentState.details.dayOfWeek || 
                   this.appointmentState.details.month;
    const hasTime = this.appointmentState.details.time;
    const hasService = this.appointmentState.details.service;
    
    // Progress through appointment booking steps
    if (!hasDate) {
      this.appointmentState.step = 'collecting_date';
      return {
        response: "What date would work best for your appointment? You can say something like 'Monday' or 'December 15th'.",
        type: 'appointment',
        step: 'collecting_date'
      };
    } else if (!hasTime) {
      this.appointmentState.step = 'collecting_time';
      const dateStr = this.appointmentState.details.dayOfWeek || 
                     `${this.appointmentState.details.month || ''} ${this.appointmentState.details.date || ''}`.trim();
      return {
        response: `Great! I have ${dateStr} available. What time would you prefer? We have openings from 9 AM to 5 PM.`,
        type: 'appointment',
        step: 'collecting_time'
      };
    } else if (!hasService) {
      this.appointmentState.step = 'collecting_service';
      return {
        response: "What type of appointment do you need? We offer cleanings, checkups, fillings, and other dental services.",
        type: 'appointment',
        step: 'collecting_service'
      };
    } else {
      // We have all the details - confirm the appointment
      const dateStr = this.appointmentState.details.dayOfWeek || 
                     `${this.appointmentState.details.month || ''} ${this.appointmentState.details.date || ''}`.trim();
      
      // Reset state for next appointment
      this.appointmentState = { step: 'initial', details: {} };
      
      return {
        response: `Perfect! I've scheduled your ${this.appointmentState.details.service} appointment for ${dateStr} at ${this.appointmentState.details.time}. We'll send you a confirmation email shortly. Please arrive 10 minutes early for any necessary paperwork. Is there anything else I can help you with?`,
        type: 'appointment_confirmed',
        appointmentDetails: this.appointmentState.details
      };
    }
  }

  handleEmergency(transcript) {
    // Identify the type of emergency
    for (const scenario of dentalTraumaGuide.scenarios) {
      const keywords = scenario.condition.toLowerCase().split(' ');
      if (keywords.some(keyword => transcript.toLowerCase().includes(keyword))) {
        return {
          response: `I understand you have ${scenario.condition}. ${scenario.questions[0]}`,
          scenario: scenario,
          type: 'emergency',
          urgency: scenario.instructions.urgency
        };
      }
    }
    
    return {
      response: dentalTraumaGuide.greetings.emergency,
      type: 'emergency'
    };
  }

  handleAppointment(transcript) {
    // Start appointment flow
    this.appointmentState.step = 'collecting_info';
    
    // Extract any details already mentioned
    const details = this.extractAppointmentDetails(transcript);
    this.appointmentState.details = details;
    
    // Continue the flow based on what we have
    return this.continueAppointmentFlow(transcript);
  }

  generateResponse(transcript) {
    // Basic conversational responses
    const responses = {
      greeting: ['hello', 'hi', 'hey', 'good morning', 'good afternoon'],
      thanks: ['thank you', 'thanks', 'appreciate'],
      goodbye: ['bye', 'goodbye', 'see you', 'take care'],
      okay: ['okay', 'ok', 'alright', 'sure']
    };
    
    const lowerTranscript = transcript.toLowerCase();
    
    if (responses.greeting.some(g => lowerTranscript.includes(g))) {
      return {
        response: dentalTraumaGuide.greetings.initial,
        type: 'greeting'
      };
    }
    
    if (responses.thanks.some(t => lowerTranscript.includes(t))) {
      return {
        response: "You're welcome! Is there anything else I can help you with?",
        type: 'acknowledgment'
      };
    }
    
    if (responses.goodbye.some(g => lowerTranscript.includes(g))) {
      return {
        response: "Thank you for calling SmileCare Dental. Have a great day and take care of your smile!",
        type: 'goodbye'
      };
    }
    
    if (responses.okay.some(o => lowerTranscript.includes(o))) {
      // If user just says okay, check if we're in a flow
      if (this.appointmentState.step !== 'initial') {
        return this.continueAppointmentFlow(transcript);
      }
      return {
        response: "How can I help you today? Would you like to schedule an appointment?",
        type: 'general'
      };
    }
    
    return {
      response: "I can help you with scheduling appointments or dental emergencies. How may I assist you?",
      type: 'general'
    };
  }

  updateContext(context) {
    this.currentContext = context;
    this.conversationHistory.push(context);
  }

  getConversationSummary() {
    return {
      history: this.conversationHistory,
      patientInfo: this.patientInfo,
      lastContext: this.currentContext
    };
  }
}

export default DentalAIAgent;