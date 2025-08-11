import express from 'express';
import { body, validationResult } from 'express-validator';
import Patient from '../models/Patient.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

// Get all patients with search, filter, and pagination
router.get('/', async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      search, 
      status = 'all',
      sortBy = 'lastName',
      sortOrder = 'asc' 
    } = req.query;

    // Build query
    const query = {};
    
    if (status !== 'all') {
      query.status = status;
    }

    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { 'insurance.memberId': { $regex: search, $options: 'i' } }
      ];
    }

    // Execute query with pagination
    const patients = await Patient.find(query)
      .select('-password')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 })
      .lean();

    const count = await Patient.countDocuments(query);

    // Add calculated fields
    const patientsWithDetails = patients.map(patient => ({
      ...patient,
      fullName: `${patient.firstName} ${patient.lastName}`,
      age: patient.dateOfBirth ? calculateAge(patient.dateOfBirth) : null
    }));

    res.json({
      patients: patientsWithDetails,
      totalPages: Math.ceil(count / limit),
      currentPage: parseInt(page),
      total: count
    });
  } catch (error) {
    logger.error('Error fetching patients:', error);
    res.status(500).json({ error: 'Failed to fetch patients' });
  }
});

// Get single patient by ID
router.get('/:id', async (req, res) => {
  try {
    const patient = await Patient.findById(req.params.id)
      .select('-password')
      .populate('upcomingAppointments')
      .populate('familyMembers', 'firstName lastName email phone')
      .lean();
    
    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    // Add calculated fields
    patient.fullName = `${patient.firstName} ${patient.lastName}`;
    patient.age = patient.dateOfBirth ? calculateAge(patient.dateOfBirth) : null;
    patient.riskLevel = calculateRiskLevel(patient);

    res.json(patient);
  } catch (error) {
    logger.error('Error fetching patient:', error);
    res.status(500).json({ error: 'Failed to fetch patient' });
  }
});

// Create new patient
router.post('/', [
  body('email').isEmail().withMessage('Valid email is required'),
  body('phone').optional().trim(),
  body('dateOfBirth').optional().isISO8601().withMessage('Valid date of birth is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // Check if patient already exists
    const existingPatient = await Patient.findOne({ email: req.body.email });
    if (existingPatient) {
      return res.status(400).json({ error: 'Patient with this email already exists' });
    }

    // Parse name into firstName and lastName if 'name' field is provided
    let firstName = req.body.firstName;
    let lastName = req.body.lastName;
    
    if (req.body.name && !firstName && !lastName) {
      const nameParts = req.body.name.trim().split(' ');
      firstName = nameParts[0] || 'First';
      lastName = nameParts.slice(1).join(' ') || 'Last';
    }
    
    // Set defaults if not provided
    firstName = firstName || 'First';
    lastName = lastName || 'Last';

    // Create new patient
    const patient = new Patient({
      firstName,
      lastName,
      email: req.body.email,
      phone: req.body.phone || '000-000-0000',
      dateOfBirth: req.body.dateOfBirth,
      insurance: req.body.insurance || {},
      allergies: req.body.allergies || [],
      currentMedications: req.body.currentMedications || [],
      medicalHistory: req.body.medicalHistory || [],
      riskFactors: req.body.riskFactors || {},
      address: req.body.address || {},
      emergencyContact: req.body.emergencyContact || {},
      preferences: req.body.preferences || {},
      patientSince: new Date(),
      status: 'active'
    });

    // Calculate initial next recall date
    patient.calculateNextRecall();

    await patient.save();

    logger.info(`New patient created: ${patient.email}`);

    // Remove password from response
    const patientResponse = patient.toObject();
    delete patientResponse.password;

    res.status(201).json(patientResponse);
  } catch (error) {
    logger.error('Error creating patient:', error);
    res.status(500).json({ error: 'Failed to create patient' });
  }
});

// Update patient
router.put('/:id', [
  body('email').optional().isEmail().withMessage('Valid email is required'),
  body('dateOfBirth').optional().isISO8601().withMessage('Valid date is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // Don't allow password updates through this route
    delete req.body.password;

    const patient = await Patient.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedAt: new Date() },
      { new: true, runValidators: true }
    ).select('-password');
    
    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    logger.info(`Patient updated: ${patient.email}`);

    res.json(patient);
  } catch (error) {
    logger.error('Error updating patient:', error);
    res.status(500).json({ error: 'Failed to update patient' });
  }
});

// Delete (archive) patient
router.delete('/:id', async (req, res) => {
  try {
    const patient = await Patient.findById(req.params.id);
    
    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    // Archive instead of delete
    patient.status = 'archived';
    patient.updatedAt = new Date();
    await patient.save();

    logger.info(`Patient archived: ${patient.email}`);

    res.json({ message: 'Patient archived successfully' });
  } catch (error) {
    logger.error('Error archiving patient:', error);
    res.status(500).json({ error: 'Failed to archive patient' });
  }
});

// Add treatment history
router.post('/:id/treatments', [
  body('procedure').trim().notEmpty().withMessage('Procedure is required'),
  body('date').isISO8601().withMessage('Valid date is required'),
  body('cost').isNumeric().withMessage('Cost must be a number')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const patient = await Patient.findById(req.params.id);
    
    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    patient.treatmentHistory.push(req.body);
    patient.lastVisit = req.body.date || new Date();
    patient.calculateNextRecall();
    
    await patient.save();

    logger.info(`Treatment added for patient: ${patient.email}`);

    res.json(patient);
  } catch (error) {
    logger.error('Error adding treatment:', error);
    res.status(500).json({ error: 'Failed to add treatment' });
  }
});

// Get patients due for recall
router.get('/recalls/due', async (req, res) => {
  try {
    const { daysAhead = 30 } = req.query;
    const patients = await Patient.findDueForRecall(parseInt(daysAhead));
    
    res.json(patients);
  } catch (error) {
    logger.error('Error fetching recall patients:', error);
    res.status(500).json({ error: 'Failed to fetch recall patients' });
  }
});

// Update medical history
router.put('/:id/medical', async (req, res) => {
  try {
    const patient = await Patient.findById(req.params.id);
    
    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    // Update medical fields
    if (req.body.allergies) patient.allergies = req.body.allergies;
    if (req.body.currentMedications) patient.currentMedications = req.body.currentMedications;
    if (req.body.medicalHistory) patient.medicalHistory = req.body.medicalHistory;
    if (req.body.riskFactors) patient.riskFactors = { ...patient.riskFactors, ...req.body.riskFactors };

    patient.updatedAt = new Date();
    await patient.save();

    logger.info(`Medical history updated for patient: ${patient.email}`);

    res.json(patient);
  } catch (error) {
    logger.error('Error updating medical history:', error);
    res.status(500).json({ error: 'Failed to update medical history' });
  }
});

// Helper functions
function calculateAge(dateOfBirth) {
  const today = new Date();
  const birthDate = new Date(dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

function calculateRiskLevel(patient) {
  let riskScore = 0;
  
  if (patient.riskFactors) {
    if (patient.riskFactors.smoking) riskScore += 2;
    if (patient.riskFactors.diabetes) riskScore += 2;
    if (patient.riskFactors.heartDisease) riskScore += 1;
    if (patient.riskFactors.immunocompromised) riskScore += 2;
  }
  
  const age = calculateAge(patient.dateOfBirth);
  if (age > 65) riskScore += 1;
  if (age < 18) riskScore += 1;
  
  if (riskScore >= 5) return 'high';
  if (riskScore >= 3) return 'medium';
  return 'low';
}

export default router;