import React, { useState } from 'react';
import { AlertCircle, Info, ChevronDown, ChevronUp, Clock, Phone } from 'lucide-react';
import { dentalTraumaGuide } from '../services/aiAgent';

const TraumaGuide = () => {
  const [expandedScenario, setExpandedScenario] = useState(null);
  const [selectedScenario, setSelectedScenario] = useState(null);

  const toggleScenario = (scenarioId) => {
    setExpandedScenario(expandedScenario === scenarioId ? null : scenarioId);
  };

  const getUrgencyColor = (urgency) => {
    if (urgency.includes('EMERGENCY')) return 'bg-red-100 text-red-800 border-red-300';
    if (urgency.includes('URGENT')) return 'bg-orange-100 text-orange-800 border-orange-300';
    return 'bg-yellow-100 text-yellow-800 border-yellow-300';
  };

  const getUrgencyIcon = (urgency) => {
    if (urgency.includes('EMERGENCY')) {
      return <AlertCircle className="w-5 h-5 text-red-600 animate-pulse" />;
    }
    return <Clock className="w-5 h-5 text-orange-600" />;
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center">
        <AlertCircle className="w-6 h-6 mr-2 text-red-500" />
        Dental Trauma Response Guide
      </h2>

      <div className="mb-4 p-4 bg-blue-50 rounded-lg">
        <p className="text-sm text-blue-800">
          <Info className="w-4 h-4 inline mr-1" />
          This guide helps the AI receptionist respond appropriately to dental emergencies.
          Click on each scenario to view detailed instructions.
        </p>
      </div>

      <div className="space-y-4">
        {dentalTraumaGuide.scenarios.map((scenario) => (
          <div
            key={scenario.id}
            className="border rounded-lg overflow-hidden transition-all duration-200"
          >
            {/* Header */}
            <button
              onClick={() => toggleScenario(scenario.id)}
              className="w-full px-4 py-3 bg-gray-50 hover:bg-gray-100 flex items-center justify-between text-left"
            >
              <div className="flex items-center space-x-3">
                {getUrgencyIcon(scenario.instructions.urgency)}
                <div>
                  <h3 className="font-semibold text-gray-800">{scenario.condition}</h3>
                  <span className={`inline-block mt-1 px-2 py-1 text-xs font-medium rounded-full ${getUrgencyColor(scenario.instructions.urgency)}`}>
                    {scenario.instructions.urgency}
                  </span>
                </div>
              </div>
              {expandedScenario === scenario.id ? (
                <ChevronUp className="w-5 h-5 text-gray-500" />
              ) : (
                <ChevronDown className="w-5 h-5 text-gray-500" />
              )}
            </button>

            {/* Expanded Content */}
            {expandedScenario === scenario.id && (
              <div className="p-4 border-t bg-white">
                {/* Assessment Questions */}
                <div className="mb-4">
                  <h4 className="font-semibold text-gray-700 mb-2">Assessment Questions:</h4>
                  <ul className="space-y-1">
                    {scenario.questions.map((question, index) => (
                      <li key={index} className="flex items-start">
                        <span className="text-blue-500 mr-2">•</span>
                        <span className="text-gray-600 text-sm">{question}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Immediate Instructions */}
                <div className="mb-4">
                  <h4 className="font-semibold text-gray-700 mb-2">Immediate Instructions:</h4>
                  <ol className="space-y-2">
                    {scenario.instructions.immediate.map((instruction, index) => (
                      <li key={index} className="flex items-start">
                        <span className="font-medium text-gray-500 mr-2">{index + 1}.</span>
                        <span className="text-gray-600 text-sm">{instruction}</span>
                      </li>
                    ))}
                  </ol>
                </div>

                {/* Action Buttons */}
                <div className="flex space-x-3 pt-3 border-t">
                  <button className="flex items-center px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors">
                    <Phone className="w-4 h-4 mr-2" />
                    Emergency Line
                  </button>
                  <button
                    onClick={() => setSelectedScenario(scenario)}
                    className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
                  >
                    Use This Response
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Quick Reference Card */}
      <div className="mt-6 p-4 bg-gray-50 rounded-lg">
        <h3 className="font-semibold text-gray-700 mb-3">Quick Reference</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <div>
            <span className="font-medium text-gray-600">Emergency Hotline:</span>
            <span className="ml-2 text-gray-800">1-800-DENTAL-911</span>
          </div>
          <div>
            <span className="font-medium text-gray-600">After Hours:</span>
            <span className="ml-2 text-gray-800">Available 24/7</span>
          </div>
          <div>
            <span className="font-medium text-gray-600">Nearest Hospital:</span>
            <span className="ml-2 text-gray-800">City General (5 miles)</span>
          </div>
          <div>
            <span className="font-medium text-gray-600">Response Time:</span>
            <span className="ml-2 text-gray-800">{"<"} 30 seconds</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TraumaGuide;