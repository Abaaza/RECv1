import mongoose from 'mongoose';

const scheduleSchema = new mongoose.Schema({
  date: {
    type: Date,
    required: true,
    index: true
  },
  dentistId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true
  },
  dayOfWeek: {
    type: String,
    enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
  },
  startTime: {
    type: String, // Format: "HH:MM"
    required: true
  },
  endTime: {
    type: String, // Format: "HH:MM"
    required: true
  },
  lunchBreak: {
    start: String,
    end: String
  },
  slots: [{
    time: String,
    duration: {
      type: Number,
      default: 30
    },
    available: {
      type: Boolean,
      default: true
    },
    blockedReason: String,
    blockedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    appointmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Appointment'
    }
  }],
  isHoliday: {
    type: Boolean,
    default: false
  },
  holidayName: String,
  isSpecialHours: {
    type: Boolean,
    default: false
  },
  specialHoursReason: String,
  enabled: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  modifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Compound index for efficient queries
scheduleSchema.index({ date: 1, dentistId: 1 });
scheduleSchema.index({ date: 1, 'slots.available': 1 });

// Instance methods
scheduleSchema.methods.getAvailableSlots = function(duration = 30) {
  return this.slots.filter(slot => {
    if (!slot.available) return false;
    
    // Check if we have enough consecutive slots for the duration
    const slotIndex = this.slots.indexOf(slot);
    const requiredSlots = Math.ceil(duration / 30);
    
    for (let i = 0; i < requiredSlots; i++) {
      if (!this.slots[slotIndex + i] || !this.slots[slotIndex + i].available) {
        return false;
      }
    }
    
    return true;
  });
};

scheduleSchema.methods.blockSlot = function(time, reason, userId) {
  const slot = this.slots.find(s => s.time === time);
  if (slot) {
    slot.available = false;
    slot.blockedReason = reason;
    slot.blockedBy = userId;
    return this.save();
  }
  return null;
};

scheduleSchema.methods.unblockSlot = function(time) {
  const slot = this.slots.find(s => s.time === time);
  if (slot) {
    slot.available = true;
    slot.blockedReason = null;
    slot.blockedBy = null;
    return this.save();
  }
  return null;
};

// Static methods
scheduleSchema.statics.findByDateRange = function(startDate, endDate, dentistId = null) {
  const query = {
    date: {
      $gte: startDate,
      $lte: endDate
    }
  };
  
  if (dentistId) {
    query.dentistId = dentistId;
  }
  
  return this.find(query).sort('date');
};

scheduleSchema.statics.createFromTemplate = async function(date, template, dentistId = null) {
  const schedule = new this({
    date,
    dentistId,
    dayOfWeek: date.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase(),
    startTime: template.start,
    endTime: template.end,
    lunchBreak: template.lunch,
    enabled: template.enabled,
    slots: []
  });
  
  // Generate slots
  schedule.slots = schedule.generateSlots();
  
  return schedule.save();
};

scheduleSchema.methods.generateSlots = function() {
  const slots = [];
  const [startHour, startMin] = this.startTime.split(':').map(Number);
  const [endHour, endMin] = this.endTime.split(':').map(Number);
  const slotDuration = 30; // Default 30 minutes
  
  let currentHour = startHour;
  let currentMin = startMin;
  
  while (currentHour < endHour || (currentHour === endHour && currentMin < endMin)) {
    const timeString = `${String(currentHour).padStart(2, '0')}:${String(currentMin).padStart(2, '0')}`;
    
    // Check if this is during lunch break
    let isDuringLunch = false;
    if (this.lunchBreak && this.lunchBreak.start && this.lunchBreak.end) {
      const [lunchStartHour, lunchStartMin] = this.lunchBreak.start.split(':').map(Number);
      const [lunchEndHour, lunchEndMin] = this.lunchBreak.end.split(':').map(Number);
      
      isDuringLunch = (currentHour > lunchStartHour || (currentHour === lunchStartHour && currentMin >= lunchStartMin)) &&
                      (currentHour < lunchEndHour || (currentHour === lunchEndHour && currentMin < lunchEndMin));
    }
    
    if (!isDuringLunch) {
      slots.push({
        time: timeString,
        duration: slotDuration,
        available: true
      });
    }
    
    // Increment time
    currentMin += slotDuration;
    if (currentMin >= 60) {
      currentHour += Math.floor(currentMin / 60);
      currentMin = currentMin % 60;
    }
  }
  
  return slots;
};

const Schedule = mongoose.model('Schedule', scheduleSchema);

export default Schedule;