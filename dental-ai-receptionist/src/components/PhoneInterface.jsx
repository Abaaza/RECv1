import React, { useState, useEffect, useRef } from 'react';
import { 
  Phone, PhoneOff, Mic, MicOff, Volume2, 
  User, Bot, Loader2, CheckCircle, XCircle,
  MessageCircle, Clock, Activity, Sparkles, Brain
} from 'lucide-react';
import deepgramService from '../services/deepgramService';
import audioService from '../services/audioService';
import { DentalAIAgent } from '../services/aiAgent';
import aiApiService from '../services/aiApiService';

const PhoneInterface = ({ onCallStatusChange, onConversationUpdate }) => {
  const [isCallActive, setIsCallActive] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [conversation, setConversation] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [audioLevel, setAudioLevel] = useState(0);
  const [microphoneStatus, setMicrophoneStatus] = useState('');
  
  const callTimerRef = useRef(null);
  const aiAgentRef = useRef(new DentalAIAgent());
  const conversationEndRef = useRef(null);
  const silenceTimerRef = useRef(null);
  const audioLevelIntervalRef = useRef(null);
  const audioQueueRef = useRef([]);
  const isPlayingRef = useRef(false);

  useEffect(() => {
    if (isCallActive) {
      callTimerRef.current = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    } else {
      if (callTimerRef.current) {
        clearInterval(callTimerRef.current);
      }
      setCallDuration(0);
    }
    
    return () => {
      if (callTimerRef.current) {
        clearInterval(callTimerRef.current);
      }
    };
  }, [isCallActive]);

  useEffect(() => {
    if (conversationEndRef.current) {
      conversationEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [conversation]);

  useEffect(() => {
    if (onCallStatusChange) {
      onCallStatusChange(isCallActive);
    }
  }, [isCallActive, onCallStatusChange]);

  useEffect(() => {
    if (onConversationUpdate) {
      onConversationUpdate(conversation);
    }
  }, [conversation, onConversationUpdate]);

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const addToConversation = (speaker, text, type = 'message') => {
    const entry = {
      id: Date.now(),
      speaker,
      text,
      type,
      timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    };
    setConversation(prev => [...prev, entry]);
  };

  // Play audio queue sequentially
  const playNextAudio = async () => {
    if (isPlayingRef.current || audioQueueRef.current.length === 0) {
      return;
    }

    isPlayingRef.current = true;
    setIsSpeaking(true);
    
    const { audioUrl, text } = audioQueueRef.current.shift();
    
    try {
      await audioService.playAudio(audioUrl);
    } catch (error) {
      console.error('Error playing audio:', error);
    }
    
    setIsSpeaking(false);
    isPlayingRef.current = false;
    
    // Check if there are more audio items to play
    if (audioQueueRef.current.length > 0) {
      setTimeout(playNextAudio, 50); // Reduced delay between audio clips
    }
  };

  const handleAnswerCall = async () => {
    try {
      setConnectionStatus('connecting');
      
      // Play ringtone
      await audioService.playRingtone();
      
      // Initialize audio
      await audioService.initialize();
      
      // Start Deepgram connection with proper event handling
      await deepgramService.startTranscription(
        async (text, isFinal) => {
          setCurrentTranscript(text);
          
          if (isFinal && text.trim()) {
            // Clear silence timer when user speaks
            if (silenceTimerRef.current) {
              clearTimeout(silenceTimerRef.current);
            }
            
            const cleanText = text.trim();
            // Check if it's just a filler sound or very short
            const isJustFiller = cleanText.length < 3 || 
                                cleanText.match(/^(um+|uh+|ah+|oh+|hmm+|mm+|er+)$/i) ||
                                cleanText.match(/^(okay|ok|yes|yeah|no|nah)$/i);
            
            // Always add to conversation for context
            addToConversation('Patient', text);
            setCurrentTranscript('');
            
            // Only process substantial messages
            if (!isJustFiller || cleanText.length > 5) {
              // Process with AI agent
              setIsProcessing(true);
              setIsListening(false);
              
              try {
                // Use API service for better AI responses (with OpenAI)
                const response = await aiApiService.processMessage(text);
                
                // Only add response if meaningful
                if (response.response && response.response.trim()) {
                  // Add AI response to conversation
                  addToConversation('Sarah', response.response);
                  
                  // Convert response to speech and add to queue
                  const audioUrl = await deepgramService.textToSpeech(
                    response.response, 
                    'aura-asteria-en' // Female voice - Asteria
                  );
                  
                  // Add to audio queue instead of playing immediately
                  audioQueueRef.current.push({ audioUrl, text: response.response });
                  
                  // Start playing if not already playing
                  if (!isPlayingRef.current) {
                    playNextAudio();
                  }
                }
                
                // Resume listening after processing
                setIsListening(true);
              
              // Set silence timer to detect when user stops talking
              silenceTimerRef.current = setTimeout(() => {
                if (isListening && !currentTranscript) {
                  // Prompt user if silent for too long
                  const prompt = "Are you still there? How else can I help you today?";
                  addToConversation('Sarah', prompt, 'prompt');
                  deepgramService.textToSpeech(prompt, 'aura-luna-en').then(url => {
                    audioService.playAudio(url);
                  });
                }
              }, 8000); // 8 seconds of silence
              } catch (error) {
                console.error('Processing error:', error);
                addToConversation('System', 'Error processing request. Please try again.', 'error');
              } finally {
                setIsProcessing(false);
              }
            } else {
              // For simple fillers, just keep listening without processing
              setIsListening(true);
            }
          }
        },
        (error) => {
          console.error('Transcription error:', error);
          setConnectionStatus('error');
          addToConversation('System', 'Connection error. Please check your microphone.', 'error');
        }
      );
      
      // Start recording with volume monitoring
      audioService.startRecording(
        (audioData) => {
          deepgramService.sendAudio(audioData);
        },
        (volumeLevel) => {
          setAudioLevel(volumeLevel);
        }
      );
      
      setIsCallActive(true);
      setIsListening(true);
      setConnectionStatus('connected');
      
      // Initial greeting with female voice
      const greeting = "Hello! Thank you for calling DentalCare. I'm Sarah, your AI dental assistant. How may I help you today?";
      addToConversation('Sarah', greeting, 'greeting');
      
      const audioUrl = await deepgramService.textToSpeech(greeting, 'aura-asteria-en');
      audioQueueRef.current.push({ audioUrl, text: greeting });
      playNextAudio();
      
    } catch (error) {
      console.error('Failed to answer call:', error);
      setConnectionStatus('error');
      alert('Failed to initialize call. Please check your microphone permissions.');
    }
  };

  const handleEndCall = () => {
    // Clear all timers
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
    }
    
    // Clear audio queue
    audioQueueRef.current = [];
    isPlayingRef.current = false;
    
    audioService.stopRecording();
    deepgramService.stopTranscription();
    audioService.cleanup();
    
    setIsCallActive(false);
    setIsListening(false);
    setIsSpeaking(false);
    setCurrentTranscript('');
    setConnectionStatus('disconnected');
    setAudioLevel(0);
    
    // Reset AI conversation
    aiApiService.resetConversation();
    
    // Add end call message
    if (conversation.length > 0) {
      addToConversation('System', 'Call ended', 'system');
    }
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
    if (isMuted) {
      audioService.startRecording(
        (audioData) => {
          deepgramService.sendAudio(audioData);
        },
        (volumeLevel) => {
          setAudioLevel(volumeLevel);
        }
      );
      setIsListening(true);
    } else {
      audioService.stopRecording();
      setIsListening(false);
      setAudioLevel(0);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
      {/* Left Panel - Call Controls */}
      <div className="lg:col-span-1">
        <div className="bg-gray-800/50 backdrop-blur-xl rounded-2xl border border-gray-700 p-6">
          {/* AI Assistant Info */}
          <div className="text-center mb-6">
            <div className="relative inline-block mb-4">
              <div className="w-24 h-24 bg-gradient-to-br from-violet-500 to-purple-500 rounded-full flex items-center justify-center mx-auto">
                <Bot className="w-12 h-12 text-white" />
              </div>
              {isCallActive && (
                <div className="absolute bottom-0 right-0 w-6 h-6 bg-green-500 rounded-full border-2 border-gray-800 animate-pulse" />
              )}
            </div>
            <h3 className="text-xl font-semibold mb-1">Sarah AI</h3>
            <p className="text-sm text-gray-400">Dental Assistant</p>
          </div>

          {/* Connection Status */}
          <div className="mb-6">
            <div className={`rounded-xl p-4 border ${
              connectionStatus === 'connected' 
                ? 'bg-green-500/10 border-green-500/30' 
                : connectionStatus === 'connecting'
                ? 'bg-yellow-500/10 border-yellow-500/30'
                : connectionStatus === 'error'
                ? 'bg-red-500/10 border-red-500/30'
                : 'bg-gray-700/30 border-gray-600'
            }`}>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Status</span>
                <div className="flex items-center space-x-2">
                  {connectionStatus === 'connected' ? (
                    <>
                      <CheckCircle className="w-4 h-4 text-green-400" />
                      <span className="text-green-400 text-sm">Connected</span>
                    </>
                  ) : connectionStatus === 'connecting' ? (
                    <>
                      <Loader2 className="w-4 h-4 text-yellow-400 animate-spin" />
                      <span className="text-yellow-400 text-sm">Connecting...</span>
                    </>
                  ) : connectionStatus === 'error' ? (
                    <>
                      <XCircle className="w-4 h-4 text-red-400" />
                      <span className="text-red-400 text-sm">Error</span>
                    </>
                  ) : (
                    <>
                      <div className="w-2 h-2 bg-gray-500 rounded-full" />
                      <span className="text-gray-400 text-sm">Disconnected</span>
                    </>
                  )}
                </div>
              </div>
              
              {isCallActive && (
                <div className="mt-3 pt-3 border-t border-gray-700">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-400">Duration</span>
                    <span className="font-mono text-white">{formatDuration(callDuration)}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Call Controls */}
          <div className="space-y-4">
            {!isCallActive ? (
              <button
                onClick={handleAnswerCall}
                className="w-full py-4 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-medium rounded-xl flex items-center justify-center space-x-3 transition-all transform hover:scale-105"
              >
                <Phone className="w-5 h-5" />
                <span>Start Call with Sarah</span>
              </button>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={toggleMute}
                    className={`py-3 rounded-xl font-medium flex items-center justify-center space-x-2 transition-all ${
                      isMuted 
                        ? 'bg-red-500/20 text-red-400 border border-red-500/30' 
                        : 'bg-gray-700/50 text-gray-300 border border-gray-600 hover:bg-gray-700'
                    }`}
                  >
                    {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                    <span>{isMuted ? 'Muted' : 'Mute'}</span>
                  </button>
                  
                  <button
                    onClick={handleEndCall}
                    className="py-3 bg-red-500/20 text-red-400 border border-red-500/30 rounded-xl font-medium flex items-center justify-center space-x-2 hover:bg-red-500/30 transition-all"
                  >
                    <PhoneOff className="w-5 h-5" />
                    <span>End</span>
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Activity Indicators */}
          {isCallActive && (
            <div className="mt-6 space-y-3">
              {/* Microphone Volume Indicator */}
              <div className="rounded-lg p-3 bg-gray-700/30 border border-gray-600">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <Activity className="w-4 h-4 text-green-400" />
                    <span className="text-sm">Microphone Level</span>
                  </div>
                  <span className="text-xs text-gray-400">{audioLevel}%</span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
                  <div 
                    className={`h-full transition-all duration-100 ${
                      audioLevel > 60 ? 'bg-red-500' : 
                      audioLevel > 30 ? 'bg-yellow-500' : 
                      audioLevel > 5 ? 'bg-green-500' : 
                      'bg-gray-600'
                    }`}
                    style={{ width: `${audioLevel}%` }}
                  />
                </div>
                {audioLevel === 0 && isListening && (
                  <p className="text-xs text-yellow-400 mt-2">No audio detected - check microphone</p>
                )}
              </div>
              
              <div className={`rounded-lg p-3 ${isListening ? 'bg-blue-500/10 border border-blue-500/30' : 'bg-gray-700/30 border border-gray-600'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Mic className={`w-4 h-4 ${isListening ? 'text-blue-400' : 'text-gray-500'}`} />
                    <span className="text-sm">Listening</span>
                  </div>
                  {isListening && (
                    <div className="flex space-x-1">
                      <div className="w-1 h-3 bg-blue-400 rounded-full animate-pulse" />
                      <div className="w-1 h-3 bg-blue-400 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }} />
                      <div className="w-1 h-3 bg-blue-400 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }} />
                    </div>
                  )}
                </div>
              </div>

              <div className={`rounded-lg p-3 ${isSpeaking ? 'bg-purple-500/10 border border-purple-500/30' : 'bg-gray-700/30 border border-gray-600'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Volume2 className={`w-4 h-4 ${isSpeaking ? 'text-purple-400' : 'text-gray-500'}`} />
                    <span className="text-sm">Speaking</span>
                  </div>
                  {isSpeaking && (
                    <div className="flex space-x-1">
                      <div className="w-1 h-3 bg-purple-400 rounded-full animate-pulse" />
                      <div className="w-1 h-3 bg-purple-400 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }} />
                      <div className="w-1 h-3 bg-purple-400 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }} />
                    </div>
                  )}
                </div>
              </div>

              <div className={`rounded-lg p-3 ${isProcessing ? 'bg-yellow-500/10 border border-yellow-500/30' : 'bg-gray-700/30 border border-gray-600'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Brain className={`w-4 h-4 ${isProcessing ? 'text-yellow-400' : 'text-gray-500'}`} />
                    <span className="text-sm">Processing</span>
                  </div>
                  {isProcessing && (
                    <Loader2 className="w-4 h-4 text-yellow-400 animate-spin" />
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right Panel - Conversation */}
      <div className="lg:col-span-2">
        <div className="bg-gray-800/50 backdrop-blur-xl rounded-2xl border border-gray-700 h-full flex flex-col">
          {/* Header */}
          <div className="p-4 border-b border-gray-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <MessageCircle className="w-5 h-5 text-violet-400" />
                <h3 className="text-lg font-semibold">Conversation</h3>
              </div>
              {conversation.length > 0 && (
                <button 
                  onClick={() => setConversation([])}
                  className="text-sm text-gray-400 hover:text-white transition-colors"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {conversation.length === 0 && !isCallActive ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <Sparkles className="w-12 h-12 text-gray-600 mb-4" />
                <p className="text-gray-400 mb-2">No conversation yet</p>
                <p className="text-sm text-gray-500">Click "Start Call" to begin talking with Sarah</p>
              </div>
            ) : (
              <>
                {conversation.map((entry) => (
                  <div
                    key={entry.id}
                    className={`flex ${entry.speaker === 'Patient' ? 'justify-end' : 'justify-start'} animate-fadeIn`}
                  >
                    <div className={`max-w-[70%] ${entry.speaker === 'Patient' ? 'order-2' : 'order-1'}`}>
                      <div className="flex items-start space-x-2">
                        {entry.speaker !== 'Patient' && (
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                            entry.speaker === 'Sarah' 
                              ? 'bg-gradient-to-br from-violet-500 to-purple-500' 
                              : 'bg-gray-700'
                          }`}>
                            {entry.speaker === 'Sarah' ? (
                              <Bot className="w-4 h-4 text-white" />
                            ) : (
                              <Activity className="w-4 h-4 text-gray-400" />
                            )}
                          </div>
                        )}
                        
                        <div className="flex-1">
                          <div className="flex items-baseline space-x-2 mb-1">
                            <span className={`text-xs font-medium ${
                              entry.speaker === 'Patient' 
                                ? 'text-blue-400' 
                                : entry.speaker === 'Sarah'
                                ? 'text-violet-400'
                                : 'text-gray-400'
                            }`}>
                              {entry.speaker}
                            </span>
                            <span className="text-xs text-gray-500">{entry.timestamp}</span>
                          </div>
                          
                          <div className={`rounded-xl px-4 py-2 ${
                            entry.speaker === 'Patient'
                              ? 'bg-blue-500/20 border border-blue-500/30'
                              : entry.speaker === 'Sarah'
                              ? 'bg-violet-500/10 border border-violet-500/20'
                              : entry.type === 'error'
                              ? 'bg-red-500/10 border border-red-500/20'
                              : 'bg-gray-700/50 border border-gray-600'
                          }`}>
                            <p className="text-sm">{entry.text}</p>
                          </div>
                        </div>
                        
                        {entry.speaker === 'Patient' && (
                          <div className="w-8 h-8 bg-blue-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                            <User className="w-4 h-4 text-blue-400" />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                
                {/* Current transcript (live typing) */}
                {currentTranscript && (
                  <div className="flex justify-end animate-fadeIn">
                    <div className="max-w-[70%]">
                      <div className="flex items-start space-x-2">
                        <div className="flex-1">
                          <div className="rounded-xl px-4 py-2 bg-blue-500/10 border border-blue-500/20">
                            <p className="text-sm text-blue-300 italic">{currentTranscript}</p>
                          </div>
                        </div>
                        <div className="w-8 h-8 bg-blue-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                          <User className="w-4 h-4 text-blue-400" />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                
                <div ref={conversationEndRef} />
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PhoneInterface;