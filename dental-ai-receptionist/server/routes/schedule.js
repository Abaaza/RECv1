import express from 'express';
import { body, validationResult } from 'express-validator';
import Schedule from '../models/Schedule.js';
import User from '../models/User.js';
import Appointment from '../models/Appointment.js';
import { logger } from '../utils/logger.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

// Get schedule for date range
router.get('/', authenticate, async (req, res) => {
  try {
    const { startDate, endDate, dentistId } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'Start date and end date are required' });
    }

    const query = {
      date: {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      }
    };

    if (dentistId && dentistId !== 'all') {
      query.dentistId = dentistId;
    }

    const schedules = await Schedule.find(query)
      .populate('dentistId', 'name email')
      .populate('slots.appointmentId')
      .sort('date');

    // Get blocked slots
    const blockedSlots = {};
    schedules.forEach(schedule => {
      const dateKey = schedule.date.toISOString().split('T')[0];
      const key = schedule.dentistId ? `${dateKey}-${schedule.dentistId}` : dateKey;
      
      blockedSlots[key] = schedule.slots
        .filter(slot => !slot.available)
        .map(slot => slot.time);
    });

    // Get special hours
    const specialHours = schedules
      .filter(s => s.isSpecialHours)
      .map(s => ({
        date: s.date.toISOString().split('T')[0],
        start: s.startTime,
        end: s.endTime,
        reason: s.specialHoursReason
      }));

    // Convert schedules to frontend format
    const scheduleData = {};
    schedules.forEach(schedule => {
      const dateKey = schedule.date.toISOString().split('T')[0];
      scheduleData[dateKey] = {
        enabled: schedule.enabled,
        start: schedule.startTime,
        end: schedule.endTime,
        lunch: schedule.lunchBreak,
        slots: schedule.slots,
        special: schedule.isSpecialHours,
        reason: schedule.specialHoursReason,
        holiday: schedule.isHoliday,
        holidayName: schedule.holidayName
      };
    });

    res.json({
      schedule: scheduleData,
      blockedSlots,
      specialHours
    });
  } catch (error) {
    logger.error('Error fetching schedule:', error);
    res.status(500).json({ error: 'Failed to fetch schedule' });
  }
});

// Update schedule
router.put('/', [authenticate, authorize(['admin'])], async (req, res) => {
  try {
    const { schedule, blockedSlots, specialHours, defaultSchedule } = req.body;

    // Process each date in the schedule
    for (const [dateStr, daySchedule] of Object.entries(schedule)) {
      const date = new Date(dateStr);
      
      // Find or create schedule for this date
      let scheduleDoc = await Schedule.findOne({ date });
      
      if (!scheduleDoc) {
        scheduleDoc = new Schedule({
          date,
          dayOfWeek: date.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase(),
          createdBy: req.user.id
        });
      }

      // Update schedule properties
      scheduleDoc.startTime = daySchedule.start;
      scheduleDoc.endTime = daySchedule.end;
      scheduleDoc.lunchBreak = daySchedule.lunch;
      scheduleDoc.enabled = daySchedule.enabled;
      scheduleDoc.isSpecialHours = daySchedule.special || false;
      scheduleDoc.specialHoursReason = daySchedule.reason;
      scheduleDoc.isHoliday = daySchedule.holiday || false;
      scheduleDoc.holidayName = daySchedule.holidayName;
      scheduleDoc.slots = daySchedule.slots || scheduleDoc.generateSlots();
      scheduleDoc.modifiedBy = req.user.id;

      // Apply blocked slots
      const dateKey = dateStr;
      const blockedTimes = blockedSlots[dateKey] || [];
      
      scheduleDoc.slots.forEach(slot => {
        if (blockedTimes.includes(slot.time)) {
          slot.available = false;
          slot.blockedReason = 'Admin blocked';
          slot.blockedBy = req.user.id;
        } else if (!slot.appointmentId) {
          slot.available = true;
          slot.blockedReason = null;
          slot.blockedBy = null;
        }
      });

      await scheduleDoc.save();
    }

    // Save default schedule template if provided
    if (defaultSchedule) {
      // This could be saved to a settings collection or user preferences
      await User.findByIdAndUpdate(req.user.id, {
        'preferences.defaultSchedule': defaultSchedule
      });
    }

    logger.info(`Schedule updated by ${req.user.email}`);
    res.json({ message: 'Schedule updated successfully' });
  } catch (error) {
    logger.error('Error updating schedule:', error);
    res.status(500).json({ error: 'Failed to update schedule' });
  }
});

// Get available slots for a specific date
router.get('/available-slots', authenticate, async (req, res) => {
  try {
    const { date, duration = 30, dentistId } = req.query;
    
    if (!date) {
      return res.status(400).json({ error: 'Date is required' });
    }

    const query = {
      date: new Date(date),
      enabled: true
    };

    if (dentistId) {
      query.dentistId = dentistId;
    }

    const schedules = await Schedule.find(query);
    
    const availableSlots = [];
    schedules.forEach(schedule => {
      const slots = schedule.getAvailableSlots(parseInt(duration));
      slots.forEach(slot => {
        availableSlots.push({
          time: slot.time,
          dentistId: schedule.dentistId,
          scheduleId: schedule._id
        });
      });
    });

    res.json({ availableSlots });
  } catch (error) {
    logger.error('Error fetching available slots:', error);
    res.status(500).json({ error: 'Failed to fetch available slots' });
  }
});

// Block a specific slot
router.post('/block-slot', [
  authenticate,
  authorize(['admin']),
  body('date').isISO8601(),
  body('time').matches(/^\d{2}:\d{2}$/),
  body('reason').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { date, time, reason, dentistId } = req.body;

    const query = {
      date: new Date(date)
    };

    if (dentistId) {
      query.dentistId = dentistId;
    }

    const schedule = await Schedule.findOne(query);
    
    if (!schedule) {
      return res.status(404).json({ error: 'Schedule not found' });
    }

    await schedule.blockSlot(time, reason || 'Admin blocked', req.user.id);
    
    logger.info(`Slot blocked: ${date} ${time} by ${req.user.email}`);
    res.json({ message: 'Slot blocked successfully' });
  } catch (error) {
    logger.error('Error blocking slot:', error);
    res.status(500).json({ error: 'Failed to block slot' });
  }
});

// Unblock a specific slot
router.post('/unblock-slot', [
  authenticate,
  authorize(['admin']),
  body('date').isISO8601(),
  body('time').matches(/^\d{2}:\d{2}$/)
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { date, time, dentistId } = req.body;

    const query = {
      date: new Date(date)
    };

    if (dentistId) {
      query.dentistId = dentistId;
    }

    const schedule = await Schedule.findOne(query);
    
    if (!schedule) {
      return res.status(404).json({ error: 'Schedule not found' });
    }

    await schedule.unblockSlot(time);
    
    logger.info(`Slot unblocked: ${date} ${time} by ${req.user.email}`);
    res.json({ message: 'Slot unblocked successfully' });
  } catch (error) {
    logger.error('Error unblocking slot:', error);
    res.status(500).json({ error: 'Failed to unblock slot' });
  }
});

// Get dentists
router.get('/dentists', authenticate, async (req, res) => {
  try {
    const dentists = await User.find({ 
      role: { $in: ['dentist', 'specialist'] },
      isActive: true 
    })
    .select('name email specialty')
    .sort('name');

    res.json(dentists.map(d => ({
      id: d._id,
      name: d.name,
      email: d.email,
      specialty: d.specialty
    })));
  } catch (error) {
    logger.error('Error fetching dentists:', error);
    res.status(500).json({ error: 'Failed to fetch dentists' });
  }
});

// Get holidays
router.get('/holidays', authenticate, async (req, res) => {
  try {
    const { year } = req.query;
    
    const startDate = year ? new Date(`${year}-01-01`) : new Date(new Date().getFullYear(), 0, 1);
    const endDate = year ? new Date(`${year}-12-31`) : new Date(new Date().getFullYear(), 11, 31);

    const holidays = await Schedule.find({
      date: { $gte: startDate, $lte: endDate },
      isHoliday: true
    })
    .select('date holidayName')
    .sort('date');

    res.json(holidays.map(h => ({
      date: h.date.toISOString().split('T')[0],
      name: h.holidayName,
      closed: true
    })));
  } catch (error) {
    logger.error('Error fetching holidays:', error);
    res.status(500).json({ error: 'Failed to fetch holidays' });
  }
});

// Add holiday
router.post('/holidays', [
  authenticate,
  authorize(['admin']),
  body('date').isISO8601(),
  body('name').notEmpty().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { date, name } = req.body;

    let schedule = await Schedule.findOne({ date: new Date(date) });
    
    if (!schedule) {
      schedule = new Schedule({
        date: new Date(date),
        dayOfWeek: new Date(date).toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase(),
        startTime: '09:00',
        endTime: '17:00',
        createdBy: req.user.id
      });
    }

    schedule.isHoliday = true;
    schedule.holidayName = name;
    schedule.enabled = false;
    schedule.modifiedBy = req.user.id;

    await schedule.save();

    logger.info(`Holiday added: ${date} - ${name} by ${req.user.email}`);
    res.json({ message: 'Holiday added successfully' });
  } catch (error) {
    logger.error('Error adding holiday:', error);
    res.status(500).json({ error: 'Failed to add holiday' });
  }
});

// Delete holiday
router.delete('/holidays/:date', [authenticate, authorize(['admin'])], async (req, res) => {
  try {
    const { date } = req.params;

    const schedule = await Schedule.findOne({ date: new Date(date) });
    
    if (!schedule) {
      return res.status(404).json({ error: 'Holiday not found' });
    }

    schedule.isHoliday = false;
    schedule.holidayName = null;
    schedule.enabled = true;
    schedule.modifiedBy = req.user.id;

    await schedule.save();

    logger.info(`Holiday removed: ${date} by ${req.user.email}`);
    res.json({ message: 'Holiday removed successfully' });
  } catch (error) {
    logger.error('Error removing holiday:', error);
    res.status(500).json({ error: 'Failed to remove holiday' });
  }
});

// Apply template to date range
router.post('/apply-template', [
  authenticate,
  authorize(['admin']),
  body('startDate').isISO8601(),
  body('endDate').isISO8601(),
  body('template').isObject()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { startDate, endDate, template, dentistId } = req.body;

    const start = new Date(startDate);
    const end = new Date(endDate);
    
    // Generate dates in range
    const dates = [];
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      dates.push(new Date(d));
    }

    // Apply template to each date
    for (const date of dates) {
      const dayName = date.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
      const dayTemplate = template[dayName];
      
      if (dayTemplate && dayTemplate.enabled) {
        await Schedule.createFromTemplate(date, dayTemplate, dentistId);
      }
    }

    logger.info(`Template applied from ${startDate} to ${endDate} by ${req.user.email}`);
    res.json({ message: 'Template applied successfully' });
  } catch (error) {
    logger.error('Error applying template:', error);
    res.status(500).json({ error: 'Failed to apply template' });
  }
});

export default router;