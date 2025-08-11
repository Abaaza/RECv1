const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    timestamp: new Date().toISOString()
  });
});

// In-memory storage (replace with database in production)
let appointments = [];
let callLogs = [];
let patients = [];
let dentists = [
  { id: '1', name: 'Dr. Smith', specialization: 'General', available: true },
  { id: '2', name: 'Dr. Johnson', specialization: 'Orthodontics', available: true },
  { id: '3', name: 'Dr. Williams', specialization: 'Oral Surgery', available: true }
];
let emergencies = [];
let notifications = [];
let reminders = [];

// Validation middleware
const validateAppointment = (req, res, next) => {
  const { patientName, patientPhone, startTime, endTime, reason } = req.body;
  
  if (!patientName || !patientPhone || !startTime || !endTime) {
    return res.status(400).json({ 
      error: 'Missing required fields: patientName, patientPhone, startTime, endTime' 
    });
  }
  
  if (new Date(startTime) >= new Date(endTime)) {
    return res.status(400).json({ 
      error: 'End time must be after start time' 
    });
  }
  
  next();
};

// Routes
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Dental AI Receptionist API is running',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Appointments endpoints
app.get('/api/appointments', (req, res) => {
  const { date } = req.query;
  if (date) {
    const filtered = appointments.filter(apt => 
      apt.startTime.startsWith(date)
    );
    return res.json(filtered);
  }
  res.json(appointments);
});

app.post('/api/appointments', validateAppointment, (req, res) => {
  try {
    // Check for conflicts
    const conflict = appointments.find(apt => {
      if (apt.status === 'cancelled') return false;
      const newStart = new Date(req.body.startTime);
      const newEnd = new Date(req.body.endTime);
      const aptStart = new Date(apt.startTime);
      const aptEnd = new Date(apt.endTime);
      return (newStart < aptEnd && newEnd > aptStart);
    });
    
    if (conflict) {
      return res.status(409).json({ 
        error: 'Time slot conflicts with existing appointment',
        conflictingAppointment: conflict.id
      });
    }
    
    const appointment = {
      id: Date.now().toString(),
      ...req.body,
      status: 'confirmed',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    appointments.push(appointment);
    res.status(201).json(appointment);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create appointment' });
  }
});

app.put('/api/appointments/:id', (req, res) => {
  const { id } = req.params;
  const index = appointments.findIndex(apt => apt.id === id);
  
  if (index === -1) {
    return res.status(404).json({ error: 'Appointment not found' });
  }
  
  appointments[index] = { ...appointments[index], ...req.body };
  res.json(appointments[index]);
});

app.delete('/api/appointments/:id', (req, res) => {
  const { id } = req.params;
  const index = appointments.findIndex(apt => apt.id === id);
  
  if (index === -1) {
    return res.status(404).json({ error: 'Appointment not found' });
  }
  
  appointments[index].status = 'cancelled';
  res.json({ message: 'Appointment cancelled successfully' });
});

// Call logs endpoints
app.get('/api/call-logs', (req, res) => {
  res.json(callLogs);
});

app.post('/api/call-logs', (req, res) => {
  const callLog = {
    id: Date.now().toString(),
    ...req.body,
    timestamp: new Date().toISOString()
  };
  callLogs.push(callLog);
  res.status(201).json(callLog);
});

// Available slots endpoint
app.get('/api/available-slots', (req, res) => {
  const { date, duration = 30 } = req.query;
  
  if (!date) {
    return res.status(400).json({ error: 'Date parameter is required' });
  }
  
  // Generate time slots (simplified logic)
  const slots = [];
  const workingHours = { start: 9, end: 17 };
  const slotDuration = 30; // minutes
  
  for (let hour = workingHours.start; hour < workingHours.end; hour++) {
    for (let minute = 0; minute < 60; minute += slotDuration) {
      // Skip lunch hour (12-13)
      if (hour === 12) continue;
      
      const slotTime = `${date}T${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}:00`;
      
      // Check if slot is available (not booked)
      const isBooked = appointments.some(apt => {
        const aptStart = new Date(apt.startTime);
        const aptEnd = new Date(apt.endTime);
        const slotStart = new Date(slotTime);
        const slotEnd = new Date(slotStart.getTime() + duration * 60000);
        
        return (slotStart < aptEnd && slotEnd > aptStart);
      });
      
      if (!isBooked) {
        slots.push({
          time: slotTime,
          available: true
        });
      }
    }
  }
  
  res.json(slots);
});

// Emergency protocol endpoint
app.post('/api/emergency', (req, res) => {
  const { type, patientInfo, severity } = req.body;
  
  if (!type || !patientInfo || !severity) {
    return res.status(400).json({ 
      error: 'Missing required fields: type, patientInfo, severity' 
    });
  }
  
  // Find available dentist based on emergency type
  const availableDentist = dentists.find(d => d.available);
  
  const emergency = {
    id: Date.now().toString(),
    type,
    patientInfo,
    severity,
    assignedDentist: availableDentist ? availableDentist.name : null,
    timestamp: new Date().toISOString(),
    status: 'active',
    triageNotes: getTriageInstructions(type, severity)
  };
  
  emergencies.push(emergency);
  
  // Update dentist availability if assigned
  if (availableDentist) {
    availableDentist.available = false;
  }
  
  console.log('EMERGENCY ALERT:', emergency);
  
  res.status(201).json({
    emergency,
    instructions: emergency.triageNotes,
    assignedDentist: availableDentist ? availableDentist.name : 'On-call dentist',
    estimatedResponse: severity === 'critical' ? '5 minutes' : '10-15 minutes'
  });
});

// Triage instructions helper
function getTriageInstructions(type, severity) {
  const instructions = {
    trauma: {
      critical: 'Apply pressure to stop bleeding. Keep tooth fragments if available. Come immediately.',
      moderate: 'Apply cold compress. Take pain medication if needed. Come within 1 hour.',
      mild: 'Rinse with warm salt water. Schedule appointment within 24 hours.'
    },
    pain: {
      critical: 'Take prescribed pain medication. Apply ice pack. Come immediately.',
      moderate: 'Take over-the-counter pain relief. Avoid hot/cold foods. Come today.',
      mild: 'Use sensitivity toothpaste. Avoid trigger foods. Schedule regular appointment.'
    },
    infection: {
      critical: 'Do not delay. Facial swelling requires immediate attention.',
      moderate: 'Rinse with antiseptic mouthwash. Come within 2-4 hours.',
      mild: 'Maintain oral hygiene. Schedule appointment within 48 hours.'
    }
  };
  
  return instructions[type]?.[severity] || 'Please come to the clinic as soon as possible.';
}

// Patients endpoints
app.get('/api/patients', (req, res) => {
  res.json(patients);
});

app.post('/api/patients', (req, res) => {
  const { name, phone, email, dateOfBirth } = req.body;
  
  if (!name || !phone) {
    return res.status(400).json({ error: 'Name and phone are required' });
  }
  
  const patient = {
    id: Date.now().toString(),
    name,
    phone,
    email,
    dateOfBirth,
    registeredAt: new Date().toISOString(),
    appointmentHistory: []
  };
  
  patients.push(patient);
  res.status(201).json(patient);
});

// Dentists endpoints
app.get('/api/dentists', (req, res) => {
  res.json(dentists);
});

app.get('/api/dentists/available', (req, res) => {
  const available = dentists.filter(d => d.available);
  res.json(available);
});

// Statistics endpoint
app.get('/api/stats', (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const todayAppointments = appointments.filter(apt => 
    apt.startTime.startsWith(today) && apt.status !== 'cancelled'
  );
  
  res.json({
    totalAppointments: appointments.length,
    todayAppointments: todayAppointments.length,
    totalPatients: patients.length,
    totalCallLogs: callLogs.length,
    activeEmergencies: emergencies.filter(e => e.status === 'active').length,
    availableDentists: dentists.filter(d => d.available).length
  });
});

// Search appointments
app.get('/api/appointments/search', (req, res) => {
  const { patientName, patientPhone, from, to } = req.query;
  
  let results = appointments;
  
  if (patientName) {
    results = results.filter(apt => 
      apt.patientName.toLowerCase().includes(patientName.toLowerCase())
    );
  }
  
  if (patientPhone) {
    results = results.filter(apt => apt.patientPhone.includes(patientPhone));
  }
  
  if (from) {
    results = results.filter(apt => new Date(apt.startTime) >= new Date(from));
  }
  
  if (to) {
    results = results.filter(apt => new Date(apt.startTime) <= new Date(to));
  }
  
  res.json(results);
});

// Notifications endpoints
app.get('/api/notifications', (req, res) => {
  const { unread } = req.query;
  let result = notifications;
  
  if (unread === 'true') {
    result = notifications.filter(n => !n.read);
  }
  
  res.json(result);
});

app.post('/api/notifications', (req, res) => {
  const { type, title, message, recipient, priority } = req.body;
  
  if (!type || !title || !message) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  const notification = {
    id: Date.now().toString(),
    type,
    title,
    message,
    recipient,
    priority: priority || 'normal',
    read: false,
    createdAt: new Date().toISOString(),
    channel: determineChannel(type, priority)
  };
  
  notifications.push(notification);
  
  // Simulate sending notification
  sendNotification(notification);
  
  res.status(201).json(notification);
});

app.put('/api/notifications/:id/read', (req, res) => {
  const { id } = req.params;
  const notification = notifications.find(n => n.id === id);
  
  if (!notification) {
    return res.status(404).json({ error: 'Notification not found' });
  }
  
  notification.read = true;
  notification.readAt = new Date().toISOString();
  
  res.json(notification);
});

// Reminders endpoints
app.get('/api/reminders', (req, res) => {
  const { date, patientId } = req.query;
  let result = reminders;
  
  if (date) {
    result = result.filter(r => r.scheduledFor.startsWith(date));
  }
  
  if (patientId) {
    result = result.filter(r => r.patientId === patientId);
  }
  
  res.json(result);
});

app.post('/api/reminders', (req, res) => {
  const { appointmentId, patientId, type, scheduledFor, message } = req.body;
  
  if (!appointmentId || !patientId || !scheduledFor) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  const reminder = {
    id: Date.now().toString(),
    appointmentId,
    patientId,
    type: type || 'appointment',
    scheduledFor,
    message: message || generateReminderMessage(type),
    status: 'pending',
    createdAt: new Date().toISOString()
  };
  
  reminders.push(reminder);
  
  // Schedule reminder (in production, use a job queue)
  scheduleReminder(reminder);
  
  res.status(201).json(reminder);
});

// Communication preferences endpoint
app.post('/api/patients/:id/preferences', (req, res) => {
  const { id } = req.params;
  const { smsEnabled, emailEnabled, preferredTime, language } = req.body;
  
  const patient = patients.find(p => p.id === id);
  
  if (!patient) {
    return res.status(404).json({ error: 'Patient not found' });
  }
  
  patient.communicationPreferences = {
    smsEnabled: smsEnabled !== undefined ? smsEnabled : true,
    emailEnabled: emailEnabled !== undefined ? emailEnabled : true,
    preferredTime: preferredTime || 'morning',
    language: language || 'en'
  };
  
  res.json(patient);
});

// Helper functions
function determineChannel(type, priority) {
  if (priority === 'urgent' || type === 'emergency') {
    return ['sms', 'email', 'push'];
  }
  if (type === 'appointment') {
    return ['email', 'sms'];
  }
  return ['email'];
}

function sendNotification(notification) {
  // In production, integrate with SMS/Email services
  console.log(`📧 Sending notification:`, notification);
  
  if (notification.channel.includes('sms')) {
    console.log(`📱 SMS would be sent to: ${notification.recipient}`);
  }
  
  if (notification.channel.includes('email')) {
    console.log(`✉️ Email would be sent to: ${notification.recipient}`);
  }
  
  return true;
}

function generateReminderMessage(type) {
  const messages = {
    appointment: 'You have an upcoming appointment at SmileCare Dental',
    followup: 'It\'s time for your dental checkup',
    treatment: 'Your treatment plan requires attention',
    payment: 'Payment reminder for your recent visit'
  };
  
  return messages[type] || 'Reminder from SmileCare Dental';
}

function scheduleReminder(reminder) {
  // In production, use a job scheduler like node-cron or bull
  const delay = new Date(reminder.scheduledFor) - new Date();
  
  if (delay > 0) {
    setTimeout(() => {
      console.log(`⏰ Sending scheduled reminder:`, reminder);
      reminder.status = 'sent';
      reminder.sentAt = new Date().toISOString();
      
      // Create a notification from the reminder
      const notification = {
        id: Date.now().toString(),
        type: 'reminder',
        title: 'Appointment Reminder',
        message: reminder.message,
        recipient: reminder.patientId,
        priority: 'normal',
        read: false,
        createdAt: new Date().toISOString()
      };
      
      notifications.push(notification);
      sendNotification(notification);
    }, Math.min(delay, 2147483647)); // Cap at max timeout value
  }
}

// Start server
app.listen(PORT, () => {
  console.log(`🦷 Dental AI Receptionist API server running on port ${PORT}`);
  console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/api/health`);
  console.log(`📧 Notification system: Active`);
  console.log(`🌐 Multi-language support: Enabled`);
});