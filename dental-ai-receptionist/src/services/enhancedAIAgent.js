class EnhancedAIAgent {
  constructor() {
    this.conversationContext = {
      patientName: null,
      patientPhone: null,
      appointmentType: null,
      preferredTime: null,
      isEmergency: false,
      symptoms: [],
      insuranceInfo: null,
      language: 'en',
      conversationStage: 'greeting'
    };

    this.languages = {
      en: {
        greeting: "Thank you for calling SmileCare Dental. This is your AI receptionist. How may I assist you today?",
        emergency: "I understand this is an emergency. Can you describe your symptoms?",
        booking: "I'd be happy to help you schedule an appointment. May I have your name please?",
        confirmation: "Perfect! I've scheduled your appointment for {date} at {time}. You'll receive a confirmation text shortly.",
        farewell: "Thank you for calling SmileCare Dental. Have a wonderful day!"
      },
      es: {
        greeting: "Gracias por llamar a SmileCare Dental. Soy su recepcionista de IA. ¿Cómo puedo ayudarle hoy?",
        emergency: "Entiendo que es una emergencia. ¿Puede describir sus síntomas?",
        booking: "Me encantaría ayudarle a programar una cita. ¿Puedo tener su nombre por favor?",
        confirmation: "¡Perfecto! He programado su cita para {date} a las {time}. Recibirá un mensaje de confirmación pronto.",
        farewell: "Gracias por llamar a SmileCare Dental. ¡Que tenga un día maravilloso!"
      },
      zh: {
        greeting: "感谢您致电SmileCare牙科诊所。我是您的AI接待员。今天我能为您做什么？",
        emergency: "我了解这是紧急情况。您能描述一下您的症状吗？",
        booking: "我很乐意帮您安排预约。请问您的姓名是？",
        confirmation: "完美！我已为您安排了{date}{time}的预约。您很快会收到确认短信。",
        farewell: "感谢您致电SmileCare牙科诊所。祝您有美好的一天！"
      }
    };

    this.emergencyKeywords = [
      'emergency', 'urgent', 'severe pain', 'bleeding', 'swelling', 'broken tooth',
      'knocked out', 'abscess', 'infection', 'can\'t eat', 'can\'t sleep',
      'emergencia', 'dolor severo', 'sangrado', 'hinchazón',
      '紧急', '剧痛', '出血', '肿胀'
    ];

    this.appointmentTypes = {
      'checkup': { duration: 30, description: 'Regular dental checkup and cleaning' },
      'cleaning': { duration: 45, description: 'Professional teeth cleaning' },
      'filling': { duration: 60, description: 'Cavity filling procedure' },
      'extraction': { duration: 45, description: 'Tooth extraction' },
      'root canal': { duration: 90, description: 'Root canal treatment' },
      'crown': { duration: 60, description: 'Crown fitting and adjustment' },
      'whitening': { duration: 60, description: 'Professional teeth whitening' },
      'consultation': { duration: 30, description: 'General consultation' },
      'emergency': { duration: 45, description: 'Emergency dental care' }
    };

    this.nlpPatterns = {
      greeting: /^(hi|hello|hey|good\s+(morning|afternoon|evening)|hola|你好)/i,
      appointment: /(appointment|schedule|book|visit|come in|see.*dentist|cita|预约)/i,
      emergency: new RegExp(this.emergencyKeywords.join('|'), 'i'),
      time: /(\d{1,2}:\d{2}|\d{1,2}\s*(am|pm)|morning|afternoon|evening|tomorrow|today|monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i,
      phone: /(\d{3}[-.\s]?\d{3}[-.\s]?\d{4}|\(\d{3}\)\s*\d{3}[-.\s]?\d{4})/,
      name: /(?:my name is|i'm|i am|this is|call me)\s+([a-z]+(?:\s+[a-z]+)?)/i,
      insurance: /(insurance|coverage|plan|delta|aetna|cigna|united|blue cross)/i,
      cancel: /(cancel|reschedule|change|move)/i,
      symptom: /(pain|ache|hurt|sensitive|bleeding|swollen|broken|cavity|toothache)/i
    };
  }

  processInput(transcript) {
    const input = transcript.toLowerCase().trim();
    let response = {};

    // Detect language
    if (input.includes('español') || input.includes('spanish')) {
      this.conversationContext.language = 'es';
    } else if (input.includes('中文') || input.includes('chinese')) {
      this.conversationContext.language = 'zh';
    }

    // Check for emergency
    if (this.nlpPatterns.emergency.test(input)) {
      this.conversationContext.isEmergency = true;
      this.conversationContext.conversationStage = 'emergency';
      return this.handleEmergency(input);
    }

    // Route based on conversation stage
    switch (this.conversationContext.conversationStage) {
      case 'greeting':
        return this.handleGreeting(input);
      case 'collecting_name':
        return this.handleNameCollection(input);
      case 'collecting_phone':
        return this.handlePhoneCollection(input);
      case 'selecting_service':
        return this.handleServiceSelection(input);
      case 'selecting_time':
        return this.handleTimeSelection(input);
      case 'confirming':
        return this.handleConfirmation(input);
      case 'emergency':
        return this.handleEmergencyDetails(input);
      default:
        return this.handleGeneral(input);
    }
  }

  handleGreeting(input) {
    if (this.nlpPatterns.appointment.test(input)) {
      this.conversationContext.conversationStage = 'collecting_name';
      return {
        response: "I'd be happy to help you schedule an appointment. May I have your full name, please?",
        action: 'collect_info',
        nextStep: 'name',
        language: this.conversationContext.language
      };
    }

    if (this.nlpPatterns.cancel.test(input)) {
      return {
        response: "I can help you with that. To cancel or reschedule your appointment, may I have your name and the appointment date?",
        action: 'modify_appointment',
        language: this.conversationContext.language
      };
    }

    return {
      response: this.languages[this.conversationContext.language].greeting,
      action: 'greeting',
      suggestions: [
        "Schedule an appointment",
        "Emergency dental care",
        "Ask about services",
        "Check appointment status"
      ],
      language: this.conversationContext.language
    };
  }

  handleNameCollection(input) {
    const nameMatch = input.match(this.nlpPatterns.name);
    if (nameMatch) {
      this.conversationContext.patientName = nameMatch[1];
    } else if (input.length > 2) {
      // Assume the entire input is the name if no pattern matches
      this.conversationContext.patientName = input;
    }

    if (this.conversationContext.patientName) {
      this.conversationContext.conversationStage = 'collecting_phone';
      return {
        response: `Thank you, ${this.conversationContext.patientName}. May I have your phone number for our records?`,
        action: 'collect_info',
        nextStep: 'phone',
        data: { name: this.conversationContext.patientName }
      };
    }

    return {
      response: "I didn't catch your name. Could you please tell me your full name?",
      action: 'collect_info',
      nextStep: 'name'
    };
  }

  handlePhoneCollection(input) {
    const phoneMatch = input.match(this.nlpPatterns.phone);
    if (phoneMatch) {
      this.conversationContext.patientPhone = phoneMatch[0];
      this.conversationContext.conversationStage = 'selecting_service';
      
      return {
        response: "Great! What type of dental service do you need? We offer checkups, cleanings, fillings, and more.",
        action: 'collect_info',
        nextStep: 'service',
        data: { phone: this.conversationContext.patientPhone },
        suggestions: Object.keys(this.appointmentTypes)
      };
    }

    return {
      response: "Please provide a valid phone number including area code.",
      action: 'collect_info',
      nextStep: 'phone'
    };
  }

  handleServiceSelection(input) {
    let selectedService = null;
    
    for (const [service, details] of Object.entries(this.appointmentTypes)) {
      if (input.includes(service)) {
        selectedService = service;
        break;
      }
    }

    if (selectedService) {
      this.conversationContext.appointmentType = selectedService;
      this.conversationContext.conversationStage = 'selecting_time';
      
      return {
        response: `Perfect! A ${selectedService} typically takes ${this.appointmentTypes[selectedService].duration} minutes. When would you prefer to come in? We have openings this week.`,
        action: 'collect_info',
        nextStep: 'time',
        data: { service: selectedService },
        suggestions: [
          "Tomorrow morning",
          "Tomorrow afternoon",
          "This Friday",
          "Next Monday"
        ]
      };
    }

    return {
      response: "What type of dental service do you need? For example: checkup, cleaning, filling, or consultation.",
      action: 'collect_info',
      nextStep: 'service',
      suggestions: Object.keys(this.appointmentTypes)
    };
  }

  handleTimeSelection(input) {
    const timeMatch = input.match(this.nlpPatterns.time);
    
    if (timeMatch) {
      this.conversationContext.preferredTime = timeMatch[0];
      this.conversationContext.conversationStage = 'confirming';
      
      // Generate a specific appointment time
      const appointmentDate = this.parseTimePreference(this.conversationContext.preferredTime);
      
      return {
        response: `I have an opening for a ${this.conversationContext.appointmentType} on ${appointmentDate.date} at ${appointmentDate.time}. Should I confirm this appointment for you?`,
        action: 'confirm_appointment',
        data: {
          name: this.conversationContext.patientName,
          phone: this.conversationContext.patientPhone,
          service: this.conversationContext.appointmentType,
          date: appointmentDate.date,
          time: appointmentDate.time
        }
      };
    }

    return {
      response: "When would you like to schedule your appointment? You can say things like 'tomorrow morning' or 'Friday at 2pm'.",
      action: 'collect_info',
      nextStep: 'time'
    };
  }

  handleConfirmation(input) {
    if (input.includes('yes') || input.includes('confirm') || input.includes('sounds good') || input.includes('perfect')) {
      const confirmationMessage = this.languages[this.conversationContext.language].confirmation
        .replace('{date}', 'tomorrow')
        .replace('{time}', '2:00 PM');
      
      return {
        response: confirmationMessage + " Is there anything else I can help you with?",
        action: 'appointment_confirmed',
        data: this.conversationContext,
        status: 'success'
      };
    }

    if (input.includes('no') || input.includes('change') || input.includes('different')) {
      this.conversationContext.conversationStage = 'selecting_time';
      return {
        response: "No problem. What time would work better for you?",
        action: 'collect_info',
        nextStep: 'time'
      };
    }

    return {
      response: "Should I confirm this appointment for you? Please say 'yes' to confirm or 'no' to choose a different time.",
      action: 'confirm_appointment'
    };
  }

  handleEmergency(input) {
    const symptoms = [];
    
    if (input.includes('pain')) symptoms.push('pain');
    if (input.includes('bleeding')) symptoms.push('bleeding');
    if (input.includes('swelling') || input.includes('swollen')) symptoms.push('swelling');
    if (input.includes('broken')) symptoms.push('broken tooth');
    
    this.conversationContext.symptoms = symptoms;
    
    return {
      response: "I understand this is an emergency. We take dental emergencies very seriously. Can you describe the location and severity of your symptoms? On a scale of 1-10, how would you rate your pain?",
      action: 'emergency_triage',
      priority: 'high',
      data: { symptoms },
      transferToHuman: true
    };
  }

  handleEmergencyDetails(input) {
    // Extract pain level
    const painMatch = input.match(/\b([0-9]|10)\b/);
    const painLevel = painMatch ? parseInt(painMatch[0]) : null;
    
    if (painLevel && painLevel >= 7) {
      return {
        response: "Given the severity of your symptoms, I'm marking this as urgent. Dr. Smith has been notified and can see you within the next hour. Please come to the clinic immediately. If the pain becomes unbearable, don't hesitate to visit the emergency room.",
        action: 'emergency_appointment',
        priority: 'critical',
        data: {
          symptoms: this.conversationContext.symptoms,
          painLevel,
          immediateAction: true
        }
      };
    }

    return {
      response: "I've noted your symptoms. We can schedule you for an urgent appointment today. In the meantime, you can take over-the-counter pain medication and apply a cold compress to reduce swelling. Would you like to come in this afternoon?",
      action: 'urgent_appointment',
      priority: 'high',
      data: {
        symptoms: this.conversationContext.symptoms,
        painLevel
      }
    };
  }

  handleGeneral(input) {
    // Handle general inquiries
    if (input.includes('hours') || input.includes('open')) {
      return {
        response: "We're open Monday through Friday from 9 AM to 5 PM, and Saturday from 9 AM to 2 PM. We're closed on Sundays.",
        action: 'information'
      };
    }

    if (input.includes('insurance')) {
      return {
        response: "We accept most major dental insurance plans including Delta Dental, Aetna, Cigna, and Blue Cross Blue Shield. Would you like to verify your specific coverage?",
        action: 'insurance_inquiry'
      };
    }

    if (input.includes('cost') || input.includes('price')) {
      return {
        response: "Our pricing varies depending on the service. A regular checkup is $150, cleaning is $200, and fillings start at $250. We offer payment plans for more extensive treatments. Would you like a detailed quote?",
        action: 'pricing_inquiry'
      };
    }

    return {
      response: "I'm here to help with appointments, emergencies, and general inquiries. How can I assist you today?",
      action: 'general',
      suggestions: [
        "Schedule appointment",
        "Emergency care",
        "Office hours",
        "Insurance information"
      ]
    };
  }

  parseTimePreference(timeString) {
    const now = new Date();
    let appointmentDate = new Date();
    
    if (timeString.includes('tomorrow')) {
      appointmentDate.setDate(now.getDate() + 1);
    } else if (timeString.includes('today')) {
      appointmentDate = now;
    } else if (timeString.includes('monday')) {
      appointmentDate.setDate(now.getDate() + ((1 - now.getDay() + 7) % 7 || 7));
    } else if (timeString.includes('friday')) {
      appointmentDate.setDate(now.getDate() + ((5 - now.getDay() + 7) % 7 || 7));
    }

    let time = '10:00 AM'; // Default time
    
    if (timeString.includes('morning')) {
      time = '9:00 AM';
    } else if (timeString.includes('afternoon')) {
      time = '2:00 PM';
    } else if (timeString.includes('evening')) {
      time = '4:00 PM';
    } else {
      const timeMatch = timeString.match(/(\d{1,2}):?(\d{2})?\s*(am|pm)/i);
      if (timeMatch) {
        time = timeMatch[0].toUpperCase();
      }
    }

    return {
      date: appointmentDate.toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      }),
      time: time,
      timestamp: appointmentDate.toISOString()
    };
  }

  reset() {
    this.conversationContext = {
      patientName: null,
      patientPhone: null,
      appointmentType: null,
      preferredTime: null,
      isEmergency: false,
      symptoms: [],
      insuranceInfo: null,
      language: 'en',
      conversationStage: 'greeting'
    };
  }

  getConversationSummary() {
    return {
      context: this.conversationContext,
      stage: this.conversationContext.conversationStage,
      isComplete: this.conversationContext.conversationStage === 'confirmed',
      requiresHumanIntervention: this.conversationContext.isEmergency
    };
  }
}

export default new EnhancedAIAgent();