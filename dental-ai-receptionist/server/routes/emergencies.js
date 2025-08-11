import express from 'express';
import { body, validationResult } from 'express-validator';
import Emergency from '../models/Emergency.js';
import Patient from '../models/Patient.js';
import Appointment from '../models/Appointment.js';
import CallLog from '../models/CallLog.js';
import { auth } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';
import { io } from '../server.js';

const router = express.Router();

// Get all emergencies
router.get('/', auth, async (req, res) => {
  try {
    const { status, severity, startDate, endDate, patientId } = req.query;
    
    const query = {};
    
    if (status) {
      query.status = status;
    }
    
    if (severity) {
      query.severity = severity;
    }
    
    if (patientId) {
      query.patientId = patientId;
    }
    
    if (startDate && endDate) {
      query.reportedTime = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const emergencies = await Emergency.find(query)
      .populate('patientId', 'name phone email')
      .populate('appointmentId')
      .populate('resolution.resolvedBy', 'name')
      .sort({ severity: -1, reportedTime: -1 });

    res.json(emergencies);
  } catch (error) {
    logger.error('Error fetching emergencies:', error);
    res.status(500).json({ error: 'Failed to fetch emergencies' });
  }
});

// Get active emergencies
router.get('/active', auth, async (req, res) => {
  try {
    const emergencies = await Emergency.getActiveEmergencies();
    res.json(emergencies);
  } catch (error) {
    logger.error('Error fetching active emergencies:', error);
    res.status(500).json({ error: 'Failed to fetch active emergencies' });
  }
});

// Get critical emergencies
router.get('/critical', auth, async (req, res) => {
  try {
    const emergencies = await Emergency.getCriticalEmergencies();
    res.json(emergencies);
  } catch (error) {
    logger.error('Error fetching critical emergencies:', error);
    res.status(500).json({ error: 'Failed to fetch critical emergencies' });
  }
});

// Create new emergency
router.post('/', [
  body('patientName').notEmpty().trim(),
  body('phoneNumber').notEmpty().trim(),
  body('emergencyType').isIn([
    'dental_trauma', 'severe_pain', 'bleeding', 'swelling',
    'infection', 'broken_tooth', 'lost_filling', 'jaw_injury', 'other'
  ]),
  body('symptoms').isArray(),
  body('painLevel').isInt({ min: 0, max: 10 }),
  body('severity').isIn(['low', 'moderate', 'high', 'critical'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const emergencyData = req.body;

    // Try to find existing patient
    let patient = await Patient.findOne({ 
      $or: [
        { phone: emergencyData.phoneNumber },
        { name: emergencyData.patientName }
      ]
    });

    if (patient) {
      emergencyData.patientId = patient._id;
    }

    // Set onset time if not provided
    if (!emergencyData.onsetTime) {
      emergencyData.onsetTime = new Date();
    }

    const emergency = new Emergency(emergencyData);
    await emergency.save();

    // Emit real-time notification
    io.emit('emergency:new', {
      id: emergency._id,
      severity: emergency.severity,
      patientName: emergency.patientName,
      emergencyType: emergency.emergencyType,
      reportedTime: emergency.reportedTime
    });

    // Log high severity emergencies
    if (emergency.severity === 'critical' || emergency.severity === 'high') {
      logger.warn(`Critical/High emergency reported: ${emergency._id}`);
    }

    res.status(201).json(emergency);
  } catch (error) {
    logger.error('Error creating emergency:', error);
    res.status(500).json({ error: 'Failed to create emergency' });
  }
});

// Update emergency
router.put('/:id', auth, async (req, res) => {
  try {
    const emergency = await Emergency.findById(req.params.id);
    
    if (!emergency) {
      return res.status(404).json({ error: 'Emergency not found' });
    }

    const updates = req.body;
    Object.keys(updates).forEach(key => {
      if (updates[key] !== undefined) {
        emergency[key] = updates[key];
      }
    });

    await emergency.save();

    // Emit update notification
    io.emit('emergency:updated', {
      id: emergency._id,
      status: emergency.status,
      severity: emergency.severity
    });

    res.json(emergency);
  } catch (error) {
    logger.error('Error updating emergency:', error);
    res.status(500).json({ error: 'Failed to update emergency' });
  }
});

// Update severity
router.post('/:id/severity', [
  auth,
  body('severity').isIn(['low', 'moderate', 'high', 'critical']),
  body('notes').optional().isString()
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
    
    io.emit('emergency:severity_changed', {
      id: emergency._id,
      oldSeverity: emergency.severity,
      newSeverity: req.body.severity
    });

    res.json(emergency);
  } catch (error) {
    logger.error('Error updating emergency severity:', error);
    res.status(500).json({ error: 'Failed to update severity' });
  }
});

// Add instruction
router.post('/:id/instructions', [
  auth,
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

    await emergency.addInstruction(req.body.instruction, req.user.name);
    res.json(emergency);
  } catch (error) {
    logger.error('Error adding instruction:', error);
    res.status(500).json({ error: 'Failed to add instruction' });
  }
});

// Add immediate action
router.post('/:id/actions', [
  auth,
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

    await emergency.addImmediateAction(req.body.action, req.user.name);
    res.json(emergency);
  } catch (error) {
    logger.error('Error adding action:', error);
    res.status(500).json({ error: 'Failed to add action' });
  }
});

// Resolve emergency
router.post('/:id/resolve', [
  auth,
  body('treatmentProvided').notEmpty(),
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

    await emergency.resolve(
      req.user.id,
      req.body.treatmentProvided,
      req.body.followUpRequired,
      req.body.followUpDate ? new Date(req.body.followUpDate) : null
    );

    io.emit('emergency:resolved', {
      id: emergency._id
    });

    res.json(emergency);
  } catch (error) {
    logger.error('Error resolving emergency:', error);
    res.status(500).json({ error: 'Failed to resolve emergency' });
  }
});

// Refer emergency
router.post('/:id/refer', [
  auth,
  body('referredTo').notEmpty(),
  body('reason').notEmpty(),
  body('contactInfo').notEmpty()
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

    await emergency.refer(
      req.body.referredTo,
      req.body.reason,
      req.body.contactInfo
    );

    res.json(emergency);
  } catch (error) {
    logger.error('Error referring emergency:', error);
    res.status(500).json({ error: 'Failed to refer emergency' });
  }
});

// Get emergency statistics
router.get('/stats', auth, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const start = startDate ? new Date(startDate) : null;
    const end = endDate ? new Date(endDate) : null;

    const [stats, avgResponseTime] = await Promise.all([
      Emergency.getEmergencyStats(start, end),
      Emergency.getAverageResponseTime(start, end)
    ]);

    res.json({
      ...stats,
      avgResponseTime
    });
  } catch (error) {
    logger.error('Error fetching emergency stats:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

export default router;