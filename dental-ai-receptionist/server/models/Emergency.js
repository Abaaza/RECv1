import mongoose from 'mongoose';

const emergencySchema = new mongoose.Schema({
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
    index: true
  },
  patientName: {
    type: String,
    required: true
  },
  phoneNumber: {
    type: String,
    required: true
  },
  alternateContact: {
    name: String,
    phone: String,
    relationship: String
  },
  emergencyType: {
    type: String,
    enum: [
      'dental_trauma',
      'severe_pain',
      'bleeding',
      'swelling',
      'infection',
      'broken_tooth',
      'lost_filling',
      'jaw_injury',
      'other'
    ],
    required: true
  },
  symptoms: [{
    type: String
  }],
  painLevel: {
    type: Number,
    min: 0,
    max: 10,
    required: true
  },
  onsetTime: {
    type: Date,
    required: true
  },
  reportedTime: {
    type: Date,
    required: true,
    default: Date.now
  },
  severity: {
    type: String,
    enum: ['low', 'moderate', 'high', 'critical'],
    required: true,
    index: true
  },
  triageNotes: String,
  immediateActions: [{
    action: String,
    timestamp: Date,
    performedBy: String
  }],
  instructions: [{
    instruction: String,
    givenAt: Date,
    givenBy: String
  }],
  appointmentNeeded: {
    type: Boolean,
    default: true
  },
  appointmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Appointment'
  },
  status: {
    type: String,
    enum: ['reported', 'triaged', 'in_progress', 'resolved', 'referred'],
    default: 'reported',
    index: true
  },
  resolution: {
    resolvedAt: Date,
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    treatmentProvided: String,
    followUpRequired: Boolean,
    followUpDate: Date
  },
  referral: {
    referredTo: String, // Hospital or specialist name
    referredAt: Date,
    reason: String,
    contactInfo: String
  },
  location: {
    currentLocation: String,
    arrivedAtClinic: Boolean,
    eta: String
  },
  vitals: {
    bloodPressure: String,
    pulse: Number,
    temperature: Number,
    recordedAt: Date
  },
  medicalHistory: {
    allergies: [String],
    medications: [String],
    conditions: [String],
    lastDentalVisit: Date
  },
  aiAssessment: {
    confidence: Number,
    recommendedActions: [String],
    riskFactors: [String],
    estimatedWaitTime: Number
  },
  callLogId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CallLog'
  },
  images: [{
    url: String,
    uploadedAt: Date,
    description: String
  }],
  communicationLog: [{
    timestamp: Date,
    type: { type: String, enum: ['call', 'sms', 'email'] },
    content: String,
    sentBy: String,
    sentTo: String
  }],
  billingNotes: String,
  insuranceNotified: {
    type: Boolean,
    default: false
  },
  insuranceAuthNumber: String
}, {
  timestamps: true
});

// Indexes
emergencySchema.index({ reportedTime: -1 });
emergencySchema.index({ severity: 1, status: 1 });
emergencySchema.index({ patientId: 1, reportedTime: -1 });

// Virtual for duration
emergencySchema.virtual('duration').get(function() {
  if (this.resolution && this.resolution.resolvedAt) {
    return Math.floor((this.resolution.resolvedAt - this.reportedTime) / 1000 / 60); // in minutes
  }
  return Math.floor((new Date() - this.reportedTime) / 1000 / 60);
});

// Instance methods
emergencySchema.methods.updateSeverity = function(newSeverity, notes) {
  this.severity = newSeverity;
  if (notes) {
    this.triageNotes = (this.triageNotes || '') + '\n' + new Date().toISOString() + ': ' + notes;
  }
  return this.save();
};

emergencySchema.methods.addInstruction = function(instruction, givenBy) {
  this.instructions.push({
    instruction,
    givenAt: new Date(),
    givenBy
  });
  return this.save();
};

emergencySchema.methods.addImmediateAction = function(action, performedBy) {
  this.immediateActions.push({
    action,
    timestamp: new Date(),
    performedBy
  });
  return this.save();
};

emergencySchema.methods.resolve = function(resolvedBy, treatmentProvided, followUpRequired = false, followUpDate = null) {
  this.status = 'resolved';
  this.resolution = {
    resolvedAt: new Date(),
    resolvedBy,
    treatmentProvided,
    followUpRequired,
    followUpDate
  };
  return this.save();
};

emergencySchema.methods.refer = function(referredTo, reason, contactInfo) {
  this.status = 'referred';
  this.referral = {
    referredTo,
    referredAt: new Date(),
    reason,
    contactInfo
  };
  return this.save();
};

emergencySchema.methods.logCommunication = function(type, content, sentBy, sentTo) {
  this.communicationLog.push({
    timestamp: new Date(),
    type,
    content,
    sentBy,
    sentTo
  });
  return this.save();
};

// Static methods
emergencySchema.statics.getActiveEmergencies = function() {
  return this.find({
    status: { $in: ['reported', 'triaged', 'in_progress'] }
  })
  .sort({ severity: -1, reportedTime: 1 })
  .populate('patientId', 'name phone email')
  .populate('appointmentId');
};

emergencySchema.statics.getCriticalEmergencies = function() {
  return this.find({
    severity: 'critical',
    status: { $ne: 'resolved' }
  })
  .sort({ reportedTime: 1 })
  .populate('patientId', 'name phone email');
};

emergencySchema.statics.getEmergencyStats = async function(startDate, endDate) {
  const query = {};
  if (startDate && endDate) {
    query.reportedTime = {
      $gte: startDate,
      $lte: endDate
    };
  }

  const stats = await this.aggregate([
    { $match: query },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        critical: {
          $sum: { $cond: [{ $eq: ['$severity', 'critical'] }, 1, 0] }
        },
        high: {
          $sum: { $cond: [{ $eq: ['$severity', 'high'] }, 1, 0] }
        },
        moderate: {
          $sum: { $cond: [{ $eq: ['$severity', 'moderate'] }, 1, 0] }
        },
        low: {
          $sum: { $cond: [{ $eq: ['$severity', 'low'] }, 1, 0] }
        },
        resolved: {
          $sum: { $cond: [{ $eq: ['$status', 'resolved'] }, 1, 0] }
        },
        referred: {
          $sum: { $cond: [{ $eq: ['$status', 'referred'] }, 1, 0] }
        },
        avgPainLevel: { $avg: '$painLevel' }
      }
    }
  ]);

  const typeBreakdown = await this.aggregate([
    { $match: query },
    {
      $group: {
        _id: '$emergencyType',
        count: { $sum: 1 }
      }
    },
    { $sort: { count: -1 } }
  ]);

  return {
    ...(stats[0] || {
      total: 0,
      critical: 0,
      high: 0,
      moderate: 0,
      low: 0,
      resolved: 0,
      referred: 0,
      avgPainLevel: 0
    }),
    typeBreakdown
  };
};

emergencySchema.statics.getAverageResponseTime = async function(startDate, endDate) {
  const query = {
    status: 'resolved',
    'resolution.resolvedAt': { $exists: true }
  };
  
  if (startDate && endDate) {
    query.reportedTime = {
      $gte: startDate,
      $lte: endDate
    };
  }

  const result = await this.aggregate([
    { $match: query },
    {
      $project: {
        responseTime: {
          $subtract: ['$resolution.resolvedAt', '$reportedTime']
        }
      }
    },
    {
      $group: {
        _id: null,
        avgResponseTime: { $avg: '$responseTime' }
      }
    }
  ]);

  return result[0]?.avgResponseTime ? Math.floor(result[0].avgResponseTime / 1000 / 60) : 0; // in minutes
};

const Emergency = mongoose.model('Emergency', emergencySchema);

export default Emergency;