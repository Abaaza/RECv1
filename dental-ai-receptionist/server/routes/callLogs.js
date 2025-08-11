import express from 'express';
import { body, validationResult } from 'express-validator';
import CallLog from '../models/CallLog.js';
import Patient from '../models/Patient.js';
import { auth } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

// Get all call logs
router.get('/', auth, async (req, res) => {
  try {
    const { 
      startDate, 
      endDate, 
      patientId, 
      callType, 
      purpose, 
      resolution,
      limit = 50,
      offset = 0 
    } = req.query;
    
    const query = {};
    
    if (patientId) {
      query.patientId = patientId;
    }
    
    if (callType) {
      query.callType = callType;
    }
    
    if (purpose) {
      query.purpose = purpose;
    }
    
    if (resolution) {
      query.resolution = resolution;
    }
    
    if (startDate && endDate) {
      query.startTime = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const callLogs = await CallLog.find(query)
      .populate('patientId', 'name email phone')
      .populate('appointmentId', 'date time')
      .populate('transferredTo', 'name')
      .sort({ startTime: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(offset));

    const total = await CallLog.countDocuments(query);

    res.json({
      callLogs,
      total,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    logger.error('Error fetching call logs:', error);
    res.status(500).json({ error: 'Failed to fetch call logs' });
  }
});

// Get recent calls
router.get('/recent', auth, async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const recentCalls = await CallLog.getRecentCalls(parseInt(limit));
    res.json(recentCalls);
  } catch (error) {
    logger.error('Error fetching recent calls:', error);
    res.status(500).json({ error: 'Failed to fetch recent calls' });
  }
});

// Get missed calls
router.get('/missed', auth, async (req, res) => {
  try {
    const missedCalls = await CallLog.getMissedCalls();
    res.json(missedCalls);
  } catch (error) {
    logger.error('Error fetching missed calls:', error);
    res.status(500).json({ error: 'Failed to fetch missed calls' });
  }
});

// Get emergency calls
router.get('/emergency', auth, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const start = startDate ? new Date(startDate) : null;
    const end = endDate ? new Date(endDate) : null;
    
    const emergencyCalls = await CallLog.getEmergencyCalls(start, end);
    res.json(emergencyCalls);
  } catch (error) {
    logger.error('Error fetching emergency calls:', error);
    res.status(500).json({ error: 'Failed to fetch emergency calls' });
  }
});

// Create new call log
router.post('/', [
  body('phoneNumber').notEmpty().trim(),
  body('callType').isIn(['incoming', 'outgoing', 'missed']),
  body('purpose').optional().isIn([
    'appointment', 'inquiry', 'emergency', 'follow-up', 'reminder', 'other'
  ])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const callData = req.body;

    // Try to find patient by phone number
    const patient = await Patient.findOne({ phone: callData.phoneNumber });
    if (patient) {
      callData.patientId = patient._id;
      callData.patientName = patient.name;
    }

    const callLog = new CallLog(callData);
    await callLog.save();

    logger.info(`New call log created: ${callLog._id}`);
    res.status(201).json(callLog);
  } catch (error) {
    logger.error('Error creating call log:', error);
    res.status(500).json({ error: 'Failed to create call log' });
  }
});

// Update call log
router.put('/:id', auth, async (req, res) => {
  try {
    const callLog = await CallLog.findById(req.params.id);
    
    if (!callLog) {
      return res.status(404).json({ error: 'Call log not found' });
    }

    const updates = req.body;
    Object.keys(updates).forEach(key => {
      if (updates[key] !== undefined && key !== '_id') {
        callLog[key] = updates[key];
      }
    });

    await callLog.save();
    res.json(callLog);
  } catch (error) {
    logger.error('Error updating call log:', error);
    res.status(500).json({ error: 'Failed to update call log' });
  }
});

// End call
router.post('/:id/end', auth, async (req, res) => {
  try {
    const callLog = await CallLog.findById(req.params.id);
    
    if (!callLog) {
      return res.status(404).json({ error: 'Call log not found' });
    }

    await callLog.endCall();
    res.json(callLog);
  } catch (error) {
    logger.error('Error ending call:', error);
    res.status(500).json({ error: 'Failed to end call' });
  }
});

// Add follow-up
router.post('/:id/follow-up', [
  auth,
  body('date').isISO8601(),
  body('notes').optional().isString()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const callLog = await CallLog.findById(req.params.id);
    
    if (!callLog) {
      return res.status(404).json({ error: 'Call log not found' });
    }

    await callLog.addFollowUp(new Date(req.body.date), req.body.notes);
    res.json(callLog);
  } catch (error) {
    logger.error('Error adding follow-up:', error);
    res.status(500).json({ error: 'Failed to add follow-up' });
  }
});

// Get call statistics
router.get('/stats', auth, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const start = startDate ? new Date(startDate) : null;
    const end = endDate ? new Date(endDate) : null;

    const stats = await CallLog.getCallStats(start, end);

    // Get additional breakdown statistics
    const callTypeBreakdown = await CallLog.aggregate([
      {
        $match: start && end ? {
          startTime: { $gte: start, $lte: end }
        } : {}
      },
      {
        $group: {
          _id: '$callType',
          count: { $sum: 1 }
        }
      }
    ]);

    const purposeBreakdown = await CallLog.aggregate([
      {
        $match: start && end ? {
          startTime: { $gte: start, $lte: end }
        } : {}
      },
      {
        $group: {
          _id: '$purpose',
          count: { $sum: 1 }
        }
      }
    ]);

    const hourlyDistribution = await CallLog.aggregate([
      {
        $match: start && end ? {
          startTime: { $gte: start, $lte: end }
        } : {}
      },
      {
        $project: {
          hour: { $hour: '$startTime' }
        }
      },
      {
        $group: {
          _id: '$hour',
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.json({
      ...stats,
      callTypeBreakdown,
      purposeBreakdown,
      hourlyDistribution,
      missedCallRate: stats.totalCalls > 0 
        ? ((stats.missedCalls / stats.totalCalls) * 100).toFixed(2) 
        : 0,
      appointmentConversionRate: stats.totalCalls > 0 
        ? ((stats.appointmentsBooked / stats.totalCalls) * 100).toFixed(2) 
        : 0
    });
  } catch (error) {
    logger.error('Error fetching call statistics:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// Get calls requiring follow-up
router.get('/follow-ups', auth, async (req, res) => {
  try {
    const followUps = await CallLog.find({
      followUpRequired: true,
      resolution: { $ne: 'resolved' }
    })
    .populate('patientId', 'name email phone')
    .sort({ followUpDate: 1 });

    res.json(followUps);
  } catch (error) {
    logger.error('Error fetching follow-ups:', error);
    res.status(500).json({ error: 'Failed to fetch follow-ups' });
  }
});

export default router;