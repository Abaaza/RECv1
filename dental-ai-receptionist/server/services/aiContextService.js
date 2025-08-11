import { encode } from 'gpt-3-encoder';
import { logger } from '../utils/logger.js';
import cacheService from './cacheService.js';
import Patient from '../models/Patient.js';
import Appointment from '../models/Appointment.js';

class AIContextService {
  constructor() {
    this.contexts = new Map();
    this.maxContextLength = 4000; // tokens
    this.maxConversationHistory = 20; // messages
    this.contextTimeout = 30 * 60 * 1000; // 30 minutes
    
    // Predefined context templates for common scenarios
    this.contextTemplates = {
      appointment: this.getAppointmentContextTemplate(),
      emergency: this.getEmergencyContextTemplate(),
      billing: this.getBillingContextTemplate(),
      general: this.getGeneralContextTemplate()
    };
    
    // Response cache for common queries
    this.responseCache = new Map();
    this.cacheTimeout = 10 * 60 * 1000; // 10 minutes
    
    this.startCleanupInterval();
  }

  // Get or create conversation context
  async getOrCreateContext(sessionId, userId = null) {
    let context = this.contexts.get(sessionId);
    
    if (!context) {
      context = await this.createNewContext(sessionId, userId);
      this.contexts.set(sessionId, context);
    } else {
      context.lastAccessed = Date.now();
    }
    
    return context;
  }

  // Create new conversation context
  async createNewContext(sessionId, userId) {
    const context = {
      sessionId,
      userId,
      conversationHistory: [],
      patientInfo: null,
      currentIntent: null,
      extractedEntities: {},
      contextType: 'general',
      createdAt: Date.now(),
      lastAccessed: Date.now(),
      tokenCount: 0,
      metadata: {}
    };
    
    // Load patient information if userId is provided
    if (userId) {
      context.patientInfo = await this.loadPatientContext(userId);
    }
    
    return context;
  }

  // Load patient context
  async loadPatientContext(userId) {
    try {
      // Check cache first
      const cacheKey = `patient_context_${userId}`;
      const cached = await cacheService.get('ai', cacheKey);
      if (cached) return cached;
      
      const patient = await Patient.findOne({ userId })
        .select('firstName lastName dateOfBirth insurance preferences medicalHistory allergies')
        .lean();
      
      if (!patient) return null;
      
      // Get recent appointments
      const recentAppointments = await Appointment.find({ 
        patientId: patient._id,
        dateTime: { $gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) }
      })
      .sort({ dateTime: -1 })
      .limit(5)
      .select('dateTime type status notes')
      .lean();
      
      const patientContext = {
        name: `${patient.firstName} ${patient.lastName}`,
        age: this.calculateAge(patient.dateOfBirth),
        hasInsurance: !!patient.insurance?.provider,
        insuranceProvider: patient.insurance?.provider,
        preferences: patient.preferences,
        allergies: patient.allergies,
        recentAppointments: recentAppointments.map(apt => ({
          date: apt.dateTime,
          type: apt.type,
          status: apt.status
        })),
        riskFactors: this.extractRiskFactors(patient.medicalHistory)
      };
      
      // Cache the context
      await cacheService.set('ai', cacheKey, patientContext, 600);
      
      return patientContext;
    } catch (error) {
      logger.error('Error loading patient context:', error);
      return null;
    }
  }

  // Add message to conversation history
  addToHistory(sessionId, role, content, metadata = {}) {
    const context = this.contexts.get(sessionId);
    if (!context) return;
    
    const message = {
      role,
      content,
      timestamp: Date.now(),
      tokens: this.countTokens(content),
      ...metadata
    };
    
    context.conversationHistory.push(message);
    context.tokenCount += message.tokens;
    
    // Trim history if it exceeds limits
    this.trimConversationHistory(context);
    
    // Update intent and entities
    if (role === 'user') {
      this.updateContextFromMessage(context, content);
    }
  }

  // Trim conversation history to stay within token limits
  trimConversationHistory(context) {
    while (
      context.conversationHistory.length > this.maxConversationHistory ||
      context.tokenCount > this.maxContextLength
    ) {
      const removed = context.conversationHistory.shift();
      context.tokenCount -= removed.tokens;
    }
  }

  // Update context based on user message
  updateContextFromMessage(context, message) {
    // Extract intent
    const intent = this.extractIntent(message);
    if (intent) {
      context.currentIntent = intent;
      context.contextType = this.mapIntentToContextType(intent);
    }
    
    // Extract entities
    const entities = this.extractEntities(message);
    context.extractedEntities = { ...context.extractedEntities, ...entities };
    
    // Update metadata
    context.metadata.lastUserMessage = message;
    context.metadata.lastMessageTime = Date.now();
  }

  // Extract intent from message
  extractIntent(message) {
    const intents = {
      appointment: /\b(appointment|schedule|book|availability|slot|reschedule)\b/i,
      emergency: /\b(emergency|urgent|pain|hurt|bleeding|swelling|broken|knocked out)\b/i,
      billing: /\b(cost|price|insurance|payment|bill|invoice|charge)\b/i,
      cancel: /\b(cancel|cancellation|remove)\b/i,
      information: /\b(hours|location|address|directions|contact)\b/i,
      prescription: /\b(prescription|medication|medicine|drug)\b/i,
      results: /\b(results|test|x-ray|report)\b/i
    };
    
    for (const [intent, pattern] of Object.entries(intents)) {
      if (pattern.test(message)) {
        return intent;
      }
    }
    
    return 'general';
  }

  // Extract entities from message
  extractEntities(message) {
    const entities = {};
    
    // Extract date/time
    const datePattern = /\b(today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday|\d{1,2}\/\d{1,2}|\d{1,2}-\d{1,2})\b/i;
    const dateMatch = message.match(datePattern);
    if (dateMatch) {
      entities.date = this.parseDate(dateMatch[0]);
    }
    
    const timePattern = /\b(\d{1,2}(?::\d{2})?\s*(?:am|pm)|morning|afternoon|evening)\b/i;
    const timeMatch = message.match(timePattern);
    if (timeMatch) {
      entities.time = this.parseTime(timeMatch[0]);
    }
    
    // Extract phone number
    const phonePattern = /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/;
    const phoneMatch = message.match(phonePattern);
    if (phoneMatch) {
      entities.phoneNumber = phoneMatch[0];
    }
    
    // Extract appointment type
    const appointmentTypes = ['cleaning', 'checkup', 'filling', 'crown', 'extraction', 'consultation'];
    for (const type of appointmentTypes) {
      if (message.toLowerCase().includes(type)) {
        entities.appointmentType = type;
        break;
      }
    }
    
    return entities;
  }

  // Generate optimized prompt with context
  async generatePrompt(sessionId, userMessage, options = {}) {
    const context = await this.getOrCreateContext(sessionId, options.userId);
    
    // Check response cache
    const cacheKey = this.generateCacheKey(userMessage, context.currentIntent);
    const cachedResponse = this.getCachedResponse(cacheKey);
    if (cachedResponse && !options.skipCache) {
      return { prompt: null, cached: true, response: cachedResponse };
    }
    
    // Select appropriate template
    const template = this.contextTemplates[context.contextType] || this.contextTemplates.general;
    
    // Build conversation context
    const conversationContext = this.buildConversationContext(context);
    
    // Build patient context
    const patientContext = context.patientInfo ? 
      this.buildPatientContextString(context.patientInfo) : '';
    
    // Construct the prompt
    const prompt = `${template}
    
${patientContext}

Current Context:
- Intent: ${context.currentIntent || 'general inquiry'}
- Session ID: ${context.sessionId}
${context.extractedEntities.date ? `- Requested Date: ${context.extractedEntities.date}` : ''}
${context.extractedEntities.time ? `- Requested Time: ${context.extractedEntities.time}` : ''}

Conversation History:
${conversationContext}

User: ${userMessage}
Assistant:`;
    
    return { prompt, cached: false, cacheKey };
  }

  // Build conversation context string
  buildConversationContext(context) {
    const recentHistory = context.conversationHistory.slice(-5);
    return recentHistory
      .map(msg => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`)
      .join('\n');
  }

  // Build patient context string
  buildPatientContextString(patientInfo) {
    if (!patientInfo) return '';
    
    return `Patient Information:
- Name: ${patientInfo.name}
- Age: ${patientInfo.age}
- Insurance: ${patientInfo.hasInsurance ? patientInfo.insuranceProvider : 'No insurance'}
${patientInfo.allergies?.length ? `- Allergies: ${patientInfo.allergies.join(', ')}` : ''}
${patientInfo.recentAppointments?.length ? `- Last Visit: ${new Date(patientInfo.recentAppointments[0].date).toLocaleDateString()}` : ''}`;
  }

  // Cache response for common queries
  cacheResponse(cacheKey, response) {
    this.responseCache.set(cacheKey, {
      response,
      timestamp: Date.now()
    });
    
    // Clean old cache entries
    setTimeout(() => {
      this.responseCache.delete(cacheKey);
    }, this.cacheTimeout);
  }

  // Get cached response
  getCachedResponse(cacheKey) {
    const cached = this.responseCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.response;
    }
    return null;
  }

  // Generate cache key
  generateCacheKey(message, intent) {
    const normalizedMessage = message.toLowerCase().trim();
    return `${intent}_${this.hashString(normalizedMessage)}`;
  }

  // Simple hash function for cache keys
  hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(36);
  }

  // Count tokens in text
  countTokens(text) {
    try {
      return encode(text).length;
    } catch {
      // Fallback: rough estimation
      return Math.ceil(text.split(/\s+/).length * 1.3);
    }
  }

  // Parse date from natural language
  parseDate(dateStr) {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const normalized = dateStr.toLowerCase();
    
    if (normalized === 'today') return today.toISOString().split('T')[0];
    if (normalized === 'tomorrow') return tomorrow.toISOString().split('T')[0];
    
    // Parse weekday
    const weekdays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const weekdayIndex = weekdays.indexOf(normalized);
    if (weekdayIndex !== -1) {
      const daysUntil = (weekdayIndex - today.getDay() + 7) % 7 || 7;
      const targetDate = new Date(today);
      targetDate.setDate(today.getDate() + daysUntil);
      return targetDate.toISOString().split('T')[0];
    }
    
    return dateStr;
  }

  // Parse time from natural language
  parseTime(timeStr) {
    const normalized = timeStr.toLowerCase();
    
    if (normalized.includes('morning')) return '09:00';
    if (normalized.includes('afternoon')) return '14:00';
    if (normalized.includes('evening')) return '17:00';
    
    return timeStr;
  }

  // Map intent to context type
  mapIntentToContextType(intent) {
    const mapping = {
      appointment: 'appointment',
      emergency: 'emergency',
      billing: 'billing',
      cancel: 'appointment',
      prescription: 'general',
      results: 'general'
    };
    
    return mapping[intent] || 'general';
  }

  // Calculate age from date of birth
  calculateAge(dateOfBirth) {
    if (!dateOfBirth) return null;
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  }

  // Extract risk factors from medical history
  extractRiskFactors(medicalHistory) {
    if (!medicalHistory) return [];
    
    const riskFactors = [];
    const history = JSON.stringify(medicalHistory).toLowerCase();
    
    if (history.includes('diabetes')) riskFactors.push('diabetes');
    if (history.includes('heart')) riskFactors.push('heart condition');
    if (history.includes('blood pressure')) riskFactors.push('hypertension');
    if (history.includes('bleeding')) riskFactors.push('bleeding disorder');
    
    return riskFactors;
  }

  // Get context templates
  getAppointmentContextTemplate() {
    return `You are a helpful dental office AI assistant specializing in appointment scheduling.
    
Guidelines:
- Be friendly and professional
- Confirm appointment details clearly
- Suggest available time slots
- Ask for necessary information politely
- Provide clear next steps`;
  }

  getEmergencyContextTemplate() {
    return `You are a dental emergency response AI assistant.
    
CRITICAL Guidelines:
- Assess severity immediately
- Provide clear emergency instructions
- Recommend immediate actions for pain relief
- Determine if ER visit is needed
- Be calm and reassuring
- Never delay urgent care recommendations`;
  }

  getBillingContextTemplate() {
    return `You are a dental office billing assistant.
    
Guidelines:
- Provide clear cost estimates
- Explain insurance coverage
- Discuss payment options
- Be transparent about fees
- Offer payment plans when appropriate`;
  }

  getGeneralContextTemplate() {
    return `You are Sarah, a friendly and professional dental office AI receptionist.
    
Guidelines:
- Be warm and welcoming
- Answer questions accurately
- Guide patients to appropriate services
- Maintain HIPAA compliance
- Be concise but thorough`;
  }

  // Clear context for a session
  clearContext(sessionId) {
    this.contexts.delete(sessionId);
    logger.info(`Cleared context for session: ${sessionId}`);
  }

  // Clean up old contexts
  startCleanupInterval() {
    setInterval(() => {
      const now = Date.now();
      for (const [sessionId, context] of this.contexts.entries()) {
        if (now - context.lastAccessed > this.contextTimeout) {
          this.clearContext(sessionId);
        }
      }
    }, 5 * 60 * 1000); // Clean every 5 minutes
  }

  // Get context summary for logging
  getContextSummary(sessionId) {
    const context = this.contexts.get(sessionId);
    if (!context) return null;
    
    return {
      sessionId,
      userId: context.userId,
      messageCount: context.conversationHistory.length,
      currentIntent: context.currentIntent,
      tokenCount: context.tokenCount,
      duration: Date.now() - context.createdAt,
      patientName: context.patientInfo?.name
    };
  }

  // Export context for analysis
  exportContext(sessionId) {
    const context = this.contexts.get(sessionId);
    if (!context) return null;
    
    return {
      ...context,
      exported: new Date().toISOString()
    };
  }
}

// Create singleton instance
const aiContextService = new AIContextService();

export default aiContextService;