import mongoose from 'mongoose';

const insuranceVerificationSchema = new mongoose.Schema({
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
    required: true,
    index: true
  },
  patientName: {
    type: String,
    required: true
  },
  provider: {
    type: String,
    required: true
  },
  policyNumber: {
    type: String,
    required: true,
    index: true
  },
  groupNumber: String,
  subscriberName: {
    type: String,
    required: true
  },
  subscriberDOB: Date,
  relationship: {
    type: String,
    enum: ['self', 'spouse', 'child', 'other'],
    default: 'self'
  },
  effectiveDate: {
    type: Date,
    required: true
  },
  terminationDate: Date,
  coverageType: {
    type: String,
    enum: ['individual', 'family'],
    default: 'individual'
  },
  benefits: {
    preventive: {
      percentage: { type: Number, default: 100 },
      used: { type: Number, default: 0 },
      limit: { type: Number, default: 0 }
    },
    basic: {
      percentage: { type: Number, default: 80 },
      used: { type: Number, default: 0 },
      limit: { type: Number, default: 0 }
    },
    major: {
      percentage: { type: Number, default: 50 },
      used: { type: Number, default: 0 },
      limit: { type: Number, default: 0 }
    },
    orthodontic: {
      percentage: { type: Number, default: 50 },
      used: { type: Number, default: 0 },
      limit: { type: Number, default: 0 }
    },
    annualMaximum: {
      type: Number,
      default: 1500
    },
    annualDeductible: {
      type: Number,
      default: 50
    },
    deductibleMet: {
      type: Number,
      default: 0
    }
  },
  verificationStatus: {
    type: String,
    enum: ['pending', 'verified', 'expired', 'invalid'],
    default: 'pending'
  },
  lastVerified: Date,
  verifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  notes: String
}, {
  timestamps: true
});

insuranceVerificationSchema.index({ patientId: 1, effectiveDate: -1 });

const insuranceClaimSchema = new mongoose.Schema({
  claimNumber: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
    required: true,
    index: true
  },
  patientName: {
    type: String,
    required: true
  },
  appointmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Appointment'
  },
  insuranceVerificationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'InsuranceVerification'
  },
  provider: {
    type: String,
    required: true
  },
  policyNumber: {
    type: String,
    required: true
  },
  dateOfService: {
    type: Date,
    required: true
  },
  procedures: [{
    code: String,
    description: String,
    toothNumber: String,
    surface: String,
    quantity: Number,
    chargedAmount: Number,
    insuranceAllowed: Number,
    insurancePaid: Number,
    patientResponsibility: Number,
    status: {
      type: String,
      enum: ['pending', 'approved', 'denied', 'partial'],
      default: 'pending'
    },
    denialReason: String
  }],
  totalCharged: {
    type: Number,
    required: true
  },
  totalInsuranceEstimate: {
    type: Number,
    required: true
  },
  totalInsurancePaid: {
    type: Number,
    default: 0
  },
  totalPatientResponsibility: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['draft', 'pending', 'submitted', 'processing', 'approved', 'partial', 'denied', 'appealed', 'paid', 'closed'],
    default: 'draft',
    index: true
  },
  submittedDate: Date,
  processedDate: Date,
  paidDate: Date,
  paymentMethod: {
    type: String,
    enum: ['check', 'eft', 'credit']
  },
  paymentReference: String,
  attachments: [{
    filename: String,
    url: String,
    type: String,
    uploadedAt: Date
  }],
  denialReason: String,
  appealNotes: String,
  internalNotes: String,
  submittedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  processedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

insuranceClaimSchema.index({ status: 1, submittedDate: -1 });
insuranceClaimSchema.index({ patientId: 1, dateOfService: -1 });

// Generate claim number
insuranceClaimSchema.pre('save', async function(next) {
  if (!this.claimNumber) {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    this.claimNumber = `CLM-${year}${month}-${random}`;
  }
  next();
});

// Instance methods
insuranceClaimSchema.methods.calculateTotals = function() {
  this.totalCharged = this.procedures.reduce((sum, proc) => sum + (proc.chargedAmount || 0), 0);
  this.totalInsuranceEstimate = this.procedures.reduce((sum, proc) => sum + (proc.insuranceAllowed || 0), 0);
  this.totalPatientResponsibility = this.totalCharged - this.totalInsuranceEstimate;
};

insuranceClaimSchema.methods.submitClaim = async function(userId) {
  this.status = 'submitted';
  this.submittedDate = new Date();
  this.submittedBy = userId;
  return this.save();
};

insuranceClaimSchema.methods.processClaim = async function(approved, amount, userId) {
  this.status = approved ? 'approved' : 'denied';
  this.processedDate = new Date();
  this.processedBy = userId;
  if (approved && amount) {
    this.totalInsurancePaid = amount;
  }
  return this.save();
};

const InsuranceVerification = mongoose.model('InsuranceVerification', insuranceVerificationSchema);
const InsuranceClaim = mongoose.model('InsuranceClaim', insuranceClaimSchema);

export { InsuranceVerification, InsuranceClaim };