import express from 'express';
import { body, validationResult } from 'express-validator';
import User from '../models/User.js';
import Appointment from '../models/Appointment.js';
import { authorizeRoles } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

router.get('/', authorizeRoles('admin', 'receptionist', 'dentist'), async (req, res) => {
  try {
    const { page = 1, limit = 20, search } = req.query;
    const query = { role: 'patient' };

    if (search) {
      query.$or = [
        { 'profile.firstName': { $regex: search, $options: 'i' } },
        { 'profile.lastName': { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { 'profile.phone': { $regex: search, $options: 'i' } }
      ];
    }

    const patients = await User.find(query)
      .select('-password')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 });

    const count = await User.countDocuments(query);

    res.json({
      patients,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
      total: count
    });
  } catch (error) {
    logger.error('Error fetching patients:', error);
    res.status(500).json({ error: 'Failed to fetch patients' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const patient = await User.findById(req.params.id).select('-password');
    
    if (!patient || patient.role !== 'patient') {
      return res.status(404).json({ error: 'Patient not found' });
    }

    const appointments = await Appointment.find({ patientId: patient._id })
      .populate('dentistId', 'profile.firstName profile.lastName')
      .sort({ date: -1 })
      .limit(10);

    res.json({ patient, appointments });
  } catch (error) {
    logger.error('Error fetching patient:', error);
    res.status(500).json({ error: 'Failed to fetch patient' });
  }
});

router.put('/:id', [
  authorizeRoles('admin', 'receptionist'),
  body('profile.firstName').optional().trim(),
  body('profile.lastName').optional().trim(),
  body('profile.phone').optional().trim(),
  body('profile.dateOfBirth').optional().isISO8601(),
  body('medicalHistory.allergies').optional().isArray(),
  body('medicalHistory.medications').optional().isArray(),
  body('medicalHistory.conditions').optional().isArray()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const patient = await User.findById(req.params.id);
    
    if (!patient || patient.role !== 'patient') {
      return res.status(404).json({ error: 'Patient not found' });
    }

    const allowedUpdates = ['profile', 'medicalHistory', 'preferences'];
    const updates = {};

    allowedUpdates.forEach(field => {
      if (req.body[field]) {
        updates[field] = { ...patient[field], ...req.body[field] };
      }
    });

    Object.assign(patient, updates);
    patient.updatedAt = new Date();
    await patient.save();

    logger.info(`Patient updated: ${patient.email}`);

    res.json({ patient: patient.toJSON() });
  } catch (error) {
    logger.error('Error updating patient:', error);
    res.status(500).json({ error: 'Failed to update patient' });
  }
});

router.get('/:id/medical-history', async (req, res) => {
  try {
    const patient = await User.findById(req.params.id).select('medicalHistory profile');
    
    if (!patient || patient.role !== 'patient') {
      return res.status(404).json({ error: 'Patient not found' });
    }

    res.json({ medicalHistory: patient.medicalHistory, profile: patient.profile });
  } catch (error) {
    logger.error('Error fetching medical history:', error);
    res.status(500).json({ error: 'Failed to fetch medical history' });
  }
});

router.put('/:id/medical-history', [
  authorizeRoles('admin', 'dentist', 'receptionist'),
  body('allergies').optional().isArray(),
  body('medications').optional().isArray(),
  body('conditions').optional().isArray(),
  body('notes').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const patient = await User.findById(req.params.id);
    
    if (!patient || patient.role !== 'patient') {
      return res.status(404).json({ error: 'Patient not found' });
    }

    patient.medicalHistory = { ...patient.medicalHistory, ...req.body };
    patient.updatedAt = new Date();
    await patient.save();

    logger.info(`Medical history updated for patient: ${patient.email}`);

    res.json({ medicalHistory: patient.medicalHistory });
  } catch (error) {
    logger.error('Error updating medical history:', error);
    res.status(500).json({ error: 'Failed to update medical history' });
  }
});

router.delete('/:id', authorizeRoles('admin'), async (req, res) => {
  try {
    const patient = await User.findById(req.params.id);
    
    if (!patient || patient.role !== 'patient') {
      return res.status(404).json({ error: 'Patient not found' });
    }

    patient.isActive = false;
    patient.updatedAt = new Date();
    await patient.save();

    logger.info(`Patient deactivated: ${patient.email}`);

    res.json({ message: 'Patient deactivated successfully' });
  } catch (error) {
    logger.error('Error deactivating patient:', error);
    res.status(500).json({ error: 'Failed to deactivate patient' });
  }
});

export default router;