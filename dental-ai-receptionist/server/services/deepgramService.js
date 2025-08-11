import { createClient } from '@deepgram/sdk';
import { logger } from '../utils/logger.js';

const deepgramApiKey = process.env.DEEPGRAM_API_KEY;
let deepgram;

if (deepgramApiKey) {
  deepgram = createClient(deepgramApiKey);
}

export const processVoiceCall = async (audioData) => {
  try {
    if (!deepgram) {
      logger.warn('Deepgram client not configured');
      return { transcript: '', error: 'Deepgram not configured' };
    }

    const { result, error } = await deepgram.listen.prerecorded.transcribeFile(
      audioData,
      {
        model: 'nova-2',
        language: 'en-US',
        smart_format: true,
        punctuate: true,
        diarize: true,
        utterances: true
      }
    );

    if (error) {
      throw error;
    }

    const transcript = result.results.channels[0].alternatives[0].transcript;
    const words = result.results.channels[0].alternatives[0].words;
    const utterances = result.results.utterances || [];

    logger.info('Voice transcription completed');

    return {
      transcript,
      words,
      utterances,
      confidence: result.results.channels[0].alternatives[0].confidence
    };
  } catch (error) {
    logger.error('Voice transcription error:', error);
    throw error;
  }
};

export const startLiveTranscription = () => {
  if (!deepgram) {
    logger.warn('Deepgram client not configured');
    return null;
  }

  const connection = deepgram.listen.live({
    model: 'nova-2',
    language: 'en-US',
    smart_format: true,
    punctuate: true,
    interim_results: true,
    utterance_end_ms: 1000,
    vad_events: true,
    endpointing: 300
  });

  connection.on('open', () => {
    logger.info('Deepgram live transcription connection opened');
  });

  connection.on('error', (error) => {
    logger.error('Deepgram live transcription error:', error);
  });

  connection.on('close', () => {
    logger.info('Deepgram live transcription connection closed');
  });

  return connection;
};

export const textToSpeech = async (text, voice = 'aura-asteria-en') => {
  try {
    if (!deepgram) {
      logger.warn('Deepgram client not configured');
      return null;
    }

    const response = await deepgram.speak.request(
      { text },
      {
        model: voice,
        encoding: 'linear16',
        sample_rate: 24000
      }
    );

    logger.info('Text-to-speech conversion completed');

    return response.stream;
  } catch (error) {
    logger.error('Text-to-speech error:', error);
    throw error;
  }
};

export const analyzeConversation = async (transcript) => {
  try {
    const keywords = extractKeywords(transcript);
    const intent = detectIntent(transcript);
    const sentiment = analyzeSentiment(transcript);
    const emergencyDetected = detectEmergency(transcript);

    return {
      keywords,
      intent,
      sentiment,
      emergencyDetected,
      summary: generateSummary(transcript)
    };
  } catch (error) {
    logger.error('Conversation analysis error:', error);
    throw error;
  }
};

function extractKeywords(text) {
  const commonWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been', 'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'can', 'shall', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them']);
  
  const words = text.toLowerCase().split(/\W+/);
  const wordFreq = {};
  
  words.forEach(word => {
    if (word.length > 2 && !commonWords.has(word)) {
      wordFreq[word] = (wordFreq[word] || 0) + 1;
    }
  });
  
  return Object.entries(wordFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word]) => word);
}

function detectIntent(text) {
  const lowerText = text.toLowerCase();
  
  const intents = {
    appointment_booking: ['appointment', 'schedule', 'book', 'available', 'opening'],
    appointment_cancel: ['cancel', 'reschedule', 'change appointment'],
    emergency: ['emergency', 'urgent', 'pain', 'bleeding', 'swelling', 'broken tooth'],
    information: ['hours', 'location', 'insurance', 'cost', 'price'],
    prescription: ['prescription', 'medication', 'refill'],
    symptoms: ['hurt', 'ache', 'sensitive', 'cavity', 'gum'],
    general: ['hello', 'hi', 'help', 'question']
  };
  
  for (const [intent, keywords] of Object.entries(intents)) {
    if (keywords.some(keyword => lowerText.includes(keyword))) {
      return intent;
    }
  }
  
  return 'general';
}

function analyzeSentiment(text) {
  const positiveWords = ['good', 'great', 'excellent', 'happy', 'pleased', 'satisfied', 'wonderful', 'perfect', 'thank'];
  const negativeWords = ['bad', 'terrible', 'awful', 'horrible', 'pain', 'hurt', 'disappointed', 'angry', 'frustrated'];
  
  const lowerText = text.toLowerCase();
  let score = 0;
  
  positiveWords.forEach(word => {
    if (lowerText.includes(word)) score++;
  });
  
  negativeWords.forEach(word => {
    if (lowerText.includes(word)) score--;
  });
  
  if (score > 0) return 'positive';
  if (score < 0) return 'negative';
  return 'neutral';
}

function detectEmergency(text) {
  const emergencyKeywords = [
    'emergency', 'urgent', 'severe pain', 'bleeding', 'swelling',
    'knocked out', 'broken tooth', 'abscess', 'infection', 'fever',
    'can\'t eat', 'can\'t sleep', 'unbearable'
  ];
  
  const lowerText = text.toLowerCase();
  return emergencyKeywords.some(keyword => lowerText.includes(keyword));
}

function generateSummary(text) {
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [];
  
  if (sentences.length <= 2) {
    return text;
  }
  
  return sentences.slice(0, 2).join(' ').trim();
}

export const verifyDeepgramConfiguration = async () => {
  try {
    if (!deepgram) {
      logger.warn('Deepgram client not configured');
      return false;
    }

    const { result } = await deepgram.manage.getProjectBalances();
    logger.info('Deepgram configuration verified successfully');
    return true;
  } catch (error) {
    logger.error('Deepgram configuration verification failed:', error);
    return false;
  }
};

export default {
  processVoiceCall,
  startLiveTranscription,
  textToSpeech,
  analyzeConversation,
  verifyDeepgramConfiguration
};