import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const medicalHistorySchema = new mongoose.Schema({
  condition: String,
  diagnosedDate: Date,
  medications: [String],
  notes: String
});

const allergySchema = new mongoose.Schema({
  allergen: String,
  reaction: String,
  severity: {
    type: String,
    enum: ['mild', 'moderate', 'severe']
  }
});

const insuranceSchema = new mongoose.Schema({
  provider: String,
  memberId: String,
  groupNumber: String,
  effectiveDate: Date,
  expirationDate: Date,
  verified: {
    type: Boolean,
    default: false
  },
  verifiedAt: Date,
  coverageDetails: mongoose.Schema.Types.Mixed
});

const emergencyContactSchema = new mongoose.Schema({
  name: String,
  relationship: String,
  phone: String,
  alternatePhone: String
});

const treatmentHistorySchema = new mongoose.Schema({
  date: Date,
  procedure: String,
  procedureCode: String,
  dentist: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  tooth: [String],
  notes: String,
  cost: Number,
  insuranceCovered: Number,
  patientPaid: Number,
  attachments: [String]
});

const preferenceSchema = new mongoose.Schema({
  appointmentReminders: {
    email: { type: Boolean, default: true },
    sms: { type: Boolean, default: true },
    call: { type: Boolean, default: false },
    advanceNotice: { type: Number, default: 24 } // hours
  },
  preferredDentist: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  preferredTimeOfDay: {
    type: String,
    enum: ['morning', 'afternoon', 'evening', 'any']
  },
  preferredDays: [String],
  language: {
    type: String,
    default: 'en'
  },
  communicationPreference: {
    type: String,
    enum: ['email', 'phone', 'sms', 'any'],
    default: 'any'
  }
});

const consentSchema = new mongoose.Schema({
  type: String,
  consentedAt: Date,
  expiresAt: Date,
  signatureUrl: String
});

const patientSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: true,
    trim: true
  },
  lastName: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  phone: {
    type: String,
    required: true
  },
  alternatePhone: String,
  dateOfBirth: {
    type: Date,
    required: false
  },
  gender: {
    type: String,
    enum: ['male', 'female', 'other', 'prefer_not_to_say']
  },
  address: {
    street: String,
    apartment: String,
    city: String,
    state: String,
    zipCode: String,
    country: { type: String, default: 'USA' }
  },
  medicalHistory: [medicalHistorySchema],
  allergies: [allergySchema],
  currentMedications: [{
    name: String,
    dosage: String,
    frequency: String,
    prescribedBy: String,
    startDate: Date
  }],
  insurance: insuranceSchema,
  emergencyContact: emergencyContactSchema,
  treatmentHistory: [treatmentHistorySchema],
  upcomingAppointments: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Appointment'
  }],
  preferences: preferenceSchema,
  consents: [consentSchema],
  riskFactors: {
    smoking: Boolean,
    diabetes: Boolean,
    heartDisease: Boolean,
    pregnancy: Boolean,
    immunocompromised: Boolean,
    bleedingDisorder: Boolean
  },
  lastVisit: Date,
  nextRecallDate: Date,
  patientSince: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'archived'],
    default: 'active'
  },
  notes: String,
  balance: {
    type: Number,
    default: 0
  },
  paymentMethods: [{
    type: {
      type: String,
      enum: ['credit_card', 'debit_card', 'bank_account', 'cash', 'check', 'insurance']
    },
    last4: String,
    expiryMonth: Number,
    expiryYear: Number,
    isDefault: Boolean
  }],
  documents: [{
    name: String,
    type: String,
    url: String,
    uploadedAt: Date
  }],
  referralSource: String,
  familyMembers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient'
  }],
  photoUrl: String,
  tags: [String],
  customFields: mongoose.Schema.Types.Mixed,
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
patientSchema.index({ email: 1 });
patientSchema.index({ phone: 1 });
patientSchema.index({ lastName: 1, firstName: 1 });
patientSchema.index({ 'insurance.memberId': 1 });
patientSchema.index({ status: 1 });
patientSchema.index({ nextRecallDate: 1 });

// Virtual for full name
patientSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

// Virtual for age
patientSchema.virtual('age').get(function() {
  if (!this.dateOfBirth) return null;
  const today = new Date();
  const birthDate = new Date(this.dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
});

// Pre-save middleware
patientSchema.pre('save', async function(next) {
  // Hash password if modified
  if (this.isModified('password')) {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
  }
  
  // Update timestamps
  this.updatedAt = new Date();
  
  next();
});

// Methods
patientSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

patientSchema.methods.calculateNextRecall = function() {
  const riskLevel = this.calculateRiskLevel();
  let months = 6; // Default recall period
  
  if (riskLevel === 'high') {
    months = 3;
  } else if (riskLevel === 'medium') {
    months = 4;
  }
  
  const nextRecall = new Date();
  nextRecall.setMonth(nextRecall.getMonth() + months);
  this.nextRecallDate = nextRecall;
  return nextRecall;
};

patientSchema.methods.calculateRiskLevel = function() {
  let riskScore = 0;
  
  // Check risk factors
  if (this.riskFactors.smoking) riskScore += 2;
  if (this.riskFactors.diabetes) riskScore += 2;
  if (this.riskFactors.heartDisease) riskScore += 1;
  if (this.riskFactors.immunocompromised) riskScore += 2;
  
  // Check treatment history
  const recentTreatments = this.treatmentHistory.filter(t => {
    const monthsAgo = (Date.now() - new Date(t.date)) / (1000 * 60 * 60 * 24 * 30);
    return monthsAgo <= 12;
  });
  
  const hasPeriodontalTreatment = recentTreatments.some(t => 
    t.procedure.toLowerCase().includes('periodontal') || 
    t.procedure.toLowerCase().includes('deep cleaning')
  );
  
  if (hasPeriodontalTreatment) riskScore += 2;
  
  // Age factor
  if (this.age > 65) riskScore += 1;
  if (this.age < 18) riskScore += 1;
  
  // Determine risk level
  if (riskScore >= 5) return 'high';
  if (riskScore >= 3) return 'medium';
  return 'low';
};

patientSchema.methods.getUpcomingRecalls = function() {
  const recalls = [];
  
  // Regular cleaning recall
  if (this.nextRecallDate) {
    recalls.push({
      type: 'cleaning',
      date: this.nextRecallDate,
      priority: 'normal'
    });
  }
  
  // Check for specific treatment follow-ups
  const recentTreatments = this.treatmentHistory.slice(-5);
  recentTreatments.forEach(treatment => {
    if (treatment.procedure.toLowerCase().includes('root canal')) {
      const followUpDate = new Date(treatment.date);
      followUpDate.setMonth(followUpDate.getMonth() + 6);
      if (followUpDate > new Date()) {
        recalls.push({
          type: 'root_canal_followup',
          date: followUpDate,
          priority: 'high',
          relatedTreatment: treatment._id
        });
      }
    }
    
    if (treatment.procedure.toLowerCase().includes('implant')) {
      const followUpDate = new Date(treatment.date);
      followUpDate.setMonth(followUpDate.getMonth() + 3);
      if (followUpDate > new Date()) {
        recalls.push({
          type: 'implant_checkup',
          date: followUpDate,
          priority: 'high',
          relatedTreatment: treatment._id
        });
      }
    }
  });
  
  return recalls.sort((a, b) => new Date(a.date) - new Date(b.date));
};

patientSchema.methods.addTreatmentHistory = function(treatment) {
  this.treatmentHistory.push(treatment);
  this.lastVisit = treatment.date || new Date();
  
  // Recalculate next recall based on new treatment
  this.calculateNextRecall();
  
  return this.save();
};

patientSchema.methods.updateBalance = function(amount, description) {
  this.balance += amount;
  
  // Could also maintain a transaction history here
  if (!this.transactions) {
    this.transactions = [];
  }
  
  this.transactions.push({
    amount,
    description,
    date: new Date(),
    balance: this.balance
  });
  
  return this.save();
};

// Static methods
patientSchema.statics.findByInsurance = function(insuranceProvider, memberId) {
  return this.findOne({
    'insurance.provider': insuranceProvider,
    'insurance.memberId': memberId
  });
};

patientSchema.statics.findDueForRecall = function(daysAhead = 30) {
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + daysAhead);
  
  return this.find({
    status: 'active',
    nextRecallDate: {
      $gte: new Date(),
      $lte: futureDate
    }
  });
};

patientSchema.statics.searchPatients = function(query) {
  const searchRegex = new RegExp(query, 'i');
  
  return this.find({
    $or: [
      { firstName: searchRegex },
      { lastName: searchRegex },
      { email: searchRegex },
      { phone: searchRegex },
      { 'insurance.memberId': searchRegex }
    ]
  });
};

const Patient = mongoose.model('Patient', patientSchema);

export default Patient;