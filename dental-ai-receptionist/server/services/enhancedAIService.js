import OpenAI from 'openai';
import natural from 'natural';
import compromise from 'compromise';
import { logger } from '../utils/logger.js';
import aiContextService from './aiContextService.js';
import cacheService from './cacheService.js';
import monitoringService from './monitoringService.js';

class EnhancedAIService {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    
    // NLP components
    this.tokenizer = new natural.WordTokenizer();
    this.sentiment = new natural.SentimentAnalyzer('English', natural.PorterStemmer, 'afinn');
    this.classifier = new natural.BayesClassifier();
    
    // Conversation state management
    this.conversationStates = new Map();
    this.contextWindow = 10; // messages
    this.maxTokens = 4000;
    
    // Response optimization
    this.responseTemplates = this.loadResponseTemplates();
    this.commonPhrases = this.loadCommonPhrases();
    
    // Performance tracking
    this.metrics = {
      avgResponseTime: 0,
      totalRequests: 0,
      cacheHitRate: 0,
      errorRate: 0
    };
    
    this.initializeClassifier();
  }

  // Initialize intent classifier
  async initializeClassifier() {
    // Training data for intent classification
    const trainingData = [
      { text: 'I need to schedule an appointment', intent: 'appointment_booking' },
      { text: 'Can I book a cleaning', intent: 'appointment_booking' },
      { text: 'What times are available', intent: 'appointment_booking' },
      { text: 'I want to cancel my appointment', intent: 'appointment_cancel' },
      { text: 'Need to reschedule', intent: 'appointment_reschedule' },
      { text: 'My tooth hurts', intent: 'emergency' },
      { text: 'I have severe pain', intent: 'emergency' },
      { text: 'Bleeding gums', intent: 'emergency' },
      { text: 'How much does it cost', intent: 'billing' },
      { text: 'Do you accept my insurance', intent: 'billing' },
      { text: 'Payment options', intent: 'billing' },
      { text: 'What are your hours', intent: 'information' },
      { text: 'Where are you located', intent: 'information' },
      { text: 'Tell me about the dentist', intent: 'information' }
    ];
    
    // Train classifier
    trainingData.forEach(item => {
      this.classifier.addDocument(item.text, item.intent);
    });
    
    this.classifier.train();
    logger.info('AI intent classifier trained successfully');
  }

  // Enhanced message processing with NLP
  async processMessage(sessionId, message, options = {}) {
    const startTime = Date.now();
    
    try {
      // Get or create conversation context
      const context = await aiContextService.getOrCreateContext(sessionId, options.userId);
      
      // Perform NLP analysis
      const nlpAnalysis = this.analyzeMessage(message);
      
      // Check for emergency keywords with high priority
      if (nlpAnalysis.isEmergency) {
        return await this.handleEmergency(message, nlpAnalysis, context);
      }
      
      // Check cache for similar queries
      const cacheKey = this.generateSmartCacheKey(message, nlpAnalysis.intent);
      const cachedResponse = await this.getCachedResponse(cacheKey);
      if (cachedResponse && !options.skipCache) {
        this.updateMetrics('cache_hit');
        return cachedResponse;
      }
      
      // Build enhanced prompt with context
      const prompt = await this.buildEnhancedPrompt(message, nlpAnalysis, context);
      
      // Get AI response with retry logic
      const response = await this.getAIResponseWithRetry(prompt, context);
      
      // Post-process response
      const processedResponse = this.postProcessResponse(response, nlpAnalysis);
      
      // Update context
      aiContextService.addToHistory(sessionId, 'user', message, { nlpAnalysis });
      aiContextService.addToHistory(sessionId, 'assistant', processedResponse);
      
      // Cache the response
      await this.cacheResponse(cacheKey, processedResponse);
      
      // Track metrics
      this.updateMetrics('success', Date.now() - startTime);
      
      return {
        response: processedResponse,
        intent: nlpAnalysis.intent,
        sentiment: nlpAnalysis.sentiment,
        entities: nlpAnalysis.entities,
        confidence: nlpAnalysis.confidence,
        suggestedActions: this.getSuggestedActions(nlpAnalysis.intent)
      };
      
    } catch (error) {
      logger.error('Error processing message:', error);
      this.updateMetrics('error');
      
      // Fallback response
      return {
        response: this.getFallbackResponse(message),
        error: true,
        intent: 'unknown'
      };
    }
  }

  // Analyze message with NLP
  analyzeMessage(message) {
    const tokens = this.tokenizer.tokenize(message.toLowerCase());
    const doc = compromise(message);
    
    // Extract entities
    const entities = {
      dates: doc.dates().out('array'),
      times: doc.times().out('array'),
      people: doc.people().out('array'),
      places: doc.places().out('array'),
      phoneNumbers: this.extractPhoneNumbers(message),
      emails: this.extractEmails(message)
    };
    
    // Sentiment analysis
    const sentimentScore = this.sentiment.getSentiment(tokens);
    const sentiment = sentimentScore > 0.2 ? 'positive' : 
                     sentimentScore < -0.2 ? 'negative' : 'neutral';
    
    // Intent classification
    const intent = this.classifier.classify(message);
    const classifications = this.classifier.getClassifications(message);
    const confidence = classifications[0].value;
    
    // Emergency detection
    const emergencyKeywords = [
      'emergency', 'urgent', 'severe', 'pain', 'bleeding', 
      'swelling', 'broken', 'knocked out', 'abscess', 'infection'
    ];
    const isEmergency = emergencyKeywords.some(keyword => 
      message.toLowerCase().includes(keyword)
    );
    
    // Urgency scoring
    const urgencyScore = this.calculateUrgency(message, sentiment, isEmergency);
    
    return {
      tokens,
      entities,
      sentiment,
      sentimentScore,
      intent,
      confidence,
      isEmergency,
      urgencyScore,
      language: this.detectLanguage(message)
    };
  }

  // Build enhanced prompt with better context
  async buildEnhancedPrompt(message, nlpAnalysis, context) {
    const template = this.getIntentTemplate(nlpAnalysis.intent);
    const conversationHistory = this.formatConversationHistory(context);
    const patientContext = context.patientInfo ? 
      this.formatPatientContext(context.patientInfo) : '';
    
    // Include relevant knowledge base
    const relevantKnowledge = await this.getRelevantKnowledge(nlpAnalysis.intent);
    
    return `${template}

${patientContext}

Conversation Context:
${conversationHistory}

Relevant Information:
${relevantKnowledge}

Analysis:
- Intent: ${nlpAnalysis.intent} (confidence: ${(nlpAnalysis.confidence * 100).toFixed(1)}%)
- Sentiment: ${nlpAnalysis.sentiment}
- Urgency: ${nlpAnalysis.urgencyScore}/10
- Entities: ${JSON.stringify(nlpAnalysis.entities)}

User Message: "${message}"

Instructions:
1. Respond naturally and professionally as Sarah, the dental receptionist
2. Address the user's ${nlpAnalysis.intent} intent specifically
3. Use a ${nlpAnalysis.sentiment === 'negative' ? 'empathetic and reassuring' : 'friendly and helpful'} tone
4. Keep the response concise but complete
5. If scheduling, suggest specific available times
6. Always maintain HIPAA compliance

Response:`;
  }

  // Get AI response with retry logic and fallback
  async getAIResponseWithRetry(prompt, context, retries = 3) {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const completion = await this.openai.chat.completions.create({
          model: 'gpt-4-turbo-preview',
          messages: [
            {
              role: 'system',
              content: 'You are Sarah, a professional and friendly dental office AI receptionist. Provide helpful, accurate, and empathetic responses.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.7,
          max_tokens: 500,
          presence_penalty: 0.3,
          frequency_penalty: 0.3
        });
        
        return completion.choices[0].message.content;
        
      } catch (error) {
        logger.error(`AI request attempt ${attempt} failed:`, error);
        
        if (attempt === retries) {
          throw error;
        }
        
        // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }
  }

  // Post-process AI response
  postProcessResponse(response, nlpAnalysis) {
    // Remove any inappropriate content
    let processed = this.sanitizeResponse(response);
    
    // Add personalization based on sentiment
    if (nlpAnalysis.sentiment === 'negative') {
      processed = this.addEmpathy(processed);
    }
    
    // Ensure response is complete
    if (!processed.endsWith('.') && !processed.endsWith('!') && !processed.endsWith('?')) {
      processed += '.';
    }
    
    // Add call-to-action if appropriate
    if (nlpAnalysis.intent === 'appointment_booking' && !processed.includes('available')) {
      processed += ' Would you like me to check our available times for you?';
    }
    
    return processed;
  }

  // Handle emergency situations
  async handleEmergency(message, nlpAnalysis, context) {
    const emergencyType = this.classifyEmergency(message);
    const instructions = this.getEmergencyInstructions(emergencyType);
    
    // Log emergency
    logger.warn('Emergency detected:', {
      sessionId: context.sessionId,
      type: emergencyType,
      message: message
    });
    
    // Track in monitoring
    monitoringService.trackError(new Error('Emergency: ' + emergencyType), {
      severity: 'critical',
      sessionId: context.sessionId
    });
    
    return {
      response: instructions,
      intent: 'emergency',
      emergencyType,
      priority: 'high',
      suggestedActions: ['call_911', 'immediate_appointment', 'emergency_instructions']
    };
  }

  // Classify emergency type
  classifyEmergency(message) {
    const lower = message.toLowerCase();
    
    if (lower.includes('knocked out') || lower.includes('tooth out')) {
      return 'tooth_avulsion';
    } else if (lower.includes('bleeding')) {
      return 'hemorrhage';
    } else if (lower.includes('swelling') || lower.includes('abscess')) {
      return 'infection';
    } else if (lower.includes('broken') || lower.includes('fractured')) {
      return 'fracture';
    } else if (lower.includes('severe pain')) {
      return 'acute_pain';
    }
    
    return 'general_emergency';
  }

  // Get emergency instructions
  getEmergencyInstructions(type) {
    const instructions = {
      tooth_avulsion: `This is a dental emergency! For a knocked-out tooth:
1. Find the tooth and pick it up by the crown (white part), not the root
2. If dirty, gently rinse with milk or saline solution (not water)
3. Try to reinsert it into the socket if possible
4. If not, store in milk or saliva
5. Come to our office IMMEDIATELY or go to the ER
Time is critical - best results within 30 minutes!`,
      
      hemorrhage: `For bleeding:
1. Apply firm, direct pressure with clean gauze for 15-20 minutes
2. Do not rinse vigorously - this can worsen bleeding
3. If bleeding persists after 20 minutes, seek immediate care
4. Avoid hot liquids and exercise
We can see you immediately. Should I arrange emergency transportation?`,
      
      infection: `Dental infection warning signs detected:
1. This could be serious and spread to other parts of your body
2. Apply cold compress to reduce swelling
3. Take over-the-counter pain relievers as directed
4. Do NOT apply heat to the area
5. Seek immediate dental or medical care
Would you like to come in immediately for emergency treatment?`,
      
      fracture: `For a broken tooth:
1. Rinse mouth gently with warm water
2. Apply cold compress to reduce swelling
3. Save any tooth fragments
4. Avoid chewing on that side
5. Cover sharp edges with dental wax if available
We have emergency slots available. Can you come in right away?`,
      
      acute_pain: `For severe dental pain:
1. Rinse with warm salt water
2. Use dental floss to remove any trapped food
3. Apply cold compress externally
4. Take OTC pain medication as directed
5. Do not place aspirin directly on the tooth
This requires urgent attention. I can schedule you for an emergency appointment today.`,
      
      general_emergency: `This sounds like a dental emergency. 
Please describe your symptoms in more detail, or if you prefer, I can:
1. Schedule an immediate emergency appointment
2. Connect you with our on-call dentist
3. Provide specific first-aid instructions
What would be most helpful right now?`
    };
    
    return instructions[type] || instructions.general_emergency;
  }

  // Calculate urgency score
  calculateUrgency(message, sentiment, isEmergency) {
    let score = 5; // baseline
    
    if (isEmergency) score += 4;
    if (sentiment === 'negative') score += 2;
    
    const urgentWords = ['now', 'immediately', 'urgent', 'asap', 'today'];
    const urgentCount = urgentWords.filter(word => 
      message.toLowerCase().includes(word)
    ).length;
    score += urgentCount;
    
    return Math.min(10, score);
  }

  // Get fallback response
  getFallbackResponse(message) {
    const intent = this.classifier.classify(message);
    
    const fallbacks = {
      appointment_booking: "I'd be happy to help you schedule an appointment. Our system is currently updating. Please call us at (555) 123-4567 or I can take your information and have someone call you back shortly.",
      emergency: "If this is a medical emergency, please call 911 immediately. For urgent dental issues, please call our emergency line at (555) 123-4567.",
      billing: "For billing inquiries, I can connect you with our billing department. Please call (555) 123-4567 extension 2, or I can have someone contact you.",
      default: "I apologize, but I'm having trouble processing your request. Please call our office at (555) 123-4567 and our staff will be happy to assist you directly."
    };
    
    return fallbacks[intent] || fallbacks.default;
  }

  // Helper methods
  extractPhoneNumbers(text) {
    const phoneRegex = /(\+?1?\d{3}[-.\s]?\d{3}[-.\s]?\d{4})/g;
    return text.match(phoneRegex) || [];
  }

  extractEmails(text) {
    const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/g;
    return text.match(emailRegex) || [];
  }

  detectLanguage(text) {
    // Simple language detection based on character sets
    if (/[\u4e00-\u9fff]/.test(text)) return 'zh';
    if (/[\u0600-\u06ff]/.test(text)) return 'ar';
    if (/[\u0400-\u04ff]/.test(text)) return 'ru';
    if (/[àáâãäåèéêëìíîïòóôõöùúûü]/i.test(text)) return 'es';
    return 'en';
  }

  sanitizeResponse(response) {
    // Remove any PII that might have leaked
    response = response.replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, '[PHONE]');
    response = response.replace(/\b[A-Z][a-z]+ [A-Z][a-z]+\b/g, (match) => {
      // Keep "Dr." titles but remove other names
      return match.startsWith('Dr.') ? match : '[NAME]';
    });
    
    return response;
  }

  addEmpathy(response) {
    const empathyPhrases = [
      "I understand this must be concerning. ",
      "I'm sorry you're experiencing this. ",
      "I can see why that would be worrying. "
    ];
    
    if (!response.match(/sorry|understand|concern/i)) {
      return empathyPhrases[Math.floor(Math.random() * empathyPhrases.length)] + response;
    }
    
    return response;
  }

  formatConversationHistory(context) {
    const recent = context.conversationHistory.slice(-5);
    return recent.map(msg => 
      `${msg.role === 'user' ? 'Patient' : 'Sarah'}: ${msg.content}`
    ).join('\n');
  }

  formatPatientContext(patientInfo) {
    return `Patient: ${patientInfo.name}
Age: ${patientInfo.age}
Last Visit: ${patientInfo.recentAppointments?.[0]?.date || 'New patient'}
Insurance: ${patientInfo.insuranceProvider || 'None'}`;
  }

  async getRelevantKnowledge(intent) {
    const knowledge = {
      appointment_booking: "Office hours: Mon-Fri 8AM-5PM, Sat 9AM-2PM. Same-day appointments available for emergencies.",
      billing: "We accept most major insurance plans. Payment plans available. Cash, credit, and CareCredit accepted.",
      information: "Located at 123 Main St. Free parking available. New patients welcome.",
      emergency: "24/7 emergency line available. Same-day emergency appointments. After-hours care available."
    };
    
    return knowledge[intent] || '';
  }

  getIntentTemplate(intent) {
    const templates = {
      appointment_booking: "You are helping a patient schedule a dental appointment. Be specific about available times and gather necessary information.",
      appointment_cancel: "Help the patient cancel their appointment professionally. Offer to reschedule if appropriate.",
      emergency: "This is an urgent situation. Provide immediate, clear instructions and offer emergency appointment options.",
      billing: "Provide clear information about costs, insurance, and payment options. Be transparent and helpful.",
      information: "Provide accurate office information. Be welcoming and informative."
    };
    
    return templates[intent] || "Provide helpful and professional assistance as a dental receptionist.";
  }

  getSuggestedActions(intent) {
    const actions = {
      appointment_booking: ['view_calendar', 'select_time', 'confirm_appointment'],
      appointment_cancel: ['find_appointment', 'confirm_cancellation', 'offer_reschedule'],
      emergency: ['emergency_appointment', 'call_dentist', 'first_aid_instructions'],
      billing: ['check_insurance', 'payment_options', 'cost_estimate'],
      information: ['office_hours', 'location_map', 'services_list']
    };
    
    return actions[intent] || [];
  }

  generateSmartCacheKey(message, intent) {
    const normalized = message.toLowerCase().trim();
    const tokens = this.tokenizer.tokenize(normalized);
    const sorted = tokens.sort().join('_');
    return `${intent}_${this.hashString(sorted)}`;
  }

  hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(36);
  }

  async getCachedResponse(cacheKey) {
    return await cacheService.get('ai', cacheKey);
  }

  async cacheResponse(cacheKey, response) {
    await cacheService.set('ai', cacheKey, response, 600); // 10 minutes
  }

  updateMetrics(type, responseTime = null) {
    this.metrics.totalRequests++;
    
    if (type === 'cache_hit') {
      this.metrics.cacheHitRate = 
        ((this.metrics.cacheHitRate * (this.metrics.totalRequests - 1)) + 1) / 
        this.metrics.totalRequests;
    } else if (type === 'error') {
      this.metrics.errorRate = 
        ((this.metrics.errorRate * (this.metrics.totalRequests - 1)) + 1) / 
        this.metrics.totalRequests;
    }
    
    if (responseTime) {
      this.metrics.avgResponseTime = 
        ((this.metrics.avgResponseTime * (this.metrics.totalRequests - 1)) + responseTime) / 
        this.metrics.totalRequests;
    }
    
    // Report to monitoring service
    if (this.metrics.totalRequests % 100 === 0) {
      monitoringService.trackAICall(
        type !== 'error',
        this.metrics.avgResponseTime,
        0
      );
    }
  }

  loadResponseTemplates() {
    return {
      greeting: "Hello! I'm Sarah, your dental office assistant. How can I help you today?",
      appointment_confirmed: "Your appointment has been confirmed for {date} at {time}. We'll send you a reminder 24 hours before.",
      appointment_cancelled: "Your appointment has been cancelled. Would you like to reschedule?",
      closing: "Thank you for contacting us. Is there anything else I can help you with?"
    };
  }

  loadCommonPhrases() {
    return {
      availability: ["We have openings", "Available times include", "I can schedule you for"],
      confirmation: ["Can you confirm", "Is this correct", "Please verify"],
      assistance: ["How can I help", "What can I do for you", "How may I assist you"]
    };
  }
}

// Create singleton instance
const enhancedAIService = new EnhancedAIService();

export default enhancedAIService;