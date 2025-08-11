import express from 'express';
import { body, validationResult } from 'express-validator';
import { InsuranceVerification, InsuranceClaim } from '../models/Insurance.js';
import Patient from '../models/Patient.js';
import { auth } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

// Get all insurance verifications
router.get('/verifications', auth, async (req, res) => {
  try {
    const { patientId, status, provider } = req.query;
    
    const query = {};
    if (patientId) query.patientId = patientId;
    if (status) query.verificationStatus = status;
    if (provider) query.provider = new RegExp(provider, 'i');

    const verifications = await InsuranceVerification.find(query)
      .populate('patientId', 'name email phone')
      .populate('verifiedBy', 'name')
      .sort({ lastVerified: -1 });

    res.json(verifications);
  } catch (error) {
    logger.error('Error fetching insurance verifications:', error);
    res.status(500).json({ error: 'Failed to fetch insurance verifications' });
  }
});

// Get verifications for a specific patient
router.get('/verifications/:patientId', auth, async (req, res) => {
  try {
    const verifications = await InsuranceVerification.find({ 
      patientId: req.params.patientId 
    })
    .populate('verifiedBy', 'name')
    .sort({ effectiveDate: -1 });

    res.json(verifications);
  } catch (error) {
    logger.error('Error fetching patient verifications:', error);
    res.status(500).json({ error: 'Failed to fetch patient verifications' });
  }
});

// Create new insurance verification
router.post('/verify', [
  auth,
  body('patientId').notEmpty(),
  body('provider').notEmpty().trim(),
  body('policyNumber').notEmpty().trim(),
  body('subscriberName').notEmpty().trim(),
  body('effectiveDate').isISO8601()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // Get patient name
    const patient = await Patient.findById(req.body.patientId);
    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    const verificationData = {
      ...req.body,
      patientName: patient.name,
      verifiedBy: req.user.id,
      lastVerified: new Date(),
      verificationStatus: 'verified'
    };

    const verification = new InsuranceVerification(verificationData);
    await verification.save();

    logger.info(`Insurance verified for patient ${req.body.patientId}`);
    res.status(201).json(verification);
  } catch (error) {
    logger.error('Error creating insurance verification:', error);
    res.status(500).json({ error: 'Failed to verify insurance' });
  }
});

// Update insurance verification
router.put('/verifications/:id', auth, async (req, res) => {
  try {
    const verification = await InsuranceVerification.findById(req.params.id);
    
    if (!verification) {
      return res.status(404).json({ error: 'Verification not found' });
    }

    Object.keys(req.body).forEach(key => {
      if (req.body[key] !== undefined) {
        verification[key] = req.body[key];
      }
    });

    verification.verifiedBy = req.user.id;
    verification.lastVerified = new Date();

    await verification.save();
    res.json(verification);
  } catch (error) {
    logger.error('Error updating verification:', error);
    res.status(500).json({ error: 'Failed to update verification' });
  }
});

// Get all insurance claims
router.get('/claims', auth, async (req, res) => {
  try {
    const { 
      patientId, 
      status, 
      startDate, 
      endDate,
      limit = 50,
      offset = 0 
    } = req.query;
    
    const query = {};
    
    if (patientId) query.patientId = patientId;
    if (status) query.status = status;
    
    if (startDate && endDate) {
      query.dateOfService = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const claims = await InsuranceClaim.find(query)
      .populate('patientId', 'name email phone')
      .populate('appointmentId', 'date time')
      .populate('submittedBy', 'name')
      .populate('processedBy', 'name')
      .sort({ submittedDate: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(offset));

    const total = await InsuranceClaim.countDocuments(query);

    res.json({
      claims,
      total,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    logger.error('Error fetching insurance claims:', error);
    res.status(500).json({ error: 'Failed to fetch insurance claims' });
  }
});

// Create new insurance claim
router.post('/claims', [
  auth,
  body('patientId').notEmpty(),
  body('provider').notEmpty().trim(),
  body('policyNumber').notEmpty().trim(),
  body('dateOfService').isISO8601(),
  body('procedures').isArray().notEmpty(),
  body('totalCharged').isNumeric(),
  body('totalInsuranceEstimate').isNumeric(),
  body('totalPatientResponsibility').isNumeric()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // Get patient name
    const patient = await Patient.findById(req.body.patientId);
    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    const claimData = {
      ...req.body,
      patientName: patient.name,
      submittedBy: req.user.id
    };

    const claim = new InsuranceClaim(claimData);
    await claim.save();

    logger.info(`Insurance claim created: ${claim.claimNumber}`);
    res.status(201).json(claim);
  } catch (error) {
    logger.error('Error creating insurance claim:', error);
    res.status(500).json({ error: 'Failed to create insurance claim' });
  }
});

// Update insurance claim
router.put('/claims/:id', auth, async (req, res) => {
  try {
    const claim = await InsuranceClaim.findById(req.params.id);
    
    if (!claim) {
      return res.status(404).json({ error: 'Claim not found' });
    }

    Object.keys(req.body).forEach(key => {
      if (req.body[key] !== undefined && key !== 'claimNumber') {
        claim[key] = req.body[key];
      }
    });

    // Recalculate totals if procedures changed
    if (req.body.procedures) {
      claim.calculateTotals();
    }

    await claim.save();
    res.json(claim);
  } catch (error) {
    logger.error('Error updating claim:', error);
    res.status(500).json({ error: 'Failed to update claim' });
  }
});

// Submit claim for processing
router.post('/claims/:id/submit', auth, async (req, res) => {
  try {
    const claim = await InsuranceClaim.findById(req.params.id);
    
    if (!claim) {
      return res.status(404).json({ error: 'Claim not found' });
    }

    await claim.submitClaim(req.user.id);
    
    logger.info(`Claim submitted: ${claim.claimNumber}`);
    res.json(claim);
  } catch (error) {
    logger.error('Error submitting claim:', error);
    res.status(500).json({ error: 'Failed to submit claim' });
  }
});

// Process claim (approve/deny)
router.post('/claims/:id/process', [
  auth,
  body('approved').isBoolean(),
  body('amount').optional().isNumeric(),
  body('denialReason').optional().isString()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const claim = await InsuranceClaim.findById(req.params.id);
    
    if (!claim) {
      return res.status(404).json({ error: 'Claim not found' });
    }

    if (!req.body.approved && req.body.denialReason) {
      claim.denialReason = req.body.denialReason;
    }

    await claim.processClaim(req.body.approved, req.body.amount, req.user.id);
    
    logger.info(`Claim processed: ${claim.claimNumber} - ${req.body.approved ? 'Approved' : 'Denied'}`);
    res.json(claim);
  } catch (error) {
    logger.error('Error processing claim:', error);
    res.status(500).json({ error: 'Failed to process claim' });
  }
});

// Get insurance statistics (general endpoint)
router.get('/statistics', auth, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const query = {};
    if (startDate && endDate) {
      query.submittedDate = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    // Get claim statistics
    const claimStats = await InsuranceClaim.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          totalClaims: { $sum: 1 },
          totalCharged: { $sum: '$totalCharged' },
          totalPaid: { $sum: '$totalInsurancePaid' },
          totalPatientResponsibility: { $sum: '$totalPatientResponsibility' },
          averageClaimAmount: { $avg: '$totalCharged' },
          averageApprovalTime: { $avg: { $subtract: ['$processedDate', '$submittedDate'] } }
        }
      }
    ]);

    // Get verification statistics
    const verificationStats = await InsuranceVerification.aggregate([
      {
        $group: {
          _id: null,
          totalVerifications: { $sum: 1 },
          activeVerifications: {
            $sum: { $cond: [{ $eq: ['$verificationStatus', 'verified'] }, 1, 0] }
          },
          expiredVerifications: {
            $sum: { $cond: [{ $eq: ['$verificationStatus', 'expired'] }, 1, 0] }
          }
        }
      }
    ]);

    // Get provider breakdown
    const providerBreakdown = await InsuranceVerification.aggregate([
      {
        $group: {
          _id: '$provider',
          count: { $sum: 1 },
          activeCount: {
            $sum: { $cond: [{ $eq: ['$verificationStatus', 'verified'] }, 1, 0] }
          }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    res.json({
      claims: claimStats[0] || {
        totalClaims: 0,
        totalCharged: 0,
        totalPaid: 0,
        totalPatientResponsibility: 0,
        averageClaimAmount: 0,
        averageApprovalTime: 0
      },
      verifications: verificationStats[0] || {
        totalVerifications: 0,
        activeVerifications: 0,
        expiredVerifications: 0
      },
      providerBreakdown,
      lastUpdated: new Date()
    });
  } catch (error) {
    logger.error('Error fetching insurance statistics:', error);
    res.status(500).json({ error: 'Failed to fetch insurance statistics' });
  }
});

// Get claim statistics
router.get('/claims/stats', auth, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const query = {};
    if (startDate && endDate) {
      query.submittedDate = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const stats = await InsuranceClaim.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          totalClaims: { $sum: 1 },
          totalCharged: { $sum: '$totalCharged' },
          totalPaid: { $sum: '$totalInsurancePaid' },
          totalPatientResponsibility: { $sum: '$totalPatientResponsibility' },
          pendingClaims: {
            $sum: { $cond: [{ $in: ['$status', ['pending', 'submitted', 'processing']] }, 1, 0] }
          },
          approvedClaims: {
            $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] }
          },
          deniedClaims: {
            $sum: { $cond: [{ $eq: ['$status', 'denied'] }, 1, 0] }
          },
          paidClaims: {
            $sum: { $cond: [{ $eq: ['$status', 'paid'] }, 1, 0] }
          }
        }
      }
    ]);

    const statusBreakdown = await InsuranceClaim.aggregate([
      { $match: query },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$totalCharged' }
        }
      },
      { $sort: { count: -1 } }
    ]);

    res.json({
      ...(stats[0] || {
        totalClaims: 0,
        totalCharged: 0,
        totalPaid: 0,
        totalPatientResponsibility: 0,
        pendingClaims: 0,
        approvedClaims: 0,
        deniedClaims: 0,
        paidClaims: 0
      }),
      statusBreakdown,
      approvalRate: stats[0] && stats[0].totalClaims > 0 
        ? ((stats[0].approvedClaims / stats[0].totalClaims) * 100).toFixed(2) 
        : 0
    });
  } catch (error) {
    logger.error('Error fetching claim statistics:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

export default router;