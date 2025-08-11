import express from 'express';
import Patient from '../models/Patient.js';
import Appointment from '../models/Appointment.js';
import CallLog from '../models/CallLog.js';
import Emergency from '../models/Emergency.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

// Get dashboard statistics
router.get('/', async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const thisMonth = new Date();
    thisMonth.setDate(1);
    thisMonth.setHours(0, 0, 0, 0);
    
    const lastMonth = new Date(thisMonth);
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    
    // Get patient statistics
    const totalPatients = await Patient.countDocuments();
    const newPatientsThisMonth = await Patient.countDocuments({
      createdAt: { $gte: thisMonth }
    });
    
    // Get today's appointments
    const todayAppointments = await Appointment.countDocuments({
      date: { $gte: today, $lt: tomorrow }
    });
    
    // Get completed appointments for completion rate
    const totalAppointmentsThisMonth = await Appointment.countDocuments({
      date: { $gte: thisMonth }
    });
    
    const completedAppointmentsThisMonth = await Appointment.countDocuments({
      date: { $gte: thisMonth },
      status: 'completed'
    });
    
    const appointmentCompletion = totalAppointmentsThisMonth > 0 
      ? Math.round((completedAppointmentsThisMonth / totalAppointmentsThisMonth) * 100)
      : 0;
    
    // Calculate revenue (using average appointment cost)
    const averageAppointmentCost = 150; // Default average
    const totalRevenue = completedAppointmentsThisMonth * averageAppointmentCost;
    
    // Get call logs statistics
    const totalCallLogs = await CallLog.countDocuments({
      createdAt: { $gte: thisMonth }
    });
    
    // Get active emergencies
    const activeEmergencies = await Emergency.countDocuments({
      status: 'active',
      createdAt: { $gte: today }
    });
    
    // Calculate average wait time (simulated based on appointment density)
    const appointmentDensity = todayAppointments / 8; // Assuming 8 hour workday
    const averageWaitTime = Math.max(5, Math.min(30, Math.round(appointmentDensity * 5)));
    
    // Calculate patient satisfaction (simulated based on completion rate and wait time)
    const patientSatisfaction = Math.min(100, Math.max(70, 
      100 - (averageWaitTime / 2) + (appointmentCompletion / 4)
    ));
    
    // Weekly appointment trends
    const weeklyTrends = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);
      
      const dayAppointments = await Appointment.countDocuments({
        date: { $gte: date, $lt: nextDate }
      });
      
      const dayCancellations = await Appointment.countDocuments({
        date: { $gte: date, $lt: nextDate },
        status: 'cancelled'
      });
      
      weeklyTrends.push({
        day: date.toLocaleDateString('en-US', { weekday: 'short' }),
        appointments: dayAppointments,
        cancellations: dayCancellations
      });
    }
    
    // Service distribution (based on appointment types)
    const serviceTypes = await Appointment.aggregate([
      { $match: { date: { $gte: thisMonth } } },
      { $group: { _id: '$type', count: { $sum: 1 } } }
    ]);
    
    const serviceColors = {
      'Regular Checkup': '#3B82F6',
      'Emergency': '#EF4444',
      'Consultation': '#10B981',
      'Filling': '#F59E0B',
      'Root Canal': '#8B5CF6',
      'Extraction': '#EC4899',
      'Crown/Bridge': '#06B6D4',
      'Orthodontic': '#84CC16'
    };
    
    const serviceDistribution = serviceTypes.map(service => ({
      name: service._id || 'Other',
      value: service.count,
      color: serviceColors[service._id] || '#6B7280'
    }));
    
    // Peak hours analysis
    const peakHours = [];
    for (let hour = 8; hour <= 17; hour++) {
      const hourStr = `${hour}:00`;
      
      // Count appointments for this hour across the month
      const appointmentsAtHour = await Appointment.countDocuments({
        date: { $gte: thisMonth },
        time: { $regex: `^${hour.toString().padStart(2, '0')}:` }
      });
      
      const callsAtHour = Math.floor(appointmentsAtHour * 1.2); // Estimate calls
      
      peakHours.push({
        hour: hourStr,
        appointments: appointmentsAtHour,
        calls: callsAtHour
      });
    }
    
    const stats = {
      totalPatients,
      todayAppointments,
      totalRevenue,
      averageWaitTime,
      patientSatisfaction: Math.round(patientSatisfaction),
      emergenciesHandled: activeEmergencies,
      callsAnswered: totalCallLogs,
      appointmentCompletion,
      newPatientsThisMonth,
      weeklyTrends,
      serviceDistribution,
      peakHours
    };
    
    res.json(stats);
  } catch (error) {
    logger.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

export default router;