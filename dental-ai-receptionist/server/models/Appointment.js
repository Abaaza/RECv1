import mongoose from 'mongoose';

const appointmentSchema = new mongoose.Schema({
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  dentistId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  date: {
    type: Date,
    required: true
  },
  startTime: {
    type: String,
    required: true
  },
  endTime: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['checkup', 'cleaning', 'filling', 'extraction', 'root-canal', 'crown', 'emergency', 'consultation', 'other'],
    required: true
  },
  status: {
    type: String,
    enum: ['scheduled', 'confirmed', 'in-progress', 'completed', 'cancelled', 'no-show'],
    default: 'scheduled'
  },
  reason: {
    type: String,
    required: true
  },
  symptoms: [String],
  notes: String,
  treatment: {
    diagnosis: String,
    procedures: [String],
    prescriptions: [{
      medication: String,
      dosage: String,
      frequency: String,
      duration: String
    }],
    followUp: Date
  },
  insurance: {
    provider: String,
    policyNumber: String,
    copay: Number,
    verified: Boolean
  },
  billing: {
    totalCost: Number,
    insuranceCovered: Number,
    patientResponsibility: Number,
    paid: {
      type: Boolean,
      default: false
    },
    paymentMethod: String,
    paymentDate: Date
  },
  reminders: [{
    type: {
      type: String,
      enum: ['email', 'sms', 'call']
    },
    scheduledFor: Date,
    sent: {
      type: Boolean,
      default: false
    },
    sentAt: Date,
    response: String
  }],
  rating: {
    score: {
      type: Number,
      min: 1,
      max: 5
    },
    feedback: String,
    submittedAt: Date
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

appointmentSchema.index({ date: 1, startTime: 1 });
appointmentSchema.index({ patientId: 1, date: -1 });
appointmentSchema.index({ dentistId: 1, date: 1 });
appointmentSchema.index({ status: 1 });

appointmentSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

export default mongoose.model('Appointment', appointmentSchema);