import express from 'express';
import User from '../models/User.js';
import Appointment from '../models/Appointment.js';
import { authorizeRoles } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

router.get('/dashboard', authorizeRoles('admin', 'dentist', 'receptionist'), async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);

    const [
      totalPatients,
      newPatientsThisMonth,
      todayAppointments,
      upcomingAppointments,
      completedAppointments,
      cancelledAppointments,
      revenue
    ] = await Promise.all([
      User.countDocuments({ role: 'patient', isActive: true }),
      User.countDocuments({ 
        role: 'patient', 
        createdAt: { $gte: thisMonth, $lt: nextMonth } 
      }),
      Appointment.countDocuments({ 
        date: { $gte: today, $lt: tomorrow },
        status: { $ne: 'cancelled' }
      }),
      Appointment.countDocuments({ 
        date: { $gte: today },
        status: 'scheduled'
      }),
      Appointment.countDocuments({ 
        date: { $gte: thisMonth, $lt: nextMonth },
        status: 'completed'
      }),
      Appointment.countDocuments({ 
        date: { $gte: thisMonth, $lt: nextMonth },
        status: 'cancelled'
      }),
      Appointment.aggregate([
        {
          $match: {
            date: { $gte: thisMonth, $lt: nextMonth },
            status: 'completed',
            'billing.paid': true
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$billing.totalCost' }
          }
        }
      ])
    ]);

    res.json({
      patients: {
        total: totalPatients,
        newThisMonth: newPatientsThisMonth
      },
      appointments: {
        today: todayAppointments,
        upcoming: upcomingAppointments,
        completedThisMonth: completedAppointments,
        cancelledThisMonth: cancelledAppointments
      },
      revenue: {
        thisMonth: revenue[0]?.total || 0
      }
    });
  } catch (error) {
    logger.error('Error fetching dashboard data:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});

router.get('/appointments', authorizeRoles('admin', 'dentist'), async (req, res) => {
  try {
    const { startDate, endDate, dentistId } = req.query;
    
    const query = {};
    
    if (startDate && endDate) {
      query.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }
    
    if (dentistId) {
      query.dentistId = dentistId;
    }

    const appointments = await Appointment.aggregate([
      { $match: query },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
            status: '$status'
          },
          count: { $sum: 1 }
        }
      },
      {
        $group: {
          _id: '$_id.date',
          statuses: {
            $push: {
              status: '$_id.status',
              count: '$count'
            }
          },
          total: { $sum: '$count' }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.json({ appointments });
  } catch (error) {
    logger.error('Error fetching appointment analytics:', error);
    res.status(500).json({ error: 'Failed to fetch appointment analytics' });
  }
});

router.get('/revenue', authorizeRoles('admin'), async (req, res) => {
  try {
    const { startDate, endDate, groupBy = 'month' } = req.query;
    
    const match = {
      status: 'completed',
      'billing.paid': true
    };
    
    if (startDate && endDate) {
      match.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const dateFormat = groupBy === 'day' ? '%Y-%m-%d' : '%Y-%m';

    const revenue = await Appointment.aggregate([
      { $match: match },
      {
        $group: {
          _id: { $dateToString: { format: dateFormat, date: '$date' } },
          totalRevenue: { $sum: '$billing.totalCost' },
          insuranceRevenue: { $sum: '$billing.insuranceCovered' },
          patientRevenue: { $sum: '$billing.patientResponsibility' },
          appointmentCount: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.json({ revenue });
  } catch (error) {
    logger.error('Error fetching revenue analytics:', error);
    res.status(500).json({ error: 'Failed to fetch revenue analytics' });
  }
});

router.get('/performance', authorizeRoles('admin', 'dentist'), async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const match = {};
    
    if (startDate && endDate) {
      match.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const performance = await Appointment.aggregate([
      { $match: match },
      {
        $lookup: {
          from: 'users',
          localField: 'dentistId',
          foreignField: '_id',
          as: 'dentist'
        }
      },
      { $unwind: '$dentist' },
      {
        $group: {
          _id: '$dentistId',
          dentistName: { 
            $first: { 
              $concat: ['$dentist.profile.firstName', ' ', '$dentist.profile.lastName'] 
            } 
          },
          totalAppointments: { $sum: 1 },
          completedAppointments: {
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
          },
          cancelledAppointments: {
            $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] }
          },
          revenue: {
            $sum: { 
              $cond: [
                { $eq: ['$status', 'completed'] }, 
                '$billing.totalCost', 
                0
              ] 
            }
          },
          averageRating: { $avg: '$rating.score' }
        }
      },
      { $sort: { revenue: -1 } }
    ]);

    res.json({ performance });
  } catch (error) {
    logger.error('Error fetching performance analytics:', error);
    res.status(500).json({ error: 'Failed to fetch performance analytics' });
  }
});

router.get('/patient-retention', authorizeRoles('admin'), async (req, res) => {
  try {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const retention = await User.aggregate([
      { 
        $match: { 
          role: 'patient',
          isActive: true 
        } 
      },
      {
        $lookup: {
          from: 'appointments',
          localField: '_id',
          foreignField: 'patientId',
          as: 'appointments'
        }
      },
      {
        $project: {
          email: 1,
          name: { $concat: ['$profile.firstName', ' ', '$profile.lastName'] },
          totalAppointments: { $size: '$appointments' },
          lastAppointment: { $max: '$appointments.date' },
          hasRecentAppointment: {
            $cond: [
              { $gte: [{ $max: '$appointments.date' }, sixMonthsAgo] },
              true,
              false
            ]
          }
        }
      },
      {
        $group: {
          _id: null,
          totalPatients: { $sum: 1 },
          activePatients: {
            $sum: { $cond: ['$hasRecentAppointment', 1, 0] }
          },
          inactivePatients: {
            $sum: { $cond: ['$hasRecentAppointment', 0, 1] }
          }
        }
      }
    ]);

    const retentionRate = retention[0] 
      ? (retention[0].activePatients / retention[0].totalPatients * 100).toFixed(2)
      : 0;

    res.json({ 
      retention: retention[0] || {},
      retentionRate: `${retentionRate}%`
    });
  } catch (error) {
    logger.error('Error fetching retention analytics:', error);
    res.status(500).json({ error: 'Failed to fetch retention analytics' });
  }
});

export default router;