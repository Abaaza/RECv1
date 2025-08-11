import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import './App.css';

const API_URL = 'http://localhost:5000';

function App() {
  const [messages, setMessages] = useState([
    { 
      role: 'assistant', 
      content: 'Hello! I\'m Sarah, your dental office assistant. How can I help you today? I can help you schedule appointments, answer questions about our services, or assist with dental emergencies.' 
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId] = useState(() => `session_${Date.now()}`);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!inputMessage.trim() || isLoading) return;

    const userMessage = inputMessage;
    setInputMessage('');
    
    // Add user message to chat
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      const response = await axios.post(`${API_URL}/api/chat`, {
        message: userMessage,
        sessionId
      });

      // Add AI response to chat
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: response.data.response,
        isEmergency: response.data.isEmergency,
        appointmentIntent: response.data.appointmentIntent
      }]);

      // If appointment intent detected, show booking options
      if (response.data.appointmentIntent?.wantsAppointment) {
        // Could trigger appointment booking UI here
        console.log('User wants to book appointment:', response.data.appointmentIntent);
      }

      // If emergency detected, highlight it
      if (response.data.isEmergency) {
        console.log('Emergency detected!');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: 'I apologize, but I\'m having trouble connecting. Please try again or call our office at (555) 123-4567.',
        error: true
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const quickActions = [
    'Book an appointment',
    'What are your hours?',
    'I have tooth pain',
    'Do you accept insurance?',
    'What services do you offer?'
  ];

  const handleQuickAction = (action) => {
    setInputMessage(action);
  };

  return (
    <div className="app">
      <div className="chat-container">
        <div className="chat-header">
          <div className="header-content">
            <h1>🦷 Dental AI Receptionist</h1>
            <p>Available 24/7 to help with your dental needs</p>
          </div>
        </div>

        <div className="messages-container">
          {messages.map((message, index) => (
            <div 
              key={index} 
              className={`message ${message.role} ${message.isEmergency ? 'emergency' : ''} ${message.error ? 'error' : ''}`}
            >
              <div className="message-header">
                {message.role === 'user' ? '👤 You' : '🤖 Sarah'}
                {message.isEmergency && <span className="emergency-badge">⚠️ Emergency</span>}
              </div>
              <div className="message-content">
                {message.content}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="message assistant loading">
              <div className="message-header">🤖 Sarah</div>
              <div className="typing-indicator">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="quick-actions">
          {quickActions.map((action, index) => (
            <button 
              key={index}
              className="quick-action-btn"
              onClick={() => handleQuickAction(action)}
            >
              {action}
            </button>
          ))}
        </div>

        <form className="input-form" onSubmit={sendMessage}>
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            placeholder="Type your message here..."
            disabled={isLoading}
            className="message-input"
          />
          <button 
            type="submit" 
            disabled={isLoading || !inputMessage.trim()}
            className="send-button"
          >
            {isLoading ? '...' : 'Send'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default App;