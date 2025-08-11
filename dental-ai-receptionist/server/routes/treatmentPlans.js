import express from 'express';
import { body, validationResult } from 'express-validator';
import TreatmentPlan from '../models/TreatmentPlan.js';
import Patient from '../models/Patient.js';
import Appointment from '../models/Appointment.js';
import { logger } from '../utils/logger.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

// Create treatment plan
router.post('/', [
  authenticate,
  authorize(['dentist', 'specialist', 'admin']),
  body('patientId').isMongoId(),
  body('name').notEmpty().trim(),
  body('description').notEmpty().trim(),
  body('procedures').isArray().notEmpty(),
  body('estimatedCost').isNumeric()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const patient = await Patient.findById(req.body.patientId);
    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    const treatmentPlan = new TreatmentPlan({
      ...req.body,
      createdBy: req.user.id,
      status: 'draft'
    });

    // Calculate totals
    treatmentPlan.calculateTotals();
    await treatmentPlan.save();

    // Update patient record
    patient.treatmentPlans = patient.treatmentPlans || [];
    patient.treatmentPlans.push(treatmentPlan._id);
    await patient.save();

    logger.info(`Treatment plan created for patient ${patient.name}`);
    res.json(treatmentPlan);
  } catch (error) {
    logger.error('Error creating treatment plan:', error);
    res.status(500).json({ error: 'Failed to create treatment plan' });
  }
});

// Get all treatment plans
router.get('/', authenticate, async (req, res) => {
  try {
    const { status, priority, page = 1, limit = 20 } = req.query;
    
    const query = {};
    if (status) query.status = status;
    if (priority) query.priority = priority;

    const plans = await TreatmentPlan.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .populate('patientId', 'name email')
      .populate('createdBy', 'name')
      .populate('approvedBy', 'name');

    const count = await TreatmentPlan.countDocuments(query);

    res.json({
      plans,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
      total: count
    });
  } catch (error) {
    logger.error('Error fetching treatment plans:', error);
    res.status(500).json({ error: 'Failed to fetch treatment plans' });
  }
});

// Get treatment plans for a patient
router.get('/patient/:patientId', authenticate, async (req, res) => {
  try {
    const plans = await TreatmentPlan.find({
      patientId: req.params.patientId
    })
    .sort({ createdAt: -1 })
    .populate('createdBy', 'name')
    .populate('approvedBy', 'name')
    .populate('procedures.completedBy', 'name');

    res.json(plans);
  } catch (error) {
    logger.error('Error fetching patient treatment plans:', error);
    res.status(500).json({ error: 'Failed to fetch treatment plans' });
  }
});

// Get single treatment plan
router.get('/:id', authenticate, async (req, res) => {
  try {
    const plan = await TreatmentPlan.findById(req.params.id)
      .populate('patientId')
      .populate('createdBy', 'name')
      .populate('approvedBy', 'name')
      .populate('procedures.completedBy', 'name')
      .populate('appointments');

    if (!plan) {
      return res.status(404).json({ error: 'Treatment plan not found' });
    }

    res.json(plan);
  } catch (error) {
    logger.error('Error fetching treatment plan:', error);
    res.status(500).json({ error: 'Failed to fetch treatment plan' });
  }
});

// Update treatment plan
router.put('/:id', [
  authenticate,
  authorize(['dentist', 'specialist', 'admin'])
], async (req, res) => {
  try {
    const plan = await TreatmentPlan.findById(req.params.id);
    
    if (!plan) {
      return res.status(404).json({ error: 'Treatment plan not found' });
    }

    // Don't allow changes to approved plans unless admin
    if (plan.status === 'approved' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Cannot modify approved treatment plan' });
    }

    // Update fields
    Object.assign(plan, req.body);
    
    // Recalculate totals if procedures changed
    if (req.body.procedures) {
      plan.calculateTotals();
    }

    await plan.save();

    logger.info(`Treatment plan updated: ${plan._id}`);
    res.json(plan);
  } catch (error) {
    logger.error('Error updating treatment plan:', error);
    res.status(500).json({ error: 'Failed to update treatment plan' });
  }
});

// Delete treatment plan
router.delete('/:id', [
  authenticate,
  authorize(['admin'])
], async (req, res) => {
  try {
    const plan = await TreatmentPlan.findById(req.params.id);
    
    if (!plan) {
      return res.status(404).json({ error: 'Treatment plan not found' });
    }

    // Don't delete if any procedures are completed
    const hasCompletedProcedures = plan.procedures.some(p => p.status === 'completed');
    if (hasCompletedProcedures) {
      return res.status(400).json({ error: 'Cannot delete plan with completed procedures' });
    }

    // Remove from patient record
    await Patient.findByIdAndUpdate(plan.patientId, {
      $pull: { treatmentPlans: plan._id }
    });

    await plan.remove();

    logger.info(`Treatment plan deleted: ${plan._id}`);
    res.json({ message: 'Treatment plan deleted successfully' });
  } catch (error) {
    logger.error('Error deleting treatment plan:', error);
    res.status(500).json({ error: 'Failed to delete treatment plan' });
  }
});

// Approve treatment plan
router.post('/:id/approve', [
  authenticate,
  authorize(['dentist', 'specialist', 'admin'])
], async (req, res) => {
  try {
    const plan = await TreatmentPlan.findById(req.params.id);
    
    if (!plan) {
      return res.status(404).json({ error: 'Treatment plan not found' });
    }

    if (plan.status === 'approved') {
      return res.status(400).json({ error: 'Plan already approved' });
    }

    await plan.approve(req.user.id);

    logger.info(`Treatment plan approved: ${plan._id}`);
    res.json(plan);
  } catch (error) {
    logger.error('Error approving treatment plan:', error);
    res.status(500).json({ error: 'Failed to approve treatment plan' });
  }
});

// Present treatment plan to patient
router.post('/:id/present', [
  authenticate,
  body('presentedBy').optional().isMongoId(),
  body('notes').optional().trim()
], async (req, res) => {
  try {
    const plan = await TreatmentPlan.findById(req.params.id);
    
    if (!plan) {
      return res.status(404).json({ error: 'Treatment plan not found' });
    }

    const { notes } = req.body;
    await plan.present(req.user.id, notes);

    logger.info(`Treatment plan presented: ${plan._id}`);
    res.json(plan);
  } catch (error) {
    logger.error('Error presenting treatment plan:', error);
    res.status(500).json({ error: 'Failed to present treatment plan' });
  }
});

// Patient accepts/declines treatment plan
router.post('/:id/patient-decision', [
  authenticate,
  body('accepted').isBoolean(),
  body('reason').optional().trim()
], async (req, res) => {
  try {
    const plan = await TreatmentPlan.findById(req.params.id);
    
    if (!plan) {
      return res.status(404).json({ error: 'Treatment plan not found' });
    }

    const { accepted, reason } = req.body;
    
    if (accepted) {
      await plan.accept();
    } else {
      await plan.decline(reason);
    }

    logger.info(`Treatment plan ${accepted ? 'accepted' : 'declined'}: ${plan._id}`);
    res.json(plan);
  } catch (error) {
    logger.error('Error updating patient decision:', error);
    res.status(500).json({ error: 'Failed to update patient decision' });
  }
});

// Update procedure status
router.put('/:id/procedures/:procedureId', [
  authenticate,
  authorize(['dentist', 'specialist', 'admin']),
  body('status').isIn(['scheduled', 'in_progress', 'completed', 'cancelled']),
  body('completedDate').optional().isISO8601(),
  body('completedBy').optional().isMongoId(),
  body('notes').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const plan = await TreatmentPlan.findById(req.params.id);
    
    if (!plan) {
      return res.status(404).json({ error: 'Treatment plan not found' });
    }

    const procedure = plan.procedures.id(req.params.procedureId);
    if (!procedure) {
      return res.status(404).json({ error: 'Procedure not found' });
    }

    // Update procedure
    Object.assign(procedure, req.body);
    
    if (req.body.status === 'completed' && !procedure.completedDate) {
      procedure.completedDate = new Date();
      procedure.completedBy = req.user.id;
    }

    await plan.save();
    plan.updateProgress();

    logger.info(`Procedure updated in treatment plan ${plan._id}`);
    res.json(plan);
  } catch (error) {
    logger.error('Error updating procedure:', error);
    res.status(500).json({ error: 'Failed to update procedure' });
  }
});

// Schedule appointment for procedure
router.post('/:id/procedures/:procedureId/schedule', [
  authenticate,
  body('appointmentDate').isISO8601(),
  body('appointmentTime').matches(/^\d{2}:\d{2}$/),
  body('duration').isNumeric()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const plan = await TreatmentPlan.findById(req.params.id);
    
    if (!plan) {
      return res.status(404).json({ error: 'Treatment plan not found' });
    }

    const procedure = plan.procedures.id(req.params.procedureId);
    if (!procedure) {
      return res.status(404).json({ error: 'Procedure not found' });
    }

    const { appointmentDate, appointmentTime, duration } = req.body;

    // Create appointment
    const appointment = new Appointment({
      patientId: plan.patientId,
      date: appointmentDate,
      time: appointmentTime,
      duration,
      type: 'treatment',
      treatmentPlanId: plan._id,
      procedureId: procedure._id,
      notes: `Treatment: ${procedure.name}`,
      status: 'scheduled'
    });

    await appointment.save();

    // Update procedure
    procedure.status = 'scheduled';
    procedure.scheduledDate = appointmentDate;
    
    // Add appointment to plan
    plan.appointments.push(appointment._id);
    
    await plan.save();

    logger.info(`Appointment scheduled for procedure in plan ${plan._id}`);
    res.json({ appointment, plan });
  } catch (error) {
    logger.error('Error scheduling appointment:', error);
    res.status(500).json({ error: 'Failed to schedule appointment' });
  }
});

// Get treatment plan statistics (direct endpoint)
router.get('/stats', authenticate, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const dateQuery = {};
    if (startDate && endDate) {
      dateQuery.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const stats = await TreatmentPlan.aggregate([
      { $match: dateQuery },
      {
        $group: {
          _id: null,
          totalPlans: { $sum: 1 },
          totalValue: { $sum: '$estimatedCost' },
          acceptedValue: {
            $sum: {
              $cond: [{ $eq: ['$patientConsent.accepted', true] }, '$estimatedCost', 0]
            }
          },
          completedValue: {
            $sum: {
              $cond: [{ $eq: ['$status', 'completed'] }, '$actualCost', 0]
            }
          },
          avgPlanValue: { $avg: '$estimatedCost' },
          acceptanceRate: {
            $avg: {
              $cond: [{ $eq: ['$patientConsent.accepted', true] }, 1, 0]
            }
          }
        }
      }
    ]);

    const byStatus = await TreatmentPlan.aggregate([
      { $match: dateQuery },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalValue: { $sum: '$estimatedCost' }
        }
      }
    ]);

    res.json({
      overview: stats[0] || {
        totalPlans: 0,
        totalValue: 0,
        acceptedValue: 0,
        completedValue: 0,
        avgPlanValue: 0,
        acceptanceRate: 0
      },
      byStatus,
      lastUpdated: new Date()
    });
  } catch (error) {
    logger.error('Error fetching treatment plan statistics:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// Get treatment plan statistics (overview)
router.get('/stats/overview', authenticate, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const dateQuery = {};
    if (startDate && endDate) {
      dateQuery.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const stats = await TreatmentPlan.aggregate([
      { $match: dateQuery },
      {
        $group: {
          _id: null,
          totalPlans: { $sum: 1 },
          totalValue: { $sum: '$estimatedCost' },
          acceptedValue: {
            $sum: {
              $cond: [{ $eq: ['$patientConsent.accepted', true] }, '$estimatedCost', 0]
            }
          },
          completedValue: {
            $sum: {
              $cond: [{ $eq: ['$status', 'completed'] }, '$actualCost', 0]
            }
          },
          avgPlanValue: { $avg: '$estimatedCost' },
          acceptanceRate: {
            $avg: {
              $cond: [{ $eq: ['$patientConsent.accepted', true] }, 1, 0]
            }
          }
        }
      }
    ]);

    const byStatus = await TreatmentPlan.aggregate([
      { $match: dateQuery },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalValue: { $sum: '$estimatedCost' }
        }
      }
    ]);

    const byPriority = await TreatmentPlan.aggregate([
      { $match: dateQuery },
      {
        $group: {
          _id: '$priority',
          count: { $sum: 1 },
          totalValue: { $sum: '$estimatedCost' }
        }
      }
    ]);

    res.json({
      summary: stats[0] || {
        totalPlans: 0,
        totalValue: 0,
        acceptedValue: 0,
        completedValue: 0,
        avgPlanValue: 0,
        acceptanceRate: 0
      },
      byStatus,
      byPriority
    });
  } catch (error) {
    logger.error('Error fetching treatment plan statistics:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

export default router;