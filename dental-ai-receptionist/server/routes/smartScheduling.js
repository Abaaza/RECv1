import express from 'express';
import { body, validationResult } from 'express-validator';
import smartSchedulingService from '../services/smartSchedulingService.js';
import aiAppointmentHandler from '../services/aiAppointmentHandler.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

// Check availability for a specific time slot
router.post('/check-availability', [
  body('date').notEmpty(),
  body('time').optional(),
  body('duration').optional().isInt({ min: 15, max: 180 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { date, time, duration = 30 } = req.body;
    const dateTime = smartSchedulingService.parseDateTime(date, time);
    
    const availability = await smartSchedulingService.checkAvailability(dateTime, duration);
    
    if (availability.available) {
      res.json({ 
        available: true,
        dateTime,
        message: 'This time slot is available'
      });
    } else {
      // Find alternatives
      const alternatives = await smartSchedulingService.findNextAvailableSlots(dateTime, duration, 2);
      res.json({
        available: false,
        reason: availability.reason,
        alternatives,
        message: 'This slot is not available, but we have other options'
      });
    }
  } catch (error) {
    logger.error('Error checking availability:', error);
    res.status(500).json({ error: 'Failed to check availability' });
  }
});

// Find available slots for a day
router.post('/available-slots', [
  body('date').notEmpty(),
  body('duration').optional().isInt({ min: 15, max: 180 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { date, duration = 30 } = req.body;
    const targetDate = smartSchedulingService.parseDateTime(date, null);
    
    const slots = await smartSchedulingService.findAvailableSlots(targetDate, duration);
    
    res.json({ 
      date: targetDate,
      duration,
      availableSlots: slots,
      totalSlots: slots.length
    });
  } catch (error) {
    logger.error('Error finding available slots:', error);
    res.status(500).json({ error: 'Failed to find available slots' });
  }
});

// Book an appointment
router.post('/book', [
  body('patientName').notEmpty().trim(),
  body('patientEmail').optional().isEmail(),
  body('patientPhone').optional(),
  body('date').notEmpty(),
  body('time').notEmpty(),
  body('type').optional(),
  body('notes').optional()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { patientName, patientEmail, patientPhone, date, time, type, notes } = req.body;
    
    // Parse date and time
    const dateTime = smartSchedulingService.parseDateTime(date, time);
    
    // Book the appointment
    const result = await smartSchedulingService.bookAppointment({
      patientName,
      patientEmail,
      patientPhone,
      dateTime,
      type,
      notes
    });
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    logger.error('Error booking appointment:', error);
    res.status(500).json({ error: 'Failed to book appointment' });
  }
});

// Cancel an appointment
router.post('/cancel', [
  body('appointmentId').notEmpty(),
  body('reason').optional()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { appointmentId, reason } = req.body;
    
    const result = await smartSchedulingService.cancelAppointment(appointmentId, reason);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    logger.error('Error cancelling appointment:', error);
    res.status(500).json({ error: 'Failed to cancel appointment' });
  }
});

// Reschedule an appointment
router.post('/reschedule', [
  body('appointmentId').notEmpty(),
  body('newDate').notEmpty(),
  body('newTime').notEmpty()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { appointmentId, newDate, newTime } = req.body;
    
    // Parse new date and time
    const newDateTime = smartSchedulingService.parseDateTime(newDate, newTime);
    
    const result = await smartSchedulingService.rescheduleAppointment(appointmentId, newDateTime);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    logger.error('Error rescheduling appointment:', error);
    res.status(500).json({ error: 'Failed to reschedule appointment' });
  }
});

// AI-powered appointment handling
router.post('/ai-handle', [
  body('message').notEmpty(),
  body('conversationId').optional(),
  body('context').optional()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { message, conversationId, context = {} } = req.body;
    
    const result = await aiAppointmentHandler.handleAppointmentRequest(
      message, 
      { ...context, conversationId }
    );
    
    res.json(result);
  } catch (error) {
    logger.error('Error in AI appointment handling:', error);
    res.status(500).json({ error: 'Failed to process appointment request' });
  }
});

export default router;