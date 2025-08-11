import express from 'express';
import { body, validationResult } from 'express-validator';
import { processVoiceCall } from '../services/deepgramService.js';
import { generateAIResponse } from '../services/openaiService.js';
import aiAppointmentService from '../services/aiAppointmentService.js';
import { logger } from '../utils/logger.js';

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
    
    if (result.success) {
      logger.info(`AI booked appointment: ${result.appointment.confirmationNumber}`);
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

    // Check for appointment booking intent
    if (messageLower.includes('appointment') || 
        messageLower.includes('book') || 
        messageLower.includes('schedule') ||
        messageLower.includes('available') ||
        messageLower.includes('slot')) {
      intent = 'appointment_booking';
      result = await aiAppointmentService.processAppointmentRequest(message);
    }
    // Check for cancellation intent
    else if (messageLower.includes('cancel') || 
             messageLower.includes('reschedule')) {
      intent = 'appointment_cancellation';
      result = await aiAppointmentService.cancelAppointmentRequest(message);
    }
    // Check for emergency
    else if (messageLower.includes('emergency') || 
             messageLower.includes('urgent') ||
             messageLower.includes('severe pain') ||
             messageLower.includes('bleeding')) {
      intent = 'emergency';
      // Process as emergency
      const symptoms = extractSymptoms(message);
      result = {
        severity: calculateSeverity(symptoms, message),
        instructions: getEmergencyInstructions('high'),
        message: "I understand this is urgent. Let me help you right away."
      };
    }
    // Default to general chat
    else {
      intent = 'general_chat';
      const aiResponse = await generateAIResponse(message, context);
      result = {
        success: true,
        message: aiResponse
      };
    }

    logger.info(`AI processed conversation with intent: ${intent}`);

    res.json({
      intent,
      ...result
    });
  } catch (error) {
    logger.error('AI conversation processing error:', error);
    res.status(500).json({ 
      error: 'Failed to process conversation' 
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