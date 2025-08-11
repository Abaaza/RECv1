import React, { useState, useEffect } from 'react';
import { Brain, Plus, Save, Trash2, Edit2, CheckCircle, XCircle, MessageSquare, Mic, PlayCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';

const AITraining = () => {
  const [scenarios, setScenarios] = useState([]);
  const [responses, setResponses] = useState([]);
  const [isAddingScenario, setIsAddingScenario] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [testMode, setTestMode] = useState(false);
  const [testInput, setTestInput] = useState('');
  const [testResult, setTestResult] = useState(null);
  
  const [newScenario, setNewScenario] = useState({
    trigger: '',
    response: '',
    category: 'general',
    priority: 'normal',
    keywords: []
  });

  const categories = [
    { value: 'general', label: 'General Inquiry', color: 'blue' },
    { value: 'appointment', label: 'Appointment', color: 'green' },
    { value: 'emergency', label: 'Emergency', color: 'red' },
    { value: 'billing', label: 'Billing', color: 'yellow' },
    { value: 'insurance', label: 'Insurance', color: 'purple' },
    { value: 'followup', label: 'Follow-up', color: 'indigo' }
  ];

  const priorities = [
    { value: 'low', label: 'Low', color: 'gray' },
    { value: 'normal', label: 'Normal', color: 'blue' },
    { value: 'high', label: 'High', color: 'orange' },
    { value: 'critical', label: 'Critical', color: 'red' }
  ];

  useEffect(() => {
    loadTrainingData();
  }, []);

  const loadTrainingData = () => {
    const savedScenarios = localStorage.getItem('ai_training_scenarios');
    if (savedScenarios) {
      setScenarios(JSON.parse(savedScenarios));
    } else {
      // Default scenarios
      setScenarios([
        {
          id: '1',
          trigger: 'What are your office hours?',
          response: 'Our office hours are Monday through Friday, 9 AM to 5 PM. We have a lunch break from 12 PM to 1 PM. For emergencies outside these hours, please call our emergency line.',
          category: 'general',
          priority: 'normal',
          keywords: ['hours', 'open', 'schedule', 'time'],
          usageCount: 45
        },
        {
          id: '2',
          trigger: 'I have severe tooth pain',
          response: 'I understand you\'re experiencing severe tooth pain. This could be a dental emergency. Can you describe where the pain is located and how long you\'ve been experiencing it? I can help you schedule an emergency appointment right away.',
          category: 'emergency',
          priority: 'critical',
          keywords: ['pain', 'hurt', 'ache', 'emergency'],
          usageCount: 23
        },
        {
          id: '3',
          trigger: 'Do you accept my insurance?',
          response: 'We accept most major dental insurance plans. Could you please tell me which insurance provider you have? I can quickly check if we\'re in-network with your plan and explain your coverage options.',
          category: 'insurance',
          priority: 'high',
          keywords: ['insurance', 'coverage', 'plan', 'accept'],
          usageCount: 67
        }
      ]);
    }
  };

  const saveScenario = () => {
    if (!newScenario.trigger || !newScenario.response) {
      toast.error('Please fill in both trigger and response fields');
      return;
    }

    const scenario = {
      ...newScenario,
      id: editingId || Date.now().toString(),
      keywords: newScenario.keywords.length > 0 ? newScenario.keywords : newScenario.trigger.toLowerCase().split(' '),
      usageCount: 0
    };

    let updatedScenarios;
    if (editingId) {
      updatedScenarios = scenarios.map(s => s.id === editingId ? scenario : s);
      setEditingId(null);
    } else {
      updatedScenarios = [...scenarios, scenario];
    }

    setScenarios(updatedScenarios);
    localStorage.setItem('ai_training_scenarios', JSON.stringify(updatedScenarios));
    
    setNewScenario({
      trigger: '',
      response: '',
      category: 'general',
      priority: 'normal',
      keywords: []
    });
    setIsAddingScenario(false);
    
    toast.success(editingId ? 'Scenario updated successfully' : 'Scenario added successfully');
  };

  const deleteScenario = (id) => {
    const updatedScenarios = scenarios.filter(s => s.id !== id);
    setScenarios(updatedScenarios);
    localStorage.setItem('ai_training_scenarios', JSON.stringify(updatedScenarios));
    toast.success('Scenario deleted');
  };

  const editScenario = (scenario) => {
    setNewScenario(scenario);
    setEditingId(scenario.id);
    setIsAddingScenario(true);
  };

  const testAIResponse = () => {
    if (!testInput) {
      toast.error('Please enter a test message');
      return;
    }

    // Simple keyword matching for testing
    const inputLower = testInput.toLowerCase();
    let matchedScenario = null;
    let maxMatches = 0;

    scenarios.forEach(scenario => {
      let matches = 0;
      scenario.keywords.forEach(keyword => {
        if (inputLower.includes(keyword.toLowerCase())) {
          matches++;
        }
      });
      
      if (matches > maxMatches) {
        maxMatches = matches;
        matchedScenario = scenario;
      }
    });

    if (matchedScenario) {
      setTestResult({
        matched: true,
        scenario: matchedScenario,
        confidence: Math.min(100, (maxMatches / matchedScenario.keywords.length) * 100)
      });
    } else {
      setTestResult({
        matched: false,
        message: 'No matching scenario found. Consider adding a training scenario for this input.'
      });
    }
  };

  const getCategoryColor = (category) => {
    const cat = categories.find(c => c.value === category);
    return cat ? cat.color : 'gray';
  };

  const getPriorityColor = (priority) => {
    const pri = priorities.find(p => p.value === priority);
    return pri ? pri.color : 'gray';
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800 flex items-center">
          <Brain className="w-6 h-6 mr-2 text-purple-500" />
          AI Training Center
        </h2>
        <div className="flex space-x-2">
          <button
            onClick={() => setTestMode(!testMode)}
            className={`px-4 py-2 rounded-lg flex items-center transition-colors ${
              testMode ? 'bg-purple-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <PlayCircle className="w-4 h-4 mr-2" />
            Test Mode
          </button>
          <button
            onClick={() => setIsAddingScenario(true)}
            className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 flex items-center"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Scenario
          </button>
        </div>
      </div>

      {/* Test Mode */}
      <AnimatePresence>
        {testMode && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-6 p-4 bg-purple-50 rounded-lg border border-purple-200"
          >
            <h3 className="font-semibold text-purple-900 mb-3 flex items-center">
              <Mic className="w-4 h-4 mr-2" />
              Test AI Responses
            </h3>
            <div className="flex space-x-2">
              <input
                type="text"
                value={testInput}
                onChange={(e) => setTestInput(e.target.value)}
                placeholder="Enter a test message..."
                className="flex-1 px-3 py-2 border border-purple-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                onKeyPress={(e) => e.key === 'Enter' && testAIResponse()}
              />
              <button
                onClick={testAIResponse}
                className="px-4 py-2 bg-purple-500 text-white rounded-md hover:bg-purple-600"
              >
                Test
              </button>
            </div>
            
            {testResult && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4 p-3 bg-white rounded-md"
              >
                {testResult.matched ? (
                  <div>
                    <div className="flex items-center mb-2">
                      <CheckCircle className="w-5 h-5 text-green-500 mr-2" />
                      <span className="font-medium text-green-700">Match Found!</span>
                      <span className="ml-auto text-sm text-gray-500">
                        Confidence: {testResult.confidence.toFixed(0)}%
                      </span>
                    </div>
                    <div className="text-sm text-gray-600">
                      <p className="font-medium mb-1">Matched Scenario:</p>
                      <p className="italic mb-2">"{testResult.scenario.trigger}"</p>
                      <p className="font-medium mb-1">AI Response:</p>
                      <p className="bg-gray-50 p-2 rounded">{testResult.scenario.response}</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start">
                    <XCircle className="w-5 h-5 text-orange-500 mr-2 mt-0.5" />
                    <div>
                      <span className="font-medium text-orange-700">No Match</span>
                      <p className="text-sm text-gray-600 mt-1">{testResult.message}</p>
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add/Edit Scenario Form */}
      <AnimatePresence>
        {isAddingScenario && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-6 p-4 bg-gray-50 rounded-lg"
          >
            <h3 className="font-semibold text-gray-700 mb-4">
              {editingId ? 'Edit Training Scenario' : 'Add New Training Scenario'}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Trigger Phrase
                </label>
                <input
                  type="text"
                  value={newScenario.trigger}
                  onChange={(e) => setNewScenario({ ...newScenario, trigger: e.target.value })}
                  placeholder="What the patient might say..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  AI Response
                </label>
                <textarea
                  value={newScenario.response}
                  onChange={(e) => setNewScenario({ ...newScenario, response: e.target.value })}
                  placeholder="How the AI should respond..."
                  rows="3"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Category
                  </label>
                  <select
                    value={newScenario.category}
                    onChange={(e) => setNewScenario({ ...newScenario, category: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {categories.map(cat => (
                      <option key={cat.value} value={cat.value}>{cat.label}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Priority
                  </label>
                  <select
                    value={newScenario.priority}
                    onChange={(e) => setNewScenario({ ...newScenario, priority: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {priorities.map(pri => (
                      <option key={pri.value} value={pri.value}>{pri.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Keywords (comma-separated)
                </label>
                <input
                  type="text"
                  value={newScenario.keywords.join(', ')}
                  onChange={(e) => setNewScenario({ 
                    ...newScenario, 
                    keywords: e.target.value.split(',').map(k => k.trim()).filter(k => k) 
                  })}
                  placeholder="pain, emergency, urgent..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div className="flex justify-end space-x-2">
                <button
                  onClick={() => {
                    setIsAddingScenario(false);
                    setEditingId(null);
                    setNewScenario({
                      trigger: '',
                      response: '',
                      category: 'general',
                      priority: 'normal',
                      keywords: []
                    });
                  }}
                  className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300"
                >
                  Cancel
                </button>
                <button
                  onClick={saveScenario}
                  className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 flex items-center"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {editingId ? 'Update' : 'Save'}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Scenarios List */}
      <div className="space-y-3">
        {scenarios.map((scenario) => (
          <motion.div
            key={scenario.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="border rounded-lg p-4 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center space-x-2 mb-2">
                  <span className={`px-2 py-1 text-xs font-medium rounded-full bg-${getCategoryColor(scenario.category)}-100 text-${getCategoryColor(scenario.category)}-800`}>
                    {categories.find(c => c.value === scenario.category)?.label}
                  </span>
                  <span className={`px-2 py-1 text-xs font-medium rounded-full bg-${getPriorityColor(scenario.priority)}-100 text-${getPriorityColor(scenario.priority)}-800`}>
                    {priorities.find(p => p.value === scenario.priority)?.label}
                  </span>
                  <span className="text-xs text-gray-500">
                    Used {scenario.usageCount} times
                  </span>
                </div>
                
                <div className="mb-2">
                  <p className="font-medium text-gray-800 flex items-center">
                    <MessageSquare className="w-4 h-4 mr-1 text-gray-400" />
                    {scenario.trigger}
                  </p>
                  <p className="text-gray-600 mt-1 ml-5">{scenario.response}</p>
                </div>
                
                <div className="flex flex-wrap gap-1 ml-5">
                  {scenario.keywords.map((keyword, index) => (
                    <span key={index} className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded">
                      {keyword}
                    </span>
                  ))}
                </div>
              </div>
              
              <div className="flex space-x-1 ml-4">
                <button
                  onClick={() => editScenario(scenario)}
                  className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => deleteScenario(scenario.id)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {scenarios.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <Brain className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p>No training scenarios yet.</p>
          <p className="text-sm">Add scenarios to improve AI responses.</p>
        </div>
      )}
    </div>
  );
};

export default AITraining;