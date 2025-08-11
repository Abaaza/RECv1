import mongoose from 'mongoose';

const procedureSchema = new mongoose.Schema({
  procedureCode: String,
  procedureName: String,
  description: String,
  tooth: [String],
  priority: {
    type: String,
    enum: ['urgent', 'high', 'medium', 'low', 'elective'],
    default: 'medium'
  },
  estimatedDuration: Number, // minutes
  estimatedCost: Number,
  insuranceEstimate: Number,
  patientEstimate: Number,
  status: {
    type: String,
    enum: ['planned', 'scheduled', 'in_progress', 'completed', 'cancelled', 'declined'],
    default: 'planned'
  },
  scheduledDate: Date,
  completedDate: Date,
  completedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  notes: String,
  preAuthorizationRequired: Boolean,
  preAuthorizationStatus: String,
  preAuthorizationNumber: String,
  dependencies: [String], // Other procedure IDs that must be completed first
  alternatives: [{
    procedureCode: String,
    procedureName: String,
    estimatedCost: Number,
    pros: [String],
    cons: [String]
  }],
  complications: [{
    type: String,
    probability: String,
    preventiveMeasures: String
  }],
  postOpInstructions: [String],
  followUpRequired: Boolean,
  followUpDays: Number
});

const phaseSchema = new mongoose.Schema({
  phaseNumber: Number,
  name: String,
  description: String,
  procedures: [procedureSchema],
  estimatedDuration: String, // e.g., "2-3 weeks"
  estimatedCost: Number,
  status: {
    type: String,
    enum: ['pending', 'active', 'completed', 'on_hold'],
    default: 'pending'
  },
  startDate: Date,
  completionDate: Date,
  prerequisites: [String],
  goals: [String]
});

const consentSchema = new mongoose.Schema({
  type: String,
  proceduresCovered: [String],
  consentGivenDate: Date,
  consentExpiryDate: Date,
  signatureUrl: String,
  witnessName: String,
  witnessSignatureUrl: String
});

const paymentPlanSchema = new mongoose.Schema({
  totalAmount: Number,
  downPayment: Number,
  monthlyPayment: Number,
  numberOfPayments: Number,
  interestRate: Number,
  startDate: Date,
  status: {
    type: String,
    enum: ['pending', 'active', 'completed', 'defaulted'],
    default: 'pending'
  },
  payments: [{
    dueDate: Date,
    amount: Number,
    paidDate: Date,
    status: String,
    paymentMethod: String,
    transactionId: String
  }],
  notes: String
});

const treatmentPlanSchema = new mongoose.Schema({
  patient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
    required: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  primaryDentist: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  specialists: [{
    dentist: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    specialty: String,
    procedures: [String]
  }],
  diagnosis: [{
    code: String,
    description: String,
    severity: String,
    affectedTeeth: [String],
    dateIdentified: Date
  }],
  chiefComplaint: String,
  clinicalFindings: String,
  radiographicFindings: String,
  phases: [phaseSchema],
  totalEstimatedCost: Number,
  insuranceEstimate: Number,
  patientEstimate: Number,
  status: {
    type: String,
    enum: ['draft', 'proposed', 'accepted', 'rejected', 'in_progress', 'completed', 'archived'],
    default: 'draft'
  },
  proposedDate: Date,
  acceptedDate: Date,
  rejectedDate: Date,
  rejectionReason: String,
  completedDate: Date,
  expiryDate: Date,
  alternativePlans: [{
    name: String,
    description: String,
    totalCost: Number,
    pros: [String],
    cons: [String]
  }],
  consents: [consentSchema],
  paymentPlan: paymentPlanSchema,
  timeline: {
    estimatedStartDate: Date,
    estimatedEndDate: Date,
    actualStartDate: Date,
    actualEndDate: Date
  },
  priorities: {
    painRelief: Boolean,
    functionRestoration: Boolean,
    aesthetics: Boolean,
    prevention: Boolean
  },
  patientGoals: [String],
  specialConsiderations: [String],
  riskAssessment: {
    overallRisk: {
      type: String,
      enum: ['low', 'moderate', 'high']
    },
    factors: [{
      factor: String,
      level: String,
      mitigation: String
    }]
  },
  followUpSchedule: [{
    type: String,
    frequency: String,
    duration: String,
    notes: String
  }],
  documents: [{
    name: String,
    type: String,
    url: String,
    uploadedDate: Date
  }],
  communications: [{
    date: Date,
    type: {
      type: String,
      enum: ['email', 'phone', 'in_person', 'sms']
    },
    subject: String,
    content: String,
    sentBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }],
  revisions: [{
    date: Date,
    revisedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    changes: String,
    reason: String
  }],
  notes: String,
  tags: [String],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Indexes
treatmentPlanSchema.index({ patient: 1, status: 1 });
treatmentPlanSchema.index({ primaryDentist: 1 });
treatmentPlanSchema.index({ createdAt: -1 });
treatmentPlanSchema.index({ 'phases.procedures.status': 1 });

// Virtual for progress percentage
treatmentPlanSchema.virtual('progressPercentage').get(function() {
  if (!this.phases || this.phases.length === 0) return 0;
  
  let totalProcedures = 0;
  let completedProcedures = 0;
  
  this.phases.forEach(phase => {
    phase.procedures.forEach(procedure => {
      totalProcedures++;
      if (procedure.status === 'completed') {
        completedProcedures++;
      }
    });
  });
  
  return totalProcedures > 0 ? Math.round((completedProcedures / totalProcedures) * 100) : 0;
});

// Virtual for remaining cost
treatmentPlanSchema.virtual('remainingCost').get(function() {
  if (!this.phases) return this.totalEstimatedCost || 0;
  
  let remainingCost = 0;
  
  this.phases.forEach(phase => {
    phase.procedures.forEach(procedure => {
      if (procedure.status !== 'completed' && procedure.status !== 'cancelled') {
        remainingCost += procedure.estimatedCost || 0;
      }
    });
  });
  
  return remainingCost;
});

// Methods
treatmentPlanSchema.methods.getNextProcedures = function(limit = 5) {
  const nextProcedures = [];
  
  for (const phase of this.phases) {
    if (phase.status === 'active' || phase.status === 'pending') {
      for (const procedure of phase.procedures) {
        if (procedure.status === 'planned' || procedure.status === 'scheduled') {
          // Check dependencies
          let dependenciesMet = true;
          if (procedure.dependencies && procedure.dependencies.length > 0) {
            for (const depId of procedure.dependencies) {
              const depProcedure = this.findProcedureById(depId);
              if (depProcedure && depProcedure.status !== 'completed') {
                dependenciesMet = false;
                break;
              }
            }
          }
          
          if (dependenciesMet) {
            nextProcedures.push({
              procedure,
              phase: phase.name,
              phaseNumber: phase.phaseNumber
            });
            
            if (nextProcedures.length >= limit) {
              return nextProcedures;
            }
          }
        }
      }
    }
  }
  
  return nextProcedures;
};

treatmentPlanSchema.methods.findProcedureById = function(procedureId) {
  for (const phase of this.phases) {
    for (const procedure of phase.procedures) {
      if (procedure._id.toString() === procedureId) {
        return procedure;
      }
    }
  }
  return null;
};

treatmentPlanSchema.methods.updateProcedureStatus = function(procedureId, status, additionalData = {}) {
  const procedure = this.findProcedureById(procedureId);
  
  if (procedure) {
    procedure.status = status;
    
    if (status === 'completed') {
      procedure.completedDate = additionalData.completedDate || new Date();
      procedure.completedBy = additionalData.completedBy;
    } else if (status === 'scheduled') {
      procedure.scheduledDate = additionalData.scheduledDate;
    }
    
    if (additionalData.notes) {
      procedure.notes = additionalData.notes;
    }
    
    // Update phase status if needed
    this.updatePhaseStatuses();
    
    return this.save();
  }
  
  throw new Error('Procedure not found');
};

treatmentPlanSchema.methods.updatePhaseStatuses = function() {
  for (const phase of this.phases) {
    const procedures = phase.procedures;
    const allCompleted = procedures.every(p => p.status === 'completed' || p.status === 'cancelled');
    const anyActive = procedures.some(p => p.status === 'in_progress' || p.status === 'scheduled');
    const anyCompleted = procedures.some(p => p.status === 'completed');
    
    if (allCompleted) {
      phase.status = 'completed';
      phase.completionDate = new Date();
    } else if (anyActive || anyCompleted) {
      phase.status = 'active';
      if (!phase.startDate) {
        phase.startDate = new Date();
      }
    }
  }
  
  // Update overall plan status
  const allPhasesCompleted = this.phases.every(p => p.status === 'completed');
  const anyPhaseActive = this.phases.some(p => p.status === 'active');
  
  if (allPhasesCompleted && this.status === 'in_progress') {
    this.status = 'completed';
    this.completedDate = new Date();
  } else if (anyPhaseActive && this.status === 'accepted') {
    this.status = 'in_progress';
    this.timeline.actualStartDate = new Date();
  }
};

treatmentPlanSchema.methods.calculateInsuranceCoverage = async function(insuranceInfo) {
  let totalInsuranceEstimate = 0;
  let totalPatientEstimate = 0;
  
  for (const phase of this.phases) {
    for (const procedure of phase.procedures) {
      if (procedure.status !== 'cancelled') {
        // This would integrate with the insurance verification service
        const coverage = await this.estimateProcedureCoverage(
          procedure.procedureCode,
          procedure.estimatedCost,
          insuranceInfo
        );
        
        procedure.insuranceEstimate = coverage.insurancePayment;
        procedure.patientEstimate = coverage.patientResponsibility;
        
        totalInsuranceEstimate += coverage.insurancePayment;
        totalPatientEstimate += coverage.patientResponsibility;
      }
    }
  }
  
  this.insuranceEstimate = totalInsuranceEstimate;
  this.patientEstimate = totalPatientEstimate;
  
  return this.save();
};

treatmentPlanSchema.methods.estimateProcedureCoverage = async function(procedureCode, cost, insuranceInfo) {
  // Simplified estimation - would integrate with actual insurance service
  const coveragePercentages = {
    'D01': 100, // Preventive
    'D02': 80,  // Basic restorative
    'D03': 80,  // Endodontics
    'D04': 80,  // Periodontics
    'D05': 50,  // Removable prosthodontics
    'D06': 50,  // Implant services
    'D07': 80,  // Oral surgery
    'D08': 50,  // Orthodontics
    'D09': 0    // Adjunctive services
  };
  
  const prefix = procedureCode ? procedureCode.substring(0, 3) : 'D09';
  const coveragePercent = coveragePercentages[prefix] || 0;
  
  const insurancePayment = (cost * coveragePercent) / 100;
  const patientResponsibility = cost - insurancePayment;
  
  return {
    insurancePayment,
    patientResponsibility,
    coveragePercentage: coveragePercent
  };
};

treatmentPlanSchema.methods.generatePaymentSchedule = function(options = {}) {
  const {
    downPaymentPercent = 20,
    numberOfMonths = 12,
    interestRate = 0
  } = options;
  
  const totalAmount = this.patientEstimate || this.totalEstimatedCost;
  const downPayment = totalAmount * (downPaymentPercent / 100);
  const remainingAmount = totalAmount - downPayment;
  
  const monthlyPayment = interestRate > 0 
    ? this.calculateMonthlyPaymentWithInterest(remainingAmount, numberOfMonths, interestRate)
    : remainingAmount / numberOfMonths;
  
  const payments = [];
  const startDate = new Date();
  
  for (let i = 0; i < numberOfMonths; i++) {
    const dueDate = new Date(startDate);
    dueDate.setMonth(dueDate.getMonth() + i + 1);
    
    payments.push({
      dueDate,
      amount: monthlyPayment,
      status: 'pending'
    });
  }
  
  this.paymentPlan = {
    totalAmount,
    downPayment,
    monthlyPayment,
    numberOfPayments: numberOfMonths,
    interestRate,
    startDate,
    status: 'pending',
    payments
  };
  
  return this.save();
};

treatmentPlanSchema.methods.calculateMonthlyPaymentWithInterest = function(principal, months, annualRate) {
  const monthlyRate = annualRate / 100 / 12;
  return principal * (monthlyRate * Math.pow(1 + monthlyRate, months)) / 
         (Math.pow(1 + monthlyRate, months) - 1);
};

// Static methods
treatmentPlanSchema.statics.findActiveForPatient = function(patientId) {
  return this.findOne({
    patient: patientId,
    status: { $in: ['accepted', 'in_progress'] }
  }).sort({ createdAt: -1 });
};

treatmentPlanSchema.statics.findPendingPreAuthorizations = function() {
  return this.find({
    'phases.procedures.preAuthorizationRequired': true,
    'phases.procedures.preAuthorizationStatus': { $ne: 'approved' },
    status: { $in: ['accepted', 'in_progress'] }
  });
};

const TreatmentPlan = mongoose.model('TreatmentPlan', treatmentPlanSchema);

export default TreatmentPlan;