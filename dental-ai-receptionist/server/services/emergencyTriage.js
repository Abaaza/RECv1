import moment from 'moment';
import { logger } from '../utils/logger.js';
import Appointment from '../models/Appointment.js';
import Patient from '../models/Patient.js';
import { sendSMS } from './smsService.js';
import { io } from '../server.js';

class EmergencyTriageService {
  constructor() {
    this.triageCategories = {
      critical: {
        priority: 1,
        responseTime: 'immediate',
        color: 'red',
        maxWaitMinutes: 0,
        conditions: [
          'uncontrolled bleeding',
          'difficulty breathing',
          'severe facial swelling',
          'unconscious',
          'severe allergic reaction',
          'jaw fracture',
          'severe head injury'
        ]
      },
      urgent: {
        priority: 2,
        responseTime: '30 minutes',
        color: 'orange',
        maxWaitMinutes: 30,
        conditions: [
          'severe dental pain',
          'dental abscess',
          'knocked out tooth',
          'broken tooth with pain',
          'significant bleeding',
          'facial swelling',
          'post-operative complications'
        ]
      },
      moderate: {
        priority: 3,
        responseTime: '2 hours',
        color: 'yellow',
        maxWaitMinutes: 120,
        conditions: [
          'moderate dental pain',
          'broken tooth without pain',
          'lost filling',
          'loose tooth',
          'mild swelling',
          'jaw pain',
          'broken denture'
        ]
      },
      minor: {
        priority: 4,
        responseTime: '24 hours',
        color: 'green',
        maxWaitMinutes: 1440,
        conditions: [
          'mild toothache',
          'sensitivity',
          'cosmetic concerns',
          'routine follow-up',
          'broken retainer',
          'food stuck between teeth'
        ]
      }
    };

    this.symptomQuestions = [
      {
        id: 'pain_level',
        question: 'On a scale of 1-10, how severe is your pain?',
        type: 'scale',
        weight: 3
      },
      {
        id: 'duration',
        question: 'How long have you been experiencing this issue?',
        type: 'duration',
        options: ['Just started', 'Few hours', '1-2 days', '3+ days'],
        weight: 2
      },
      {
        id: 'swelling',
        question: 'Do you have any facial swelling?',
        type: 'boolean',
        weight: 4
      },
      {
        id: 'bleeding',
        question: 'Are you experiencing any bleeding?',
        type: 'boolean',
        weight: 4
      },
      {
        id: 'fever',
        question: 'Do you have a fever?',
        type: 'boolean',
        weight: 3
      },
      {
        id: 'eating_difficulty',
        question: 'Are you able to eat or drink?',
        type: 'boolean',
        weight: 2
      },
      {
        id: 'sleep_disruption',
        question: 'Is the pain keeping you awake at night?',
        type: 'boolean',
        weight: 2
      },
      {
        id: 'medication_effectiveness',
        question: 'Are over-the-counter pain medications helping?',
        type: 'boolean',
        weight: 1
      }
    ];

    this.protocols = {
      'knocked_out_tooth': {
        immediateActions: [
          'Find the tooth and pick it up by the crown (white part), not the root',
          'If dirty, gently rinse with milk or saline solution (not water)',
          'Try to reinsert the tooth into the socket if possible',
          'If cannot reinsert, store in milk or saliva',
          'Come to office immediately - time is critical!'
        ],
        timeframe: '30 minutes for best outcome',
        supplies: ['Milk', 'Clean gauze', 'Small container']
      },
      'severe_bleeding': {
        immediateActions: [
          'Apply firm, continuous pressure with clean gauze or cloth',
          'Bite down firmly on gauze for 15-20 minutes',
          'Do not rinse or spit - this can worsen bleeding',
          'Keep head elevated',
          'If bleeding persists after 20 minutes, seek immediate care'
        ],
        timeframe: 'Immediate if uncontrolled',
        supplies: ['Clean gauze or cloth', 'Ice pack']
      },
      'dental_abscess': {
        immediateActions: [
          'Rinse with warm salt water several times',
          'Take over-the-counter pain medication as directed',
          'Apply cold compress to outside of face',
          'Do not apply heat to the area',
          'Seek treatment today - infection can spread'
        ],
        timeframe: 'Same day',
        supplies: ['Salt water rinse', 'Pain medication', 'Cold compress']
      },
      'broken_tooth': {
        immediateActions: [
          'Rinse mouth with warm water',
          'Apply cold compress to reduce swelling',
          'Save any broken pieces',
          'Cover sharp edges with dental wax if available',
          'Take pain medication if needed'
        ],
        timeframe: 'Within 24 hours',
        supplies: ['Dental wax', 'Cold compress', 'Container for tooth pieces']
      },
      'severe_pain': {
        immediateActions: [
          'Take recommended dose of pain medication',
          'Apply cold compress to outside of cheek',
          'Rinse with warm salt water',
          'Avoid extremely hot or cold foods',
          'Keep head elevated when lying down'
        ],
        timeframe: 'Same day if severe',
        supplies: ['Pain medication', 'Cold compress', 'Salt']
      }
    };

    this.emergencyQueue = [];
    this.activeEmergencies = new Map();
  }

  async triagePatient(patientInfo, symptoms) {
    try {
      const triageResult = {
        id: `TRIAGE-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date(),
        patient: patientInfo,
        symptoms,
        severity: this.calculateSeverity(symptoms),
        category: null,
        priority: null,
        estimatedWaitTime: null,
        protocol: null,
        instructions: [],
        requiresImmediate911: false
      };

      // Check for life-threatening conditions
      if (this.isLifeThreatening(symptoms)) {
        triageResult.requiresImmediate911 = true;
        triageResult.category = 'critical';
        triageResult.priority = 0;
        triageResult.instructions = [
          'Call 911 immediately',
          'Do not drive yourself to the hospital',
          'Follow emergency operator instructions'
        ];
        
        await this.notifyEmergencyTeam(triageResult);
        return triageResult;
      }

      // Determine triage category
      triageResult.category = this.determineCategory(symptoms);
      const category = this.triageCategories[triageResult.category];
      triageResult.priority = category.priority;
      triageResult.estimatedWaitTime = category.maxWaitMinutes;

      // Get specific protocol if applicable
      const protocol = this.getProtocol(symptoms);
      if (protocol) {
        triageResult.protocol = protocol;
        triageResult.instructions = protocol.immediateActions;
      }

      // Add to emergency queue
      await this.addToEmergencyQueue(triageResult);

      // Find available emergency slot
      const emergencySlot = await this.findEmergencySlot(triageResult);
      if (emergencySlot) {
        triageResult.appointmentSlot = emergencySlot;
        triageResult.estimatedWaitTime = moment(emergencySlot.startTime).diff(moment(), 'minutes');
      }

      // Notify staff
      await this.notifyStaff(triageResult);

      // Store active emergency
      this.activeEmergencies.set(triageResult.id, triageResult);

      return triageResult;
    } catch (error) {
      logger.error('Triage error:', error);
      throw error;
    }
  }

  calculateSeverity(symptoms) {
    let severityScore = 0;

    // Pain level contribution
    if (symptoms.pain_level) {
      severityScore += symptoms.pain_level * 3;
    }

    // Boolean symptoms
    if (symptoms.swelling) severityScore += 15;
    if (symptoms.bleeding) severityScore += 20;
    if (symptoms.fever) severityScore += 12;
    if (!symptoms.eating_difficulty) severityScore += 8;
    if (symptoms.sleep_disruption) severityScore += 7;
    if (!symptoms.medication_effectiveness) severityScore += 5;

    // Duration factor
    if (symptoms.duration === 'Just started') {
      severityScore += 5;
    } else if (symptoms.duration === '3+ days') {
      severityScore += 10; // Chronic issues may indicate infection
    }

    // Specific conditions
    if (symptoms.description) {
      const description = symptoms.description.toLowerCase();
      if (description.includes('knocked out')) severityScore += 30;
      if (description.includes('abscess')) severityScore += 25;
      if (description.includes('infection')) severityScore += 20;
      if (description.includes('fracture')) severityScore += 25;
      if (description.includes('can\'t open mouth')) severityScore += 20;
    }

    return Math.min(severityScore, 100);
  }

  determineCategory(symptoms) {
    const severity = symptoms.severityScore || this.calculateSeverity(symptoms);

    if (severity >= 70) return 'urgent';
    if (severity >= 40) return 'moderate';
    if (severity >= 20) return 'minor';
    return 'minor';
  }

  isLifeThreatening(symptoms) {
    const criticalKeywords = [
      'unconscious',
      'not breathing',
      'difficulty breathing',
      'chest pain',
      'severe allergic',
      'anaphylaxis',
      'uncontrolled bleeding',
      'severe head injury'
    ];

    const description = (symptoms.description || '').toLowerCase();
    return criticalKeywords.some(keyword => description.includes(keyword));
  }

  getProtocol(symptoms) {
    const description = (symptoms.description || '').toLowerCase();

    if (description.includes('knocked out tooth')) {
      return this.protocols.knocked_out_tooth;
    }
    if (description.includes('bleeding') && symptoms.bleeding) {
      return this.protocols.severe_bleeding;
    }
    if (description.includes('abscess') || description.includes('infection')) {
      return this.protocols.dental_abscess;
    }
    if (description.includes('broken tooth') || description.includes('chipped')) {
      return this.protocols.broken_tooth;
    }
    if (symptoms.pain_level >= 7) {
      return this.protocols.severe_pain;
    }

    return null;
  }

  async addToEmergencyQueue(triageResult) {
    this.emergencyQueue.push(triageResult);
    
    // Sort by priority
    this.emergencyQueue.sort((a, b) => {
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }
      return new Date(a.timestamp) - new Date(b.timestamp);
    });

    // Update queue positions
    this.emergencyQueue.forEach((item, index) => {
      item.queuePosition = index + 1;
    });

    // Broadcast queue update
    io.emit('emergency-queue-update', this.getQueueStatus());
  }

  async findEmergencySlot(triageResult) {
    const category = this.triageCategories[triageResult.category];
    const maxWait = category.maxWaitMinutes;
    const now = moment();
    const deadline = now.clone().add(maxWait, 'minutes');

    // Check for available emergency slots
    const emergencySlots = await Appointment.find({
      type: 'emergency_reserved',
      status: 'available',
      startTime: {
        $gte: now.toDate(),
        $lte: deadline.toDate()
      }
    }).sort({ startTime: 1 });

    if (emergencySlots.length > 0) {
      return emergencySlots[0];
    }

    // Try to bump non-urgent appointments if critical
    if (triageResult.category === 'critical' || triageResult.category === 'urgent') {
      return await this.bumpNonUrgentAppointment(deadline);
    }

    // Find next available regular slot
    return await this.findNextAvailableSlot(maxWait);
  }

  async bumpNonUrgentAppointment(deadline) {
    const bumpableAppointments = await Appointment.find({
      type: { $in: ['cleaning', 'checkup', 'consultation'] },
      status: 'scheduled',
      startTime: { $lte: deadline.toDate() },
      priority: { $ne: 'high' }
    }).sort({ startTime: 1 });

    if (bumpableAppointments.length > 0) {
      const toBump = bumpableAppointments[0];
      
      // Notify patient of rescheduling
      await this.notifyPatientOfBump(toBump);
      
      // Mark as rescheduled
      toBump.status = 'rescheduled';
      toBump.rescheduledReason = 'Emergency patient priority';
      await toBump.save();

      return {
        startTime: toBump.startTime,
        endTime: toBump.endTime,
        dentistId: toBump.dentist
      };
    }

    return null;
  }

  async findNextAvailableSlot(maxWaitMinutes) {
    const now = moment();
    const searchEnd = now.clone().add(maxWaitMinutes * 2, 'minutes');

    // This would integrate with the appointment system
    // For now, return a mock slot
    return {
      startTime: now.clone().add(Math.min(maxWaitMinutes, 60), 'minutes').toDate(),
      endTime: now.clone().add(Math.min(maxWaitMinutes, 60) + 45, 'minutes').toDate()
    };
  }

  async notifyEmergencyTeam(triageResult) {
    const message = `🚨 CRITICAL EMERGENCY: ${triageResult.patient.name} - ${triageResult.symptoms.description}. Advised to call 911.`;
    
    // Send to all on-call staff
    const onCallStaff = await this.getOnCallStaff();
    for (const staff of onCallStaff) {
      await sendSMS({
        to: staff.phone,
        body: message
      });
    }

    // Log emergency
    logger.error('Critical emergency triaged:', triageResult);
    
    // Broadcast to connected clients
    io.emit('critical-emergency', triageResult);
  }

  async notifyStaff(triageResult) {
    const category = this.triageCategories[triageResult.category];
    const message = `Emergency Triage: ${triageResult.patient.name} - ${category.color.toUpperCase()} priority. ETA: ${category.responseTime}. ${triageResult.symptoms.description}`;

    // Broadcast to staff dashboard
    io.emit('new-emergency', {
      ...triageResult,
      message
    });

    // SMS to relevant staff for urgent cases
    if (triageResult.category === 'urgent' || triageResult.category === 'critical') {
      const onCallDentist = await this.getOnCallDentist();
      if (onCallDentist) {
        await sendSMS({
          to: onCallDentist.phone,
          body: message
        });
      }
    }

    logger.info('Emergency triage notification sent:', triageResult.id);
  }

  async notifyPatientOfBump(appointment) {
    const patient = await Patient.findById(appointment.patient);
    if (patient) {
      const message = `We need to reschedule your ${moment(appointment.startTime).format('h:mm A')} appointment due to an emergency. We'll call you shortly with new options. We apologize for the inconvenience.`;
      
      await sendSMS({
        to: patient.phone,
        body: message
      });
    }
  }

  async updateEmergencyStatus(emergencyId, status, notes) {
    const emergency = this.activeEmergencies.get(emergencyId);
    if (emergency) {
      emergency.status = status;
      emergency.resolvedAt = status === 'resolved' ? new Date() : null;
      emergency.notes = notes;

      if (status === 'resolved') {
        this.activeEmergencies.delete(emergencyId);
        this.emergencyQueue = this.emergencyQueue.filter(e => e.id !== emergencyId);
      }

      io.emit('emergency-status-update', emergency);
      return emergency;
    }
    throw new Error('Emergency not found');
  }

  getQueueStatus() {
    return {
      queueLength: this.emergencyQueue.length,
      queue: this.emergencyQueue.map(e => ({
        id: e.id,
        position: e.queuePosition,
        category: e.category,
        waitTime: e.estimatedWaitTime,
        patient: e.patient.name
      })),
      byCategory: {
        critical: this.emergencyQueue.filter(e => e.category === 'critical').length,
        urgent: this.emergencyQueue.filter(e => e.category === 'urgent').length,
        moderate: this.emergencyQueue.filter(e => e.category === 'moderate').length,
        minor: this.emergencyQueue.filter(e => e.category === 'minor').length
      }
    };
  }

  async getOnCallStaff() {
    // This would integrate with staff scheduling
    // Mock implementation
    return [
      { name: 'Dr. Smith', phone: '+1234567890', role: 'dentist' },
      { name: 'Nurse Johnson', phone: '+1234567891', role: 'nurse' }
    ];
  }

  async getOnCallDentist() {
    const staff = await this.getOnCallStaff();
    return staff.find(s => s.role === 'dentist');
  }

  generateEmergencyReport() {
    const report = {
      date: new Date(),
      activeEmergencies: this.activeEmergencies.size,
      queueStatus: this.getQueueStatus(),
      averageWaitTimes: {},
      resolutionTimes: {}
    };

    // Calculate average wait times by category
    for (const category of Object.keys(this.triageCategories)) {
      const categoryEmergencies = Array.from(this.activeEmergencies.values())
        .filter(e => e.category === category);
      
      if (categoryEmergencies.length > 0) {
        const totalWait = categoryEmergencies.reduce((sum, e) => 
          sum + (e.estimatedWaitTime || 0), 0);
        report.averageWaitTimes[category] = totalWait / categoryEmergencies.length;
      }
    }

    return report;
  }
}

export default new EmergencyTriageService();