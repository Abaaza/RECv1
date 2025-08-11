import { createClient } from '@deepgram/sdk';

class DeepgramService {
  constructor() {
    this.client = null;
    this.connection = null;
    this.isListening = false;
    this.keepAliveInterval = null;
  }

  initialize() {
    const apiKey = import.meta.env.VITE_DEEPGRAM_API_KEY;
    console.log('Initializing Deepgram with API key:', apiKey ? `${apiKey.substring(0, 10)}...` : 'Missing');
    console.log('Full environment check:', {
      hasApiKey: !!apiKey,
      apiKeyLength: apiKey?.length,
      envMode: import.meta.env.MODE
    });
    
    if (!apiKey || apiKey === 'your-deepgram-api-key-here') {
      console.error('❌ Deepgram API key is not configured or is still placeholder');
      throw new Error('Deepgram API key is not configured. Please add your API key to the .env file');
    }
    
    this.client = createClient(apiKey);
    console.log('Deepgram client created successfully');
  }

  async startTranscription(onTranscript, onError) {
    try {
      console.log('Starting Deepgram transcription...');
      
      if (!this.client) {
        this.initialize();
      }

      // Create WebSocket connection for live transcription
      this.connection = this.client.listen.live({
        model: 'nova-2',
        language: 'en-US',
        punctuate: true,
        smart_format: true,
        interim_results: true,
        utterance_end_ms: 1000,
        vad_events: true,
        encoding: 'linear16',
        sample_rate: 16000,
        channels: 1
      });

      console.log('Deepgram connection created, setting up event handlers...');

      // Handle connection open
      this.connection.on('open', () => {
        console.log('✅ Deepgram WebSocket connection opened successfully');
        this.isListening = true;
        
        // Keep connection alive
        this.keepAliveInterval = setInterval(() => {
          if (this.connection && this.isListening) {
            console.log('Sending keep-alive ping to Deepgram');
            this.connection.keepAlive();
          }
        }, 10000);
      });

      // Handle transcription results
      this.connection.on('Results', (data) => {
        console.log('Deepgram Results event received:', data);
        
        if (data.channel && data.channel.alternatives && data.channel.alternatives[0]) {
          const transcript = data.channel.alternatives[0].transcript;
          
          if (transcript) {
            console.log(`📝 Transcript: "${transcript}" (Final: ${data.is_final})`);
            onTranscript(transcript, data.is_final);
          }
        }
      });

      // Handle other events for debugging
      this.connection.on('Metadata', (data) => {
        console.log('Deepgram Metadata received:', data);
      });

      this.connection.on('UtteranceEnd', (data) => {
        console.log('Deepgram UtteranceEnd event:', data);
      });

      // Handle errors
      this.connection.on('error', (error) => {
        console.error('❌ Deepgram WebSocket error:', error);
        console.error('Error details:', {
          message: error.message,
          code: error.code,
          type: error.type,
          status: error.status
        });
        
        // Check for specific error types
        if (error.message?.includes('401') || error.message?.includes('Unauthorized')) {
          console.error('❌ API Key authentication failed. Please check your Deepgram API key.');
          if (onError) onError(new Error('Invalid Deepgram API key. Please check your credentials.'));
        } else if (error.message?.includes('WebSocket')) {
          console.error('❌ WebSocket connection failed. Check network and firewall settings.');
          if (onError) onError(new Error('Failed to connect to Deepgram. Please check your connection.'));
        } else {
          if (onError) onError(error);
        }
      });

      // Handle connection close
      this.connection.on('close', () => {
        console.log('Deepgram WebSocket connection closed');
        this.isListening = false;
        if (this.keepAliveInterval) {
          clearInterval(this.keepAliveInterval);
          this.keepAliveInterval = null;
        }
      });

      return this.connection;
    } catch (error) {
      console.error('❌ Failed to start transcription:', error);
      throw error;
    }
  }

  async textToSpeech(text, voice = 'aura-asteria-en') {
    try {
      console.log(`🔊 Requesting TTS from backend for: "${text.substring(0, 50)}..." with voice: ${voice}`);

      // Call backend API for TTS
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5001/api'}/deepgram/tts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ text, voice })
      });

      if (!response.ok) {
        throw new Error(`TTS request failed: ${response.statusText}`);
      }

      // Get the audio blob
      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      
      // Get which voice was actually used
      const voiceUsed = response.headers.get('X-Voice-Used');
      console.log(`✅ Speech generated successfully with ${voiceUsed || voice}`);
      
      return audioUrl;
    } catch (error) {
      console.error('❌ TTS backend error:', error);
      console.log('Falling back to browser TTS');
      return this.browserTTS(text);
    }
  }

  browserTTS(text) {
    return new Promise((resolve) => {
      console.log('Using browser speech synthesis as fallback');
      
      const utterance = new SpeechSynthesisUtterance(text);
      
      // Get available voices
      let voices = speechSynthesis.getVoices();
      
      // If voices aren't loaded yet, wait for them
      if (voices.length === 0) {
        speechSynthesis.addEventListener('voiceschanged', () => {
          voices = speechSynthesis.getVoices();
          this.setFemaleVoice(utterance, voices);
        }, { once: true });
      } else {
        this.setFemaleVoice(utterance, voices);
      }
      
      utterance.rate = 1.0;
      utterance.pitch = 1.2; // Slightly higher pitch for more feminine sound
      utterance.volume = 1.0;
      
      speechSynthesis.speak(utterance);
      
      // Return a dummy URL for browser TTS
      resolve('browser-tts');
    });
  }

  setFemaleVoice(utterance, voices) {
    console.log('Available voices:', voices.map(v => v.name));
    
    // Priority list of female voice names to search for (Windows-specific first)
    const femaleVoiceKeywords = [
      // Windows voices
      'Microsoft Zira',    // Windows 10/11 female voice
      'Microsoft Hazel',   // Windows UK female voice
      'Zira',
      'Hazel',
      // Google voices
      'Google UK English Female',
      'Google US English Female',
      // Generic female indicators
      'Female', 'female',
      'Woman', 'woman',
      // Common female names
      'Samantha', 'Victoria', 'Kate', 'Allison', 'Ava', 'Susan',
      'Karen', 'Linda', 'Emma', 'Amy', 'Mary',
      // Any UK English (often female by default)
      'UK English',
      'British English'
    ];
    
    // Find the best female voice
    let selectedVoice = null;
    
    for (const keyword of femaleVoiceKeywords) {
      selectedVoice = voices.find(voice => 
        voice.name.includes(keyword) && voice.lang.startsWith('en')
      );
      if (selectedVoice) {
        console.log(`✅ Found female voice: ${selectedVoice.name}`);
        break;
      }
    }
    
    // If no female voice found, try to avoid male voices
    if (!selectedVoice) {
      const maleKeywords = ['David', 'Mark', 'Richard', 'George', 'James', 'Male', 'male'];
      selectedVoice = voices.find(voice => 
        voice.lang.startsWith('en-US') && 
        !maleKeywords.some(keyword => voice.name.includes(keyword))
      ) || 
      voices.find(voice => 
        voice.lang.startsWith('en') &&
        !maleKeywords.some(keyword => voice.name.includes(keyword))
      ) ||
      voices[0];
    }
    
    if (selectedVoice) {
      utterance.voice = selectedVoice;
      console.log(`Selected voice: ${selectedVoice.name}`);
    }
  }

  stopTranscription() {
    console.log('Stopping Deepgram transcription...');
    
    if (this.connection) {
      this.connection.finish();
      this.connection = null;
      this.isListening = false;
    }
    
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
      this.keepAliveInterval = null;
    }
  }

  sendAudio(audioData) {
    if (this.connection && this.isListening) {
      try {
        // Make sure we're sending the right format
        const byteLength = audioData.byteLength || audioData.length;
        
        if (byteLength > 0) {
          console.log(`🎤 Sending ${byteLength} bytes of audio data to Deepgram`);
          this.connection.send(audioData);
        }
      } catch (error) {
        console.error('❌ Error sending audio:', error);
      }
    } else {
      console.warn('Cannot send audio: connection not ready or not listening');
    }
  }
}

export default new DeepgramService();