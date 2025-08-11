import { traumaScenarios, traumaResponseGuidelines } from '../data/traumaScenarios.js';
import { logger } from '../utils/logger.js';
import Appointment from '../models/Appointment.js';
import Patient from '../models/Patient.js';

class TraumaService {
  constructor() {
    this.scenarios = traumaScenarios;
    this.guidelines = traumaResponseGuidelines;
  }

  /**
   * Analyze trauma situation from patient message
   */
  analyzeTrauma(message) {
    const messageLower = message.toLowerCase();
    let matchedScenario = null;
    let confidence = 0;

    // Check each trauma scenario
    for (const scenario of this.scenarios) {
      const keywordMatches = scenario.keywords.filter(keyword => 
        messageLower.includes(keyword)
      ).length;

      if (keywordMatches > 0) {
        const currentConfidence = keywordMatches / scenario.keywords.length;
        if (currentConfidence > confidence) {
          confidence = currentConfidence;
          matchedScenario = scenario;
        }
      }
    }

    // If no direct match, check for general trauma indicators
    if (!matchedScenario) {
      const generalTraumaWords = ['accident', 'fell', 'hit', 'injury', 'trauma', 'emergency', 'bleeding', 'pain', 'swollen'];
      const hasTraumaIndicators = generalTraumaWords.some(word => messageLower.includes(word));
      
      if (hasTraumaIndicators) {
        return {
          isTrauma: true,
          scenario: null,
          severity: 'moderate',
          needsAssessment: true,
          confidence: 0.5
        };
      }
    }

    if (matchedScenario) {
      return {
        isTrauma: true,
        scenario: matchedScenario,
        severity: matchedScenario.severity,
        confidence: confidence,
        response: this.generateResponse(matchedScenario),
        needsImmediate: matchedScenario.severity === 'critical',
        appointmentType: matchedScenario.aiResponse.appointmentType
      };
    }

    return {
      isTrauma: false,
      confidence: 0
    };
  }

  /**
   * Generate appropriate response for trauma scenario
   */
  generateResponse(scenario) {
    const response = {
      message: scenario.aiResponse.immediate,
      instructions: scenario.aiResponse.instructions,
      urgency: scenario.aiResponse.urgency,
      followUp: scenario.aiResponse.followUp,
      requiresER: scenario.aiResponse.appointmentType === 'er_referral'
    };

    // Add assessment questions if available
    if (scenario.aiResponse.assessment) {
      response.assessmentQuestions = scenario.aiResponse.assessment;
    }

    return response;
  }

  /**
   * Create emergency appointment for trauma case
   */
  async createEmergencyAppointment(patientInfo, traumaDetails) {
    try {
      // Find or create patient
      let patient = null;
      if (patientInfo.phone) {
        patient = await Patient.findOne({ phone: patientInfo.phone });
      }

      if (!patient) {
        const nameParts = (patientInfo.name || 'Emergency Patient').split(' ');
        patient = await Patient.create({
          firstName: nameParts[0],
          lastName: nameParts.slice(1).join(' ') || 'Patient',
          phone: patientInfo.phone || `555-EMR-${Math.floor(Math.random() * 9999)}`,
          email: patientInfo.email || `emergency${Date.now()}@dental.com`,
          status: 'active',
          source: 'emergency_ai',
          medicalHistory: {
            notes: `Emergency trauma case: ${traumaDetails.type}`
          }
        });
      }

      // Create emergency appointment
      const now = new Date();
      const appointment = new Appointment({
        patientId: patient._id,
        patientName: `${patient.firstName} ${patient.lastName}`,
        patientPhone: patient.phone,
        type: 'emergency',
        startTime: now,
        endTime: new Date(now.getTime() + 60 * 60 * 1000), // 1 hour slot
        status: 'emergency',
        priority: 'urgent',
        source: 'emergency_ai',
        notes: `TRAUMA: ${traumaDetails.type}\nSeverity: ${traumaDetails.severity}\n${traumaDetails.description}`,
        confirmationNumber: `EMR-${Date.now().toString(36).toUpperCase()}`
      });

      await appointment.save();

      // Emit emergency alert
      if (global.io) {
        global.io.emit('emergency_appointment', {
          appointment,
          trauma: traumaDetails
        });
      }

      logger.info(`Emergency appointment created: ${appointment.confirmationNumber}`);

      return {
        success: true,
        appointment,
        patient,
        message: `Emergency appointment confirmed. Confirmation: ${appointment.confirmationNumber}`
      };
    } catch (error) {
      logger.error('Failed to create emergency appointment:', error);
      throw error;
    }
  }

  /**
   * Get trauma first aid instructions
   */
  getFirstAidInstructions(traumaType) {
    const scenario = this.scenarios.find(s => s.category === traumaType);
    if (scenario) {
      return scenario.aiResponse.instructions;
    }

    // Default emergency instructions
    return [
      "Apply pressure to stop any bleeding",
      "Save any broken tooth pieces in milk",
      "Apply cold compress to reduce swelling",
      "Come to the clinic immediately"
    ];
  }

  /**
   * Determine if ER referral is needed
   */
  needsERReferral(symptoms) {
    const erIndicators = [
      'can\'t breathe',
      'can\'t swallow',
      'unconscious',
      'severe bleeding',
      'jaw fracture',
      'facial bones',
      'eye swelling',
      'neck swelling'
    ];

    const symptomsLower = symptoms.toLowerCase();
    return erIndicators.some(indicator => symptomsLower.includes(indicator));
  }

  /**
   * Generate triage priority
   */
  getTriagePriority(severity, symptoms) {
    if (this.needsERReferral(symptoms)) {
      return {
        level: 1,
        action: 'IMMEDIATE ER REFERRAL',
        color: 'red'
      };
    }

    switch (severity) {
      case 'critical':
        return {
          level: 2,
          action: 'IMMEDIATE DENTAL CARE',
          color: 'orange',
          timeframe: '0-30 minutes'
        };
      case 'high':
        return {
          level: 3,
          action: 'URGENT CARE NEEDED',
          color: 'yellow',
          timeframe: '2-4 hours'
        };
      case 'moderate':
        return {
          level: 4,
          action: 'SAME DAY APPOINTMENT',
          color: 'green',
          timeframe: 'Within 24 hours'
        };
      default:
        return {
          level: 5,
          action: 'ROUTINE APPOINTMENT',
          color: 'blue',
          timeframe: 'Next available'
        };
    }
  }

  /**
   * Generate comprehensive trauma response
   */
  async generateTraumaResponse(message, patientInfo = {}) {
    const analysis = this.analyzeTrauma(message);

    if (!analysis.isTrauma) {
      return null;
    }

    const response = {
      isTrauma: true,
      analysis,
      triage: this.getTriagePriority(analysis.severity, message)
    };

    // If critical, create emergency appointment
    if (analysis.severity === 'critical' || analysis.needsImmediate) {
      try {
        const emergencyResult = await this.createEmergencyAppointment(patientInfo, {
          type: analysis.scenario?.category || 'trauma',
          severity: analysis.severity,
          description: message
        });
        response.appointment = emergencyResult.appointment;
        response.confirmationNumber = emergencyResult.appointment.confirmationNumber;
      } catch (error) {
        logger.error('Failed to create emergency appointment:', error);
        response.appointmentError = true;
      }
    }

    // Build the response message
    if (analysis.scenario) {
      response.message = this.buildTraumaResponseMessage(analysis.scenario, response.appointment);
      response.instructions = analysis.response.instructions;
      response.urgency = analysis.response.urgency;
    } else {
      response.message = "I understand you've had a dental trauma. Let me ask you a few questions to help determine the urgency.";
      response.needsAssessment = true;
      response.assessmentQuestions = [
        "Is there any bleeding?",
        "Is the tooth loose, broken, or knocked out?",
        "Are you in severe pain?",
        "When did the injury occur?"
      ];
    }

    return response;
  }

  /**
   * Build comprehensive response message
   */
  buildTraumaResponseMessage(scenario, appointment) {
    let message = scenario.aiResponse.immediate + "\n\n";
    
    // Add instructions
    message += "Please follow these steps:\n";
    scenario.aiResponse.instructions.forEach((instruction, index) => {
      message += `${index + 1}. ${instruction}\n`;
    });

    // Add urgency
    message += `\nUrgency: ${scenario.aiResponse.urgency}\n`;

    // Add appointment confirmation if created
    if (appointment) {
      message += `\n✓ Emergency appointment confirmed: ${appointment.confirmationNumber}\n`;
      message += "We're preparing for your arrival.\n";
    }

    // Add follow-up
    message += `\n${scenario.aiResponse.followUp}`;

    return message;
  }

  /**
   * Get follow-up care instructions
   */
  getFollowUpInstructions(traumaType) {
    const generalInstructions = {
      'knocked-out-tooth': [
        "The tooth will need to be monitored for several weeks",
        "Root canal may be needed if nerve dies",
        "Follow-up X-rays will be required",
        "Avoid contact sports until cleared"
      ],
      'fractured-tooth': [
        "Monitor for color changes",
        "Watch for signs of infection",
        "May need crown or veneer",
        "Avoid hard foods"
      ],
      'soft-tissue': [
        "Keep area clean",
        "Salt water rinses after 24 hours",
        "Watch for signs of infection",
        "Sutures may need removal in 7-10 days"
      ]
    };

    return generalInstructions[traumaType] || [
      "Follow-up appointment in 1 week",
      "Monitor for changes",
      "Call if pain worsens",
      "Maintain good oral hygiene"
    ];
  }
}

export default new TraumaService();