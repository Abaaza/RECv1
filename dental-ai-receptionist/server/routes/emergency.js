import express from 'express';
import mongoose from 'mongoose';
import { body, validationResult } from 'express-validator';
import Emergency from '../models/Emergency.js';
import Patient from '../models/Patient.js';
import CallLog from '../models/CallLog.js';
import Notification from '../models/Notification.js';
import { logger } from '../utils/logger.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { io } from '../server.js';

const router = express.Router();

// Report emergency
router.post('/', [
  body('patientName').notEmpty().trim(),
  body('phoneNumber').notEmpty().trim(),
  body('emergencyType').isIn([
    'dental_trauma', 'severe_pain', 'bleeding', 'swelling',
    'infection', 'broken_tooth', 'lost_filling', 'jaw_injury', 'other'
  ]),
  body('symptoms').isArray(),
  body('painLevel').isNumeric().isInt({ min: 0, max: 10 }),
  body('onsetTime').isISO8601()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // Try to find patient by phone number
    let patient = await Patient.findOne({ phone: req.body.phoneNumber });
    
    // Calculate severity based on symptoms and pain level
    const severity = calculateEmergencySeverity(
      req.body.emergencyType,
      req.body.symptoms,
      req.body.painLevel
    );

    const emergency = new Emergency({
      ...req.body,
      patientId: patient?._id,
      severity,
      status: 'reported',
      reportedTime: new Date()
    });

    // Generate AI assessment
    emergency.aiAssessment = {
      confidence: 0.85,
      recommendedActions: getRecommendedActions(severity, req.body.emergencyType),
      riskFactors: identifyRiskFactors(req.body.symptoms),
      estimatedWaitTime: getEstimatedWaitTime(severity)
    };

    await emergency.save();

    // Create notification for staff (skip if no staff users exist)
    // In production, this would notify all on-duty staff
    const notification = new Notification({
      recipientId: new mongoose.Types.ObjectId(), // Placeholder for staff notification
      recipientModel: 'User',
      type: 'emergency',
      priority: severity === 'critical' ? 'urgent' : 'high',
      title: `Emergency: ${req.body.emergencyType.replace('_', ' ')}`,
      message: `${req.body.patientName} reported ${severity} emergency. Pain level: ${req.body.painLevel}/10`,
      data: {
        emergencyId: emergency._id,
        patientId: patient?._id
      },
      channels: ['in_app', 'push'],
      isAutomated: true
    });

    await notification.save();

    // Emit real-time notification
    io.emit('emergency:new', {
      emergency,
      notification
    });

    logger.info(`Emergency reported: ${emergency._id} - Severity: ${severity}`);
    res.json(emergency);
  } catch (error) {
    logger.error('Error reporting emergency:', error);
    res.status(500).json({ error: 'Failed to report emergency' });
  }
});

// Get active emergencies
router.get('/active', authenticate, async (req, res) => {
  try {
    const emergencies = await Emergency.getActiveEmergencies();
    res.json(emergencies);
  } catch (error) {
    logger.error('Error fetching active emergencies:', error);
    res.status(500).json({ error: 'Failed to fetch active emergencies' });
  }
});

// Get critical emergencies
router.get('/critical', authenticate, async (req, res) => {
  try {
    const emergencies = await Emergency.getCriticalEmergencies();
    res.json(emergencies);
  } catch (error) {
    logger.error('Error fetching critical emergencies:', error);
    res.status(500).json({ error: 'Failed to fetch critical emergencies' });
  }
});

// Get emergency by ID
router.get('/:id', authenticate, async (req, res) => {
  try {
    const emergency = await Emergency.findById(req.params.id)
      .populate('patientId')
      .populate('appointmentId')
      .populate('callLogId')
      .populate('resolution.resolvedBy', 'name');

    if (!emergency) {
      return res.status(404).json({ error: 'Emergency not found' });
    }

    res.json(emergency);
  } catch (error) {
    logger.error('Error fetching emergency:', error);
    res.status(500).json({ error: 'Failed to fetch emergency' });
  }
});

// Update emergency
router.put('/:id', [
  authenticate,
  authorize(['admin', 'dentist', 'specialist'])
], async (req, res) => {
  try {
    const emergency = await Emergency.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );

    if (!emergency) {
      return res.status(404).json({ error: 'Emergency not found' });
    }

    // Emit update
    io.emit('emergency:updated', emergency);

    logger.info(`Emergency updated: ${emergency._id}`);
    res.json(emergency);
  } catch (error) {
    logger.error('Error updating emergency:', error);
    res.status(500).json({ error: 'Failed to update emergency' });
  }
});

// Update severity
router.put('/:id/severity', [
  authenticate,
  authorize(['admin', 'dentist', 'specialist']),
  body('severity').isIn(['low', 'moderate', 'high', 'critical']),
  body('notes').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const emergency = await Emergency.findById(req.params.id);
    
    if (!emergency) {
      return res.status(404).json({ error: 'Emergency not found' });
    }

    await emergency.updateSeverity(req.body.severity, req.body.notes);

    // Emit severity change
    io.emit('emergency:severity_changed', {
      emergencyId: emergency._id,
      severity: req.body.severity
    });

    logger.info(`Emergency severity updated: ${emergency._id} to ${req.body.severity}`);
    res.json(emergency);
  } catch (error) {
    logger.error('Error updating severity:', error);
    res.status(500).json({ error: 'Failed to update severity' });
  }
});

// Add instruction
router.post('/:id/instructions', [
  authenticate,
  authorize(['admin', 'dentist', 'specialist']),
  body('instruction').notEmpty().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const emergency = await Emergency.findById(req.params.id);
    
    if (!emergency) {
      return res.status(404).json({ error: 'Emergency not found' });
    }

    await emergency.addInstruction(req.body.instruction, req.user?.profile?.firstName || req.user?.email || 'System');

    logger.info(`Instruction added to emergency: ${emergency._id}`);
    res.json(emergency);
  } catch (error) {
    logger.error('Error adding instruction:', error);
    res.status(500).json({ error: 'Failed to add instruction' });
  }
});

// Add immediate action
router.post('/:id/actions', [
  authenticate,
  authorize(['admin', 'dentist', 'specialist']),
  body('action').notEmpty().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const emergency = await Emergency.findById(req.params.id);
    
    if (!emergency) {
      return res.status(404).json({ error: 'Emergency not found' });
    }

    await emergency.addImmediateAction(req.body.action, req.user?.profile?.firstName || req.user?.email || 'System');

    logger.info(`Action added to emergency: ${emergency._id}`);
    res.json(emergency);
  } catch (error) {
    logger.error('Error adding action:', error);
    res.status(500).json({ error: 'Failed to add action' });
  }
});

// Resolve emergency
router.put('/:id/resolve', [
  authenticate,
  authorize(['admin', 'dentist', 'specialist']),
  body('treatmentProvided').notEmpty().trim(),
  body('followUpRequired').isBoolean(),
  body('followUpDate').optional().isISO8601()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const emergency = await Emergency.findById(req.params.id);
    
    if (!emergency) {
      return res.status(404).json({ error: 'Emergency not found' });
    }

    const { treatmentProvided, followUpRequired, followUpDate } = req.body;
    
    await emergency.resolve(
      req.user.id,
      treatmentProvided,
      followUpRequired,
      followUpDate
    );

    // Emit resolution
    io.emit('emergency:resolved', {
      emergencyId: emergency._id,
      resolvedBy: req.user?.profile?.firstName || req.user?.email || 'System'
    });

    logger.info(`Emergency resolved: ${emergency._id}`);
    res.json(emergency);
  } catch (error) {
    logger.error('Error resolving emergency:', error);
    res.status(500).json({ error: 'Failed to resolve emergency' });
  }
});

// Refer emergency
router.put('/:id/refer', [
  authenticate,
  authorize(['admin', 'dentist', 'specialist']),
  body('referredTo').notEmpty().trim(),
  body('reason').notEmpty().trim(),
  body('contactInfo').notEmpty().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const emergency = await Emergency.findById(req.params.id);
    
    if (!emergency) {
      return res.status(404).json({ error: 'Emergency not found' });
    }

    const { referredTo, reason, contactInfo } = req.body;
    
    await emergency.refer(referredTo, reason, contactInfo);

    logger.info(`Emergency referred: ${emergency._id} to ${referredTo}`);
    res.json(emergency);
  } catch (error) {
    logger.error('Error referring emergency:', error);
    res.status(500).json({ error: 'Failed to refer emergency' });
  }
});

// Get emergency statistics
router.get('/stats/overview', authenticate, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const start = startDate ? new Date(startDate) : null;
    const end = endDate ? new Date(endDate) : null;

    const stats = await Emergency.getEmergencyStats(start, end);
    const avgResponseTime = await Emergency.getAverageResponseTime(start, end);

    res.json({
      ...stats,
      avgResponseTime
    });
  } catch (error) {
    logger.error('Error fetching emergency statistics:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// Helper functions
function calculateEmergencySeverity(type, symptoms, painLevel) {
  // Critical conditions
  if (type === 'jaw_injury' || symptoms.includes('difficulty breathing')) {
    return 'critical';
  }
  
  // High severity
  if (painLevel >= 8 || 
      type === 'dental_trauma' || 
      symptoms.includes('severe bleeding') ||
      symptoms.includes('facial swelling')) {
    return 'high';
  }
  
  // Moderate severity
  if (painLevel >= 5 || 
      type === 'infection' || 
      symptoms.includes('swelling')) {
    return 'moderate';
  }
  
  return 'low';
}

function getRecommendedActions(severity, type) {
  const actions = {
    critical: [
      'Immediate emergency room visit required',
      'Call 911 if difficulty breathing',
      'Apply direct pressure to control bleeding',
      'Do not delay seeking medical attention'
    ],
    high: [
      'Seek immediate dental care',
      'Apply cold compress to reduce swelling',
      'Take prescribed pain medication',
      'Rinse with warm salt water if bleeding'
    ],
    moderate: [
      'Schedule urgent appointment within 24 hours',
      'Use over-the-counter pain relief',
      'Avoid hot/cold foods',
      'Maintain oral hygiene carefully'
    ],
    low: [
      'Schedule regular appointment',
      'Monitor symptoms',
      'Use pain relief as needed',
      'Continue normal oral care'
    ]
  };

  return actions[severity] || actions.low;
}

function identifyRiskFactors(symptoms) {
  const riskFactors = [];
  
  if (symptoms.includes('fever')) {
    riskFactors.push('Possible systemic infection');
  }
  if (symptoms.includes('swelling')) {
    riskFactors.push('Risk of abscess');
  }
  if (symptoms.includes('bleeding')) {
    riskFactors.push('Coagulation concerns');
  }
  if (symptoms.includes('numbness')) {
    riskFactors.push('Possible nerve involvement');
  }
  
  return riskFactors;
}

function getEstimatedWaitTime(severity) {
  const waitTimes = {
    critical: 0,
    high: 15,
    moderate: 30,
    low: 60
  };
  
  return waitTimes[severity] || 60;
}

export default router;