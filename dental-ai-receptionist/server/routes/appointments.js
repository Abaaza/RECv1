import express from 'express';
import { body, validationResult } from 'express-validator';
import Appointment from '../models/Appointment.js';
import User from '../models/User.js';
import { authorizeRoles } from '../middleware/auth.js';
import { sendAppointmentReminder } from '../services/notificationService.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

router.get('/', async (req, res) => {
  try {
    const { date, status, dentistId } = req.query;
    const query = {};

    // Handle case where auth is disabled
    if (req.user) {
      if (req.user.role === 'patient') {
        query.patientId = req.user._id;
      } else if (req.user.role === 'dentist') {
        query.dentistId = req.user._id;
      }
    }

    if (date) {
      const startDate = new Date(date);
      const endDate = new Date(date);
      endDate.setDate(endDate.getDate() + 1);
      query.date = { $gte: startDate, $lt: endDate };
    }

    if (status) query.status = status;
    if (dentistId && (!req.user || req.user.role !== 'dentist')) query.dentistId = dentistId;

    const appointments = await Appointment.find(query)
      .populate('patientId', 'profile.firstName profile.lastName email phone')
      .populate('dentistId', 'profile.firstName profile.lastName')
      .sort({ date: 1, startTime: 1 });

    res.json(appointments);
  } catch (error) {
    logger.error('Error fetching appointments:', error);
    res.status(500).json({ error: 'Failed to fetch appointments' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id)
      .populate('patientId')
      .populate('dentistId');

    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    if (req.user && req.user.role === 'patient' && appointment.patientId._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json(appointment);
  } catch (error) {
    logger.error('Error fetching appointment:', error);
    res.status(500).json({ error: 'Failed to fetch appointment' });
  }
});

router.post('/', [
  body('dentistId').notEmpty(),
  body('date').isISO8601(),
  body('startTime').matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
  body('endTime').matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
  body('type').isIn(['checkup', 'cleaning', 'filling', 'extraction', 'root-canal', 'crown', 'emergency', 'consultation', 'other']),
  body('reason').notEmpty(),
  handleValidationErrors
], async (req, res) => {
  try {
    const appointmentData = {
      ...req.body,
      patientId: (req.user && req.user.role === 'patient') ? req.user._id : req.body.patientId
    };

    const conflictingAppointment = await Appointment.findOne({
      dentistId: appointmentData.dentistId,
      date: appointmentData.date,
      status: { $nin: ['cancelled', 'completed'] },
      $or: [
        {
          startTime: { $lte: appointmentData.startTime },
          endTime: { $gt: appointmentData.startTime }
        },
        {
          startTime: { $lt: appointmentData.endTime },
          endTime: { $gte: appointmentData.endTime }
        }
      ]
    });

    if (conflictingAppointment) {
      return res.status(400).json({ error: 'Time slot is not available' });
    }

    const appointment = new Appointment(appointmentData);
    await appointment.save();

    await appointment.populate('patientId dentistId');

    logger.info(`Appointment created: ${appointment._id}`);

    res.status(201).json(appointment);
  } catch (error) {
    logger.error('Error creating appointment:', error);
    res.status(500).json({ error: 'Failed to create appointment' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id);

    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    if (req.user && req.user.role === 'patient' && appointment.patientId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const updates = { ...req.body };
    delete updates._id;
    delete updates.patientId;
    
    if (req.user && req.user.role === 'patient') {
      delete updates.dentistId;
      delete updates.treatment;
      delete updates.billing;
    }

    Object.assign(appointment, updates);
    await appointment.save();

    await appointment.populate('patientId dentistId');

    logger.info(`Appointment updated: ${appointment._id}`);

    res.json(appointment);
  } catch (error) {
    logger.error('Error updating appointment:', error);
    res.status(500).json({ error: 'Failed to update appointment' });
  }
});

router.put('/:id/status', [
  body('status').isIn(['scheduled', 'confirmed', 'in-progress', 'completed', 'cancelled', 'no-show']),
  handleValidationErrors
], async (req, res) => {
  try {
    const { status } = req.body;
    const appointment = await Appointment.findById(req.params.id);

    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    appointment.status = status;
    await appointment.save();

    await appointment.populate('patientId dentistId');

    if (status === 'cancelled') {
      // TODO: Send cancellation notification
    }

    logger.info(`Appointment status updated: ${appointment._id} to ${status}`);

    res.json(appointment);
  } catch (error) {
    logger.error('Error updating appointment status:', error);
    res.status(500).json({ error: 'Failed to update appointment status' });
  }
});

router.delete('/:id', authorizeRoles('admin', 'receptionist'), async (req, res) => {
  try {
    const appointment = await Appointment.findByIdAndDelete(req.params.id);

    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    logger.info(`Appointment deleted: ${req.params.id}`);

    res.json({ message: 'Appointment deleted successfully' });
  } catch (error) {
    logger.error('Error deleting appointment:', error);
    res.status(500).json({ error: 'Failed to delete appointment' });
  }
});

router.get('/slots/available', async (req, res) => {
  try {
    const { dentistId, date } = req.query;

    if (!dentistId || !date) {
      return res.status(400).json({ error: 'DentistId and date are required' });
    }

    const appointments = await Appointment.find({
      dentistId,
      date: new Date(date),
      status: { $nin: ['cancelled'] }
    }).select('startTime endTime');

    const workingHours = {
      start: '09:00',
      end: '17:00',
      slotDuration: 30
    };

    const availableSlots = generateAvailableSlots(workingHours, appointments);

    res.json(availableSlots);
  } catch (error) {
    logger.error('Error fetching available slots:', error);
    res.status(500).json({ error: 'Failed to fetch available slots' });
  }
});

function generateAvailableSlots(workingHours, appointments) {
  const slots = [];
  const [startHour, startMin] = workingHours.start.split(':').map(Number);
  const [endHour, endMin] = workingHours.end.split(':').map(Number);
  
  let currentHour = startHour;
  let currentMin = startMin;

  while (currentHour < endHour || (currentHour === endHour && currentMin < endMin)) {
    const timeStr = `${String(currentHour).padStart(2, '0')}:${String(currentMin).padStart(2, '0')}`;
    const endTimeMin = currentMin + workingHours.slotDuration;
    const endTimeHour = currentHour + Math.floor(endTimeMin / 60);
    const endTimeStr = `${String(endTimeHour).padStart(2, '0')}:${String(endTimeMin % 60).padStart(2, '0')}`;

    const isBooked = appointments.some(apt => 
      (apt.startTime <= timeStr && apt.endTime > timeStr) ||
      (apt.startTime < endTimeStr && apt.endTime >= endTimeStr)
    );

    if (!isBooked) {
      slots.push({
        startTime: timeStr,
        endTime: endTimeStr,
        available: true
      });
    }

    currentMin += workingHours.slotDuration;
    if (currentMin >= 60) {
      currentHour++;
      currentMin = currentMin % 60;
    }
  }

  return slots;
}

export default router;