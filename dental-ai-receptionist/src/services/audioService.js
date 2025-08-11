class AudioService {
  constructor() {
    this.mediaRecorder = null;
    this.audioStream = null;
    this.audioContext = null;
    this.isRecording = false;
    this.processor = null;
    this.source = null;
  }

  async initialize() {
    try {
      console.log('🎤 Initializing audio service...');
      
      // Check if getUserMedia is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('getUserMedia not supported in this browser');
      }
      
      // Request microphone access with multiple configurations for better compatibility
      try {
        this.audioStream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            sampleRate: 16000
          } 
        });
      } catch (initialError) {
        console.warn('Failed with 16kHz, trying default sample rate...', initialError);
        // Fallback to default sample rate if 16kHz is not supported
        this.audioStream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          } 
        });
      }
      
      console.log('✅ Microphone access granted');
      console.log('Audio tracks:', this.audioStream.getAudioTracks());
      
      // Check if audio tracks are available and enabled
      const audioTracks = this.audioStream.getAudioTracks();
      if (audioTracks.length === 0) {
        throw new Error('No audio tracks available');
      }
      
      audioTracks.forEach(track => {
        console.log(`Track: ${track.label}, Enabled: ${track.enabled}, Muted: ${track.muted}`);
        if (!track.enabled) {
          track.enabled = true;
        }
      });
      
      // Create audio context for processing
      try {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
          sampleRate: 16000
        });
      } catch (contextError) {
        console.warn('Failed to create 16kHz context, using default...', contextError);
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      }
      
      console.log('✅ Audio context created with sample rate:', this.audioContext.sampleRate);
      
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize audio:', error);
      
      // Provide more specific error messages
      if (error.name === 'NotAllowedError') {
        throw new Error('Microphone access denied. Please allow microphone access and try again.');
      } else if (error.name === 'NotFoundError') {
        throw new Error('No microphone found. Please connect a microphone and try again.');
      } else if (error.name === 'NotReadableError') {
        throw new Error('Microphone is in use by another application. Please close other apps using the microphone.');
      } else {
        throw new Error('Microphone access error: ' + error.message);
      }
    }
  }

  startRecording(onDataAvailable, onVolumeUpdate) {
    if (!this.audioStream) {
      throw new Error('Audio not initialized. Call initialize() first.');
    }

    console.log('🎙️ Starting audio recording with direct PCM streaming...');
    
    // Store the volume callback
    this.onVolumeUpdate = onVolumeUpdate;
    
    // Always use ScriptProcessor for direct PCM streaming to Deepgram
    this.startDirectPCMStreaming(onDataAvailable);
  }

  startDirectPCMStreaming(onDataAvailable) {
    console.log('Starting direct PCM streaming for Deepgram...');
    
    // Create source from stream
    this.source = this.audioContext.createMediaStreamSource(this.audioStream);
    
    // Create an analyser node for better volume detection
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 256;
    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    
    // Create script processor for real-time processing
    // Buffer size of 2048 gives good balance between latency and performance
    const bufferSize = 2048;
    this.processor = this.audioContext.createScriptProcessor(bufferSize, 1, 1);
    
    // Add debug counter
    let processCount = 0;
    let lastLogTime = Date.now();
    
    // Process audio in real-time
    this.processor.onaudioprocess = (e) => {
      processCount++;
      
      // Log every second to check if processor is working
      if (Date.now() - lastLogTime > 1000) {
        console.log(`📊 Audio processor: ${processCount} chunks processed in last second`);
        processCount = 0;
        lastLogTime = Date.now();
      }
      if (!this.isRecording) return;
      
      const inputData = e.inputBuffer.getChannelData(0);
      
      // Get frequency data from analyser for better volume detection
      this.analyser.getByteFrequencyData(dataArray);
      let analyserVolume = 0;
      for (let i = 0; i < dataArray.length; i++) {
        analyserVolume += dataArray[i];
      }
      analyserVolume = analyserVolume / dataArray.length / 255; // Normalize to 0-1
      
      // Convert float32 to int16 (PCM format that Deepgram expects)
      const int16Array = new Int16Array(inputData.length);
      let volume = 0;
      
      for (let i = 0; i < inputData.length; i++) {
        // Clamp the value between -1 and 1
        const sample = Math.max(-1, Math.min(1, inputData[i]));
        // Convert to 16-bit PCM
        int16Array[i] = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
        // Calculate volume for debugging
        volume += Math.abs(sample);
      }
      
      // Calculate average volume (for debugging)
      volume = volume / inputData.length;
      
      // Use the higher of the two volume measurements
      const finalVolume = Math.max(volume, analyserVolume);
      
      // Send volume update to UI
      if (this.onVolumeUpdate) {
        // Convert to percentage (0-100)
        const volumePercent = Math.min(100, Math.round(finalVolume * 500));
        this.onVolumeUpdate(volumePercent);
      }
      
      // Log significant audio
      if (finalVolume > 0.001) {
        console.log(`🎤 Audio detected: volume=${finalVolume.toFixed(4)} (${Math.round(finalVolume * 500)}%) | analyser=${analyserVolume.toFixed(4)}`);
      }
      
      // Always send audio data to Deepgram for better voice detection
      if (onDataAvailable) {
        onDataAvailable(int16Array.buffer);
      }
    };
    
    // Connect the nodes: source -> analyser -> processor -> destination
    this.source.connect(this.analyser);
    this.source.connect(this.processor);
    this.analyser.connect(this.processor);
    this.processor.connect(this.audioContext.destination);
    
    this.isRecording = true;
    console.log('✅ Direct PCM streaming started');
  }

  stopRecording() {
    console.log('🛑 Stopping recording...');
    
    this.isRecording = false;
    
    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
    }
    
    if (this.analyser) {
      this.analyser.disconnect();
      this.analyser = null;
    }
    
    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }
    
    // Clear volume callback
    this.onVolumeUpdate = null;
    
    console.log('Recording stopped');
  }

  async playAudio(audioUrl) {
    try {
      // Handle browser TTS
      if (audioUrl === 'browser-tts') {
        console.log('Browser TTS playback (handled by speechSynthesis)');
        // Wait a bit for speech synthesis to complete
        return new Promise(resolve => setTimeout(resolve, 50));
      }
      
      console.log(`🔊 Playing audio from URL: ${audioUrl.substring(0, 50)}...`);
      
      const audio = new Audio(audioUrl);
      audio.volume = 0.8;
      
      return new Promise((resolve, reject) => {
        audio.onended = () => {
          console.log('✅ Audio playback completed');
          if (audioUrl.startsWith('blob:')) {
            URL.revokeObjectURL(audioUrl);
          }
          resolve();
        };
        
        audio.onerror = (error) => {
          console.error('❌ Audio playback error:', error);
          if (audioUrl.startsWith('blob:')) {
            URL.revokeObjectURL(audioUrl);
          }
          reject(error);
        };
        
        audio.oncanplay = () => {
          console.log('Audio ready to play');
        };
        
        audio.play().catch((error) => {
          console.error('❌ Failed to play audio:', error);
          reject(error);
        });
      });
    } catch (error) {
      console.error('❌ Error playing audio:', error);
      throw error;
    }
  }

  cleanup() {
    console.log('🧹 Cleaning up audio service...');
    
    this.stopRecording();
    
    if (this.audioStream) {
      this.audioStream.getTracks().forEach(track => {
        track.stop();
        console.log('Audio track stopped');
      });
      this.audioStream = null;
    }
    
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
      this.audioContext = null;
      console.log('Audio context closed');
    }
  }

  // Simulate phone ring
  async playRingtone() {
    console.log('🔔 Playing ringtone...');
    
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const duration = 0.5;
    const frequency1 = 440;
    const frequency2 = 480;
    
    for (let i = 0; i < 2; i++) { // Reduced to 2 rings for faster startup
      const oscillator1 = audioContext.createOscillator();
      const oscillator2 = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator1.frequency.value = frequency1;
      oscillator2.frequency.value = frequency2;
      oscillator1.type = 'sine';
      oscillator2.type = 'sine';
      
      oscillator1.connect(gainNode);
      oscillator2.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      gainNode.gain.setValueAtTime(0.2, audioContext.currentTime); // Reduced volume
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);
      
      oscillator1.start(audioContext.currentTime);
      oscillator2.start(audioContext.currentTime);
      oscillator1.stop(audioContext.currentTime + duration);
      oscillator2.stop(audioContext.currentTime + duration);
      
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    console.log('✅ Ringtone completed');
  }
}

export default new AudioService();