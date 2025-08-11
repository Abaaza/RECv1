import mongoose from 'mongoose';
import { logger } from './logger.js';

export async function createDatabaseIndexes() {
  logger.info('Creating database indexes...');
  
  try {
    // User indexes
    const User = mongoose.model('User');
    await User.collection.createIndexes([
      { key: { email: 1 }, unique: true, name: 'email_unique' },
      { key: { role: 1 }, name: 'role_index' },
      { key: { createdAt: -1 }, name: 'created_at_desc' },
      { key: { 'profile.phoneNumber': 1 }, sparse: true, name: 'phone_index' }
    ]);
    
    // Patient indexes
    const Patient = mongoose.model('Patient');
    await Patient.collection.createIndexes([
      { key: { userId: 1 }, name: 'user_id_index' },
      { key: { email: 1 }, unique: true, sparse: true, name: 'patient_email_unique' },
      { key: { phoneNumber: 1 }, sparse: true, name: 'patient_phone_index' },
      { key: { lastName: 1, firstName: 1 }, name: 'patient_name_index' },
      { key: { 'insurance.provider': 1 }, sparse: true, name: 'insurance_provider_index' },
      { key: { riskLevel: 1 }, name: 'risk_level_index' },
      { key: { 'preferences.preferredDentist': 1 }, sparse: true, name: 'preferred_dentist_index' },
      { key: { createdAt: -1 }, name: 'patient_created_desc' },
      // Text search index for patient search
      { key: { firstName: 'text', lastName: 'text', email: 'text' }, name: 'patient_text_search' }
    ]);
    
    // Appointment indexes
    const Appointment = mongoose.model('Appointment');
    await Appointment.collection.createIndexes([
      { key: { patientId: 1 }, name: 'appointment_patient_index' },
      { key: { dentistId: 1 }, name: 'appointment_dentist_index' },
      { key: { dateTime: 1 }, name: 'appointment_datetime_index' },
      { key: { status: 1 }, name: 'appointment_status_index' },
      { key: { type: 1 }, name: 'appointment_type_index' },
      { key: { dateTime: 1, dentistId: 1 }, unique: true, name: 'appointment_slot_unique' },
      { key: { createdAt: -1 }, name: 'appointment_created_desc' },
      // Compound index for availability queries
      { key: { dentistId: 1, dateTime: 1, status: 1 }, name: 'appointment_availability_index' },
      // Index for upcoming appointments
      { key: { dateTime: 1, status: 1 }, name: 'upcoming_appointments_index' },
      // Index for patient history
      { key: { patientId: 1, dateTime: -1 }, name: 'patient_history_index' }
    ]);
    
    // Chat/Conversation indexes
    const Chat = mongoose.model('Chat');
    await Chat.collection.createIndexes([
      { key: { userId: 1 }, name: 'chat_user_index' },
      { key: { sessionId: 1 }, name: 'chat_session_index' },
      { key: { createdAt: -1 }, name: 'chat_created_desc' },
      { key: { 'metadata.callId': 1 }, sparse: true, name: 'chat_call_id_index' },
      { key: { 'metadata.isEmergency': 1 }, sparse: true, name: 'chat_emergency_index' },
      // TTL index to auto-delete old conversations after 90 days
      { key: { createdAt: 1 }, expireAfterSeconds: 7776000, name: 'chat_ttl_index' }
    ]);
    
    // Treatment Plan indexes
    const TreatmentPlan = mongoose.model('TreatmentPlan');
    await TreatmentPlan.collection.createIndexes([
      { key: { patientId: 1 }, name: 'treatment_patient_index' },
      { key: { dentistId: 1 }, name: 'treatment_dentist_index' },
      { key: { status: 1 }, name: 'treatment_status_index' },
      { key: { 'procedures.status': 1 }, name: 'procedure_status_index' },
      { key: { createdAt: -1 }, name: 'treatment_created_desc' }
    ]);
    
    // Notification indexes (if exists)
    try {
      const Notification = mongoose.model('Notification');
      await Notification.collection.createIndexes([
        { key: { userId: 1 }, name: 'notification_user_index' },
        { key: { read: 1 }, name: 'notification_read_index' },
        { key: { type: 1 }, name: 'notification_type_index' },
        { key: { createdAt: -1 }, name: 'notification_created_desc' },
        // Compound index for unread notifications
        { key: { userId: 1, read: 1, createdAt: -1 }, name: 'unread_notifications_index' }
      ]);
    } catch (error) {
      logger.debug('Notification model not found, skipping indexes');
    }
    
    // Audit Log indexes (if exists)
    try {
      const AuditLog = mongoose.model('AuditLog');
      await AuditLog.collection.createIndexes([
        { key: { userId: 1 }, name: 'audit_user_index' },
        { key: { action: 1 }, name: 'audit_action_index' },
        { key: { entityType: 1 }, name: 'audit_entity_type_index' },
        { key: { entityId: 1 }, name: 'audit_entity_id_index' },
        { key: { timestamp: -1 }, name: 'audit_timestamp_desc' },
        // TTL index to auto-delete audit logs after 1 year
        { key: { timestamp: 1 }, expireAfterSeconds: 31536000, name: 'audit_ttl_index' }
      ]);
    } catch (error) {
      logger.debug('AuditLog model not found, skipping indexes');
    }
    
    logger.info('Database indexes created successfully');
    
    // Analyze index usage
    await analyzeIndexUsage();
    
  } catch (error) {
    logger.error('Error creating database indexes:', error);
    throw error;
  }
}

export async function analyzeIndexUsage() {
  try {
    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    
    for (const collection of collections) {
      const stats = await db.collection(collection.name).aggregate([
        { $indexStats: {} }
      ]).toArray();
      
      logger.info(`Index usage for ${collection.name}:`, 
        stats.map(s => ({
          name: s.name,
          operations: s.accesses.ops,
          since: s.accesses.since
        }))
      );
    }
  } catch (error) {
    logger.error('Error analyzing index usage:', error);
  }
}

export async function optimizeDatabase() {
  logger.info('Optimizing database...');
  
  try {
    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    
    for (const collection of collections) {
      // Compact collection to reduce fragmentation
      await db.admin().command({
        compact: collection.name,
        force: true
      });
      
      // Validate collection
      const validation = await db.admin().command({
        validate: collection.name,
        full: true
      });
      
      if (!validation.valid) {
        logger.error(`Collection ${collection.name} validation failed:`, validation.errors);
      } else {
        logger.info(`Collection ${collection.name} validated successfully`);
      }
    }
    
    logger.info('Database optimization completed');
  } catch (error) {
    logger.error('Error optimizing database:', error);
  }
}

export async function dropUnusedIndexes() {
  logger.info('Checking for unused indexes...');
  
  try {
    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    for (const collection of collections) {
      const stats = await db.collection(collection.name).aggregate([
        { $indexStats: {} }
      ]).toArray();
      
      for (const stat of stats) {
        // Skip default _id index
        if (stat.name === '_id_') continue;
        
        // Check if index hasn't been used in 30 days
        if (stat.accesses.since < thirtyDaysAgo && stat.accesses.ops === 0) {
          logger.warn(`Unused index found: ${collection.name}.${stat.name}`);
          // Uncomment to actually drop unused indexes
          // await db.collection(collection.name).dropIndex(stat.name);
          // logger.info(`Dropped unused index: ${collection.name}.${stat.name}`);
        }
      }
    }
    
    logger.info('Unused index check completed');
  } catch (error) {
    logger.error('Error checking unused indexes:', error);
  }
}

// Run index creation on database connection
mongoose.connection.once('open', async () => {
  await createDatabaseIndexes();
  
  // Schedule periodic optimization (once a week)
  setInterval(async () => {
    await optimizeDatabase();
    await dropUnusedIndexes();
  }, 7 * 24 * 60 * 60 * 1000);
});

export default {
  createDatabaseIndexes,
  analyzeIndexUsage,
  optimizeDatabase,
  dropUnusedIndexes
};