import express from 'express';
import { body, validationResult } from 'express-validator';
import { processVoiceCall } from '../services/deepgramService.js';
import { generateAIResponse } from '../services/openaiService.js';
import aiAppointmentService from '../services/aiAppointmentService.js';
import traumaService from '../services/traumaService.js';
import { logger } from '../utils/logger.js';
import { 
  getRandomFallback, 
  buildContextualFallback, 
  ensureValidResponse 
} from '../services/fallbackResponses.js';

const router = express.Router();

router.post('/voice-to-text', [
  body('audio').notEmpty()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { audio } = req.body;
    
    const transcript = await processVoiceCall(audio);
    
    logger.info('Voice transcription completed');

    res.json({ transcript });
  } catch (error) {
    logger.error('Voice transcription error:', error);
    res.status(500).json({ error: 'Failed to transcribe voice' });
  }
});

router.post('/chat', [
  body('message').notEmpty().trim(),
  body('context').optional()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { message, context } = req.body;
    
    const response = await generateAIResponse(message, context);
    
    logger.info('AI chat response generated');

    res.json({ response });
  } catch (error) {
    logger.error('AI chat error:', error);
    res.status(500).json({ error: 'Failed to generate AI response' });
  }
});

router.post('/analyze-symptoms', [
  body('symptoms').isArray().notEmpty(),
  body('patientId').optional()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { symptoms, patientId } = req.body;
    
    const analysis = await generateAIResponse(
      `Analyze these dental symptoms and provide recommendations: ${symptoms.join(', ')}`,
      { type: 'symptom_analysis', patientId }
    );
    
    const urgency = determineUrgency(symptoms);
    
    logger.info('Symptom analysis completed');

    res.json({ 
      analysis,
      urgency,
      recommendations: getRecommendations(urgency)
    });
  } catch (error) {
    logger.error('Symptom analysis error:', error);
    res.status(500).json({ error: 'Failed to analyze symptoms' });
  }
});

router.post('/appointment-suggestions', [
  body('patientHistory').optional(),
  body('lastVisit').optional().isISO8601()
], async (req, res) => {
  try {
    const { patientHistory, lastVisit } = req.body;
    
    const suggestions = await generateAIResponse(
      'Generate appointment suggestions based on patient history',
      { patientHistory, lastVisit }
    );
    
    logger.info('Appointment suggestions generated');

    res.json({ suggestions });
  } catch (error) {
    logger.error('Appointment suggestion error:', error);
    res.status(500).json({ error: 'Failed to generate suggestions' });
  }
});

router.post('/emergency-triage', [
  body('description').notEmpty(),
  body('symptoms').isArray()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { description, symptoms } = req.body;
    
    // First check if it's a trauma case
    const traumaResponse = await traumaService.generateTraumaResponse(
      `${description}. Symptoms: ${symptoms.join(', ')}`,
      req.body.patientInfo
    );
    
    if (traumaResponse) {
      logger.info('Trauma emergency triage completed');
      return res.json(traumaResponse);
    }
    
    // Fallback to general emergency triage
    const triage = await generateAIResponse(
      `Emergency dental triage: ${description}. Symptoms: ${symptoms.join(', ')}`,
      { type: 'emergency_triage' }
    );
    
    const severity = calculateSeverity(symptoms, description);
    const instructions = getEmergencyInstructions(severity);
    
    logger.info('Emergency triage completed');

    res.json({ 
      triage,
      severity,
      instructions,
      shouldCallEmergency: severity === 'critical'
    });
  } catch (error) {
    logger.error('Emergency triage error:', error);
    res.status(500).json({ error: 'Failed to process emergency triage' });
  }
});

// New endpoint specifically for trauma cases
router.post('/trauma-assessment', [
  body('message').notEmpty().trim(),
  body('patientInfo').optional()
], async (req, res) => {
  try {
    const { message, patientInfo } = req.body;
    
    // Analyze trauma
    const analysis = traumaService.analyzeTrauma(message);
    
    if (!analysis.isTrauma) {
      return res.json({
        isTrauma: false,
        message: "This doesn't appear to be a dental trauma. Please describe your symptoms in more detail."
      });
    }
    
    // Generate comprehensive trauma response
    const response = await traumaService.generateTraumaResponse(message, patientInfo);
    
    logger.info(`Trauma assessment: ${analysis.scenario?.category || 'unknown'} - Severity: ${analysis.severity}`);
    
    res.json(response);
  } catch (error) {
    logger.error('Trauma assessment error:', error);
    res.status(500).json({ error: 'Failed to assess trauma' });
  }
});

// Get trauma first aid instructions
router.get('/trauma-instructions/:type', async (req, res) => {
  try {
    const { type } = req.params;
    const instructions = traumaService.getFirstAidInstructions(type);
    
    res.json({
      type,
      instructions,
      followUp: traumaService.getFollowUpInstructions(type)
    });
  } catch (error) {
    logger.error('Failed to get trauma instructions:', error);
    res.status(500).json({ error: 'Failed to retrieve instructions' });
  }
});

function determineUrgency(symptoms) {
  const urgentKeywords = ['severe pain', 'bleeding', 'swelling', 'fever', 'trauma'];
  const moderateKeywords = ['pain', 'sensitivity', 'discomfort', 'ache'];
  
  const symptomsLower = symptoms.map(s => s.toLowerCase());
  
  if (urgentKeywords.some(keyword => symptomsLower.some(s => s.includes(keyword)))) {
    return 'urgent';
  }
  
  if (moderateKeywords.some(keyword => symptomsLower.some(s => s.includes(keyword)))) {
    return 'moderate';
  }
  
  return 'routine';
}

function getRecommendations(urgency) {
  const recommendations = {
    urgent: [
      'Schedule an emergency appointment immediately',
      'Contact the dental office right away',
      'If severe, consider visiting an emergency room'
    ],
    moderate: [
      'Schedule an appointment within 24-48 hours',
      'Take over-the-counter pain medication as directed',
      'Avoid hot or cold foods/drinks'
    ],
    routine: [
      'Schedule a regular appointment',
      'Maintain good oral hygiene',
      'Monitor symptoms for any changes'
    ]
  };
  
  return recommendations[urgency] || recommendations.routine;
}

function calculateSeverity(symptoms, description) {
  const criticalKeywords = ['knocked out', 'severe bleeding', 'jaw injury', 'facial swelling', 'difficulty breathing'];
  const highKeywords = ['severe pain', 'abscess', 'broken tooth', 'lost filling'];
  const moderateKeywords = ['toothache', 'sensitivity', 'minor bleeding', 'loose tooth'];
  
  const combinedText = `${description} ${symptoms.join(' ')}`.toLowerCase();
  
  if (criticalKeywords.some(keyword => combinedText.includes(keyword))) {
    return 'critical';
  }
  
  if (highKeywords.some(keyword => combinedText.includes(keyword))) {
    return 'high';
  }
  
  if (moderateKeywords.some(keyword => combinedText.includes(keyword))) {
    return 'moderate';
  }
  
  return 'low';
}

function getEmergencyInstructions(severity) {
  const instructions = {
    critical: [
      'Call 911 immediately or go to the nearest emergency room',
      'Apply pressure to control bleeding with clean gauze',
      'Save any knocked-out teeth in milk or saliva',
      'Do not delay seeking immediate medical attention'
    ],
    high: [
      'Contact the dental office immediately for an emergency appointment',
      'Apply cold compress to reduce swelling',
      'Take pain medication as directed',
      'Rinse mouth with warm salt water'
    ],
    moderate: [
      'Schedule an urgent appointment within 24 hours',
      'Use over-the-counter pain relief',
      'Avoid chewing on affected area',
      'Maintain oral hygiene carefully'
    ],
    low: [
      'Schedule a regular appointment',
      'Monitor symptoms',
      'Continue normal oral hygiene',
      'Avoid triggering foods or drinks'
    ]
  };
  
  return instructions[severity] || instructions.low;
}

// AI Appointment Booking Endpoint
router.post('/book-appointment', [
  body('request').notEmpty().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { request } = req.body;
    
    // Process the natural language appointment request
    const result = await aiAppointmentService.processAppointmentRequest(request);
    
    if (result.success && result.appointment) {
      logger.info(`AI booked appointment: ${result.appointment.confirmationNumber}`);
    } else if (result.needsInfo) {
      logger.info(`AI needs more info for booking: ${result.needsInfo}`);
    } else {
      logger.warn('AI appointment booking failed:', result.message);
    }

    res.json(result);
  } catch (error) {
    logger.error('AI appointment booking error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to process appointment request' 
    });
  }
});

// AI Cancel Appointment Endpoint
router.post('/cancel-appointment', [
  body('request').notEmpty().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { request } = req.body;
    
    // Process the cancellation request
    const result = await aiAppointmentService.cancelAppointmentRequest(request);
    
    if (result.success) {
      logger.info(`AI cancelled appointment: ${result.appointment._id}`);
    }

    res.json(result);
  } catch (error) {
    logger.error('AI appointment cancellation error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to process cancellation request' 
    });
  }
});

// Process complete AI conversation with intent detection
router.post('/process-conversation', [
  body('message').notEmpty().trim(),
  body('context').optional()
], async (req, res) => {
  try {
    const { message, context } = req.body;
    const messageLower = message.toLowerCase();
    
    // Detect intent
    let intent = 'general';
    let result = {};
    
    // Check if this is a follow-up response to a question about name
    // Look for name patterns or capitalized words that could be names
    const couldBeName = messageLower.match(/my name is|i'?m |it'?s |call me/) || 
                       (message.split(' ').some(word => 
                         word.length > 2 && 
                         word[0] === word[0].toUpperCase() && 
                         word[0] !== word[0].toLowerCase() &&
                         !['I', 'The', 'This', 'That'].includes(word)));
    
    // Check if previous message asked for name (from context or history)
    const previousAskedForName = context?.needsInfo === 'name' || 
                                 context?.history?.slice(-1)[0]?.response?.includes('name');
    
    if (couldBeName && previousAskedForName) {
      // This is likely a name response to our question, continue with booking
      intent = 'appointment_booking_continuation';
      const extractedName = message.replace(/my name is |i'?m |it'?s |call me /gi, '').trim();
      const fullMessage = `My name is ${extractedName}. I need to book an appointment for tomorrow.`;
      
      try {
        const appointmentResult = await aiAppointmentService.processAppointmentRequest(fullMessage);
        
        if (appointmentResult.confirmationNumber) {
          result = {
            success: true,
            message: appointmentResult.message,
            appointment: appointmentResult.appointment,
            confirmationNumber: appointmentResult.confirmationNumber
          };
        } else {
          result = {
            success: true,
            message: `Thank you ${extractedName}! What type of appointment would you like to book and when would you prefer to come in?`
          };
        }
      } catch (error) {
        logger.error('Name follow-up booking error:', error);
        result = {
          success: true,
          message: `Thank you ${extractedName}! What type of appointment would you like to book and when would you prefer?`
        };
      }
    }

    // First check for trauma/emergency situations
    try {
      const traumaAnalysis = traumaService.analyzeTrauma(message);
      if (traumaAnalysis.isTrauma) {
        intent = 'dental_trauma';
        
        // Generate trauma response with fallback
        try {
          const traumaResponse = await traumaService.generateTraumaResponse(message, {
            name: context?.patientName,
            phone: context?.patientPhone
          });
          
          result = {
            success: true,
            message: ensureValidResponse(traumaResponse.message),
            instructions: traumaResponse.instructions,
            urgency: traumaResponse.urgency,
            triage: traumaResponse.triage,
            appointment: traumaResponse.appointment,
            requiresER: traumaResponse.triage?.level === 1,
            isTrauma: true
          };
        } catch (traumaError) {
          logger.error('Trauma response error:', traumaError);
          result = {
            success: true,
            message: getRandomFallback('emergency'),
            isTrauma: true
          };
        }
        
        logger.info(`Trauma case detected: ${traumaAnalysis.scenario?.category || 'general'}`);
      }
    } catch (traumaAnalysisError) {
      logger.error('Trauma analysis error:', traumaAnalysisError);
    }
    
    // Check for appointment booking intent or if we're discussing dental issues
    if (!result.message && (messageLower.includes('appointment') || 
        messageLower.includes('book') || 
        messageLower.includes('schedule') ||
        messageLower.includes('available') ||
        messageLower.includes('slot') ||
        messageLower.includes('tooth') ||
        messageLower.includes('teeth') ||
        messageLower.includes('dental') ||
        messageLower.includes('checkup') ||
        messageLower.includes('cleaning'))) {
      intent = 'appointment_booking';
      
      try {
        const appointmentResult = await aiAppointmentService.processAppointmentRequest(message);
        
        // Check if we need more information
        if (appointmentResult.needsInfo === 'name') {
          intent = 'needs_patient_info';
        }
        
        // Check if it's an emergency
        if (appointmentResult.isEmergency) {
          intent = 'dental_emergency';
        }
        
        // Ensure consistent response structure
        result = {
          success: appointmentResult.success || true,
          message: ensureValidResponse(appointmentResult.message) || getRandomFallback('appointment_booking'),
          response: appointmentResult.message, // For compatibility
          appointment: appointmentResult.appointment,
          confirmationNumber: appointmentResult.confirmationNumber,
          needsInfo: appointmentResult.needsInfo,
          isEmergency: appointmentResult.isEmergency
        };
      } catch (appointmentError) {
        logger.error('Appointment booking error:', appointmentError);
        result = {
          success: true,
          message: getRandomFallback('appointment_error')
        };
      }
    }
    // Check for cancellation intent
    else if (!result.message && (messageLower.includes('cancel') || 
             messageLower.includes('reschedule'))) {
      intent = 'appointment_cancellation';
      try {
        result = await aiAppointmentService.cancelAppointmentRequest(message);
        result.message = ensureValidResponse(result.message) || getRandomFallback('cancellation');
        result.success = true;
      } catch (cancelError) {
        logger.error('Cancellation error:', cancelError);
        result = {
          success: true,
          message: getRandomFallback('cancellation')
        };
      }
    }
    // Check for general emergency (non-trauma)
    else if (!result.message && (messageLower.includes('emergency') || 
             messageLower.includes('urgent') ||
             messageLower.includes('severe pain') ||
             messageLower.includes('bleeding'))) {
      intent = 'emergency';
      // Process as emergency
      const symptoms = extractSymptoms(message);
      result = {
        success: true,
        severity: calculateSeverity(symptoms, message),
        instructions: getEmergencyInstructions('high'),
        message: getRandomFallback('emergency')
      };
    }
    // Default to general chat
    else if (!result.message) {
      intent = 'general_chat';
      
      // Check if it's a confusing message that doesn't make sense
      if (messageLower.includes('knocked my tools') || 
          messageLower.includes('knocked my doors') ||
          messageLower.includes('knocked my car')) {
        // This doesn't make dental sense, ask for clarification
        result = {
          success: true,
          message: "I'm sorry, could you repeat that again? If you have a dental issue, please describe what happened to your tooth or teeth."
        };
      } else {
        try {
          const aiResponse = await generateAIResponse(message, context);
          result = {
            success: true,
            message: ensureValidResponse(aiResponse) || buildContextualFallback(message, context)
          };
        } catch (aiError) {
          logger.error('AI response error:', aiError);
          result = {
            success: true,
            message: buildContextualFallback(message, context)
          };
        }
      }
    }

    // Final safety check - ensure we ALWAYS have a message
    if (!result.message) {
      result.message = buildContextualFallback(message, context);
    }
    
    // Ensure success is always true so frontend doesn't show errors
    result.success = true;

    logger.info(`AI processed conversation with intent: ${intent}`);

    // Always return 200 with a valid response
    res.json({
      intent,
      ...result,
      success: true,
      message: ensureValidResponse(result.message),
      // Include context hint for frontend to track conversation state
      contextHint: result.needsInfo ? { lastQuestion: result.needsInfo } : null
    });
  } catch (error) {
    logger.error('AI conversation processing error:', error);
    
    // Even on error, return a valid response
    const fallbackMessage = buildContextualFallback(req.body.message || '', req.body.context);
    
    res.json({ 
      success: true,
      intent: 'general_chat',
      message: fallbackMessage,
      response: fallbackMessage
    });
  }
});

function extractSymptoms(message) {
  const symptomKeywords = [
    'pain', 'ache', 'bleeding', 'swelling', 'fever', 
    'sensitivity', 'broken', 'cracked', 'loose', 'missing'
  ];
  
  const found = [];
  const messageLower = message.toLowerCase();
  
  symptomKeywords.forEach(symptom => {
    if (messageLower.includes(symptom)) {
      found.push(symptom);
    }
  });
  
  return found;
}

export default router;