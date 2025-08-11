import React, { useState } from 'react';
import { 
  Activity, AlertCircle, CheckCircle, ChevronRight, Info, 
  MessageSquare, Search, Shield, ThermometerSun, User,
  Zap, Brain, FileText, Phone, Calendar, MapPin, Clock,
  ArrowRight, X, Plus, Minus, HelpCircle
} from 'lucide-react';

const SymptomChecker = () => {
  const [currentStep, setCurrentStep] = useState('initial');
  const [selectedSymptoms, setSelectedSymptoms] = useState([]);
  const [symptomDuration, setSymptomDuration] = useState('');
  const [painLevel, setPainLevel] = useState(0);
  const [selectedArea, setSelectedArea] = useState('');
  const [additionalInfo, setAdditionalInfo] = useState('');
  const [assessmentResult, setAssessmentResult] = useState(null);
  const [showEmergencyInfo, setShowEmergencyInfo] = useState(false);
  const [patientInfo, setPatientInfo] = useState({
    age: '',
    medicalConditions: []
  });

  const dentalSymptoms = {
    pain: {
      label: 'Pain',
      icon: Zap,
      options: [
        'Sharp pain when biting',
        'Constant throbbing pain',
        'Sensitivity to hot/cold',
        'Pain when chewing',
        'Radiating jaw pain',
        'Night pain'
      ]
    },
    swelling: {
      label: 'Swelling',
      icon: AlertCircle,
      options: [
        'Swollen gums',
        'Facial swelling',
        'Swollen jaw',
        'Abscess/bump on gums',
        'Swollen lymph nodes'
      ]
    },
    bleeding: {
      label: 'Bleeding',
      icon: Activity,
      options: [
        'Bleeding gums when brushing',
        'Spontaneous gum bleeding',
        'Blood when flossing',
        'Bleeding after dental work',
        'Persistent bleeding'
      ]
    },
    appearance: {
      label: 'Appearance',
      icon: Eye,
      options: [
        'Discolored tooth',
        'Broken/chipped tooth',
        'Loose tooth',
        'White spots on teeth',
        'Red or purple gums',
        'Receding gums'
      ]
    },
    other: {
      label: 'Other',
      icon: HelpCircle,
      options: [
        'Bad breath',
        'Bad taste in mouth',
        'Difficulty opening mouth',
        'Jaw clicking/popping',
        'Dry mouth',
        'Burning sensation'
      ]
    }
  };

  const medicalConditions = [
    'Diabetes',
    'Heart Disease',
    'High Blood Pressure',
    'Pregnancy',
    'Immune Disorders',
    'Blood Disorders',
    'Taking Blood Thinners',
    'Recent Surgery',
    'Cancer Treatment',
    'None'
  ];

  const urgencyLevels = {
    emergency: {
      level: 'Emergency',
      color: 'red',
      action: 'Seek immediate care',
      timeframe: 'Immediately',
      description: 'This requires immediate attention. Visit emergency dental care or ER.'
    },
    urgent: {
      level: 'Urgent',
      color: 'orange',
      action: 'Schedule today',
      timeframe: 'Within 24 hours',
      description: 'Schedule an appointment as soon as possible, preferably today.'
    },
    soon: {
      level: 'Soon',
      color: 'yellow',
      action: 'Schedule this week',
      timeframe: 'Within 2-3 days',
      description: 'Schedule an appointment within the next few days.'
    },
    routine: {
      level: 'Routine',
      color: 'green',
      action: 'Regular appointment',
      timeframe: 'Within 1-2 weeks',
      description: 'Schedule a regular appointment at your convenience.'
    }
  };

  const analyzeSymptoms = () => {
    let urgency = 'routine';
    let possibleConditions = [];
    let recommendations = [];

    // Emergency symptoms
    if (selectedSymptoms.includes('Facial swelling') || 
        selectedSymptoms.includes('Difficulty opening mouth') ||
        (selectedSymptoms.includes('Constant throbbing pain') && painLevel >= 8)) {
      urgency = 'emergency';
      possibleConditions.push('Dental abscess', 'Severe infection');
    }

    // Urgent symptoms
    if (selectedSymptoms.includes('Broken/chipped tooth') ||
        selectedSymptoms.includes('Persistent bleeding') ||
        selectedSymptoms.includes('Abscess/bump on gums') ||
        painLevel >= 7) {
      urgency = urgency === 'routine' ? 'urgent' : urgency;
      possibleConditions.push('Dental trauma', 'Infection', 'Acute pulpitis');
    }

    // Soon symptoms
    if (selectedSymptoms.includes('Sensitivity to hot/cold') ||
        selectedSymptoms.includes('Bleeding gums when brushing') ||
        selectedSymptoms.includes('Loose tooth')) {
      urgency = urgency === 'routine' ? 'soon' : urgency;
      possibleConditions.push('Cavity', 'Gingivitis', 'Periodontal disease');
    }

    // Generate recommendations based on symptoms
    if (selectedSymptoms.includes('Sharp pain when biting')) {
      recommendations.push('Avoid chewing on affected side');
    }
    if (selectedSymptoms.includes('Sensitivity to hot/cold')) {
      recommendations.push('Use toothpaste for sensitive teeth');
      recommendations.push('Avoid extreme temperatures');
    }
    if (selectedSymptoms.includes('Bleeding gums when brushing')) {
      recommendations.push('Continue gentle brushing and flossing');
      recommendations.push('Use antiseptic mouthwash');
    }
    if (selectedSymptoms.includes('Swollen gums')) {
      recommendations.push('Rinse with warm salt water');
      recommendations.push('Apply cold compress externally');
    }

    // Pain management recommendations
    if (painLevel >= 5) {
      recommendations.push('Take over-the-counter pain relievers as directed');
      recommendations.push('Apply cold compress for 15-20 minutes');
    }

    setAssessmentResult({
      urgency: urgencyLevels[urgency],
      possibleConditions: [...new Set(possibleConditions)],
      recommendations: [...new Set(recommendations)],
      symptoms: selectedSymptoms,
      painLevel,
      duration: symptomDuration
    });

    setCurrentStep('results');
  };

  const handleSymptomToggle = (symptom) => {
    if (selectedSymptoms.includes(symptom)) {
      setSelectedSymptoms(selectedSymptoms.filter(s => s !== symptom));
    } else {
      setSelectedSymptoms([...selectedSymptoms, symptom]);
    }
  };

  const handleMedicalConditionToggle = (condition) => {
    if (patientInfo.medicalConditions.includes(condition)) {
      setPatientInfo({
        ...patientInfo,
        medicalConditions: patientInfo.medicalConditions.filter(c => c !== condition)
      });
    } else {
      if (condition === 'None') {
        setPatientInfo({
          ...patientInfo,
          medicalConditions: ['None']
        });
      } else {
        setPatientInfo({
          ...patientInfo,
          medicalConditions: [...patientInfo.medicalConditions.filter(c => c !== 'None'), condition]
        });
      }
    }
  };

  const resetAssessment = () => {
    setCurrentStep('initial');
    setSelectedSymptoms([]);
    setSymptomDuration('');
    setPainLevel(0);
    setSelectedArea('');
    setAdditionalInfo('');
    setAssessmentResult(null);
    setPatientInfo({ age: '', medicalConditions: [] });
  };

  const renderInitialStep = () => (
    <div className="space-y-6">
      <div className="text-center">
        <Brain className="w-16 h-16 text-blue-500 mx-auto mb-4" />
        <h2 className="text-2xl font-bold mb-2">AI Symptom Checker</h2>
        <p className="text-gray-600">Get instant guidance on your dental symptoms</p>
      </div>

      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex items-start">
          <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5 mr-2 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-yellow-800">Important Notice</p>
            <p className="text-sm text-yellow-700 mt-1">
              This tool provides guidance only and does not replace professional dental diagnosis. 
              Always consult with a dentist for proper evaluation and treatment.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-start">
          <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 mr-2 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-red-800">Emergency Symptoms</p>
            <p className="text-sm text-red-700 mt-1">
              If you have facial swelling, difficulty breathing/swallowing, or severe uncontrolled bleeding, 
              seek emergency care immediately.
            </p>
            <button
              onClick={() => setShowEmergencyInfo(!showEmergencyInfo)}
              className="text-red-600 text-sm font-medium mt-2 hover:text-red-700"
            >
              View Emergency Contacts →
            </button>
          </div>
        </div>
      </div>

      {showEmergencyInfo && (
        <div className="bg-red-100 rounded-lg p-4 space-y-2">
          <div className="flex items-center">
            <Phone className="w-4 h-4 text-red-700 mr-2" />
            <span className="text-sm font-medium text-red-900">Emergency: 911</span>
          </div>
          <div className="flex items-center">
            <MapPin className="w-4 h-4 text-red-700 mr-2" />
            <span className="text-sm text-red-800">Nearest ER: Springfield General Hospital</span>
          </div>
          <div className="flex items-center">
            <Clock className="w-4 h-4 text-red-700 mr-2" />
            <span className="text-sm text-red-800">24/7 Dental Emergency: (555) 123-4567</span>
          </div>
        </div>
      )}

      <button
        onClick={() => setCurrentStep('symptoms')}
        className="w-full py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 font-medium flex items-center justify-center"
      >
        Start Symptom Assessment
        <ArrowRight className="w-5 h-5 ml-2" />
      </button>
    </div>
  );

  const renderSymptomsStep = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Select Your Symptoms</h2>
        <button
          onClick={() => setCurrentStep('initial')}
          className="text-gray-500 hover:text-gray-700"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      <div className="space-y-4">
        {Object.entries(dentalSymptoms).map(([category, data]) => (
          <div key={category} className="border rounded-lg p-4">
            <div className="flex items-center mb-3">
              <data.icon className="w-5 h-5 text-blue-500 mr-2" />
              <h3 className="font-semibold">{data.label}</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {data.options.map(symptom => (
                <label
                  key={symptom}
                  className="flex items-center p-2 rounded hover:bg-gray-50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedSymptoms.includes(symptom)}
                    onChange={() => handleSymptomToggle(symptom)}
                    className="mr-2"
                  />
                  <span className="text-sm">{symptom}</span>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-3">
        <button
          onClick={() => setCurrentStep('initial')}
          className="flex-1 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
        >
          Back
        </button>
        <button
          onClick={() => setCurrentStep('details')}
          disabled={selectedSymptoms.length === 0}
          className={`flex-1 py-2 rounded-lg font-medium ${
            selectedSymptoms.length > 0
              ? 'bg-blue-500 text-white hover:bg-blue-600'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
        >
          Continue ({selectedSymptoms.length} selected)
        </button>
      </div>
    </div>
  );

  const renderDetailsStep = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Additional Details</h2>
        <button
          onClick={resetAssessment}
          className="text-gray-500 hover:text-gray-700"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">How long have you had these symptoms?</label>
          <select
            value={symptomDuration}
            onChange={(e) => setSymptomDuration(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg"
          >
            <option value="">Select duration</option>
            <option value="today">Started today</option>
            <option value="1-2days">1-2 days</option>
            <option value="3-7days">3-7 days</option>
            <option value="1-2weeks">1-2 weeks</option>
            <option value="2-4weeks">2-4 weeks</option>
            <option value="month+">More than a month</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">
            Pain Level (0 = No pain, 10 = Severe pain)
          </label>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setPainLevel(Math.max(0, painLevel - 1))}
              className="p-1 bg-gray-200 rounded hover:bg-gray-300"
            >
              <Minus className="w-4 h-4" />
            </button>
            <div className="flex-1">
              <div className="relative">
                <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all ${
                      painLevel <= 3 ? 'bg-green-500' :
                      painLevel <= 6 ? 'bg-yellow-500' :
                      painLevel <= 8 ? 'bg-orange-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${painLevel * 10}%` }}
                  />
                </div>
                <div className="text-center mt-2">
                  <span className="text-2xl font-bold">{painLevel}</span>
                  <span className="text-sm text-gray-600 ml-2">
                    {painLevel === 0 ? 'No pain' :
                     painLevel <= 3 ? 'Mild' :
                     painLevel <= 6 ? 'Moderate' :
                     painLevel <= 8 ? 'Severe' : 'Extreme'}
                  </span>
                </div>
              </div>
            </div>
            <button
              onClick={() => setPainLevel(Math.min(10, painLevel + 1))}
              className="p-1 bg-gray-200 rounded hover:bg-gray-300"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Which area is affected?</label>
          <select
            value={selectedArea}
            onChange={(e) => setSelectedArea(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg"
          >
            <option value="">Select area</option>
            <option value="upper-front">Upper front teeth</option>
            <option value="upper-back">Upper back teeth</option>
            <option value="lower-front">Lower front teeth</option>
            <option value="lower-back">Lower back teeth</option>
            <option value="multiple">Multiple areas</option>
            <option value="entire">Entire mouth</option>
            <option value="jaw">Jaw area</option>
            <option value="gums">Gums only</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Your Age</label>
          <input
            type="number"
            value={patientInfo.age}
            onChange={(e) => setPatientInfo({...patientInfo, age: e.target.value})}
            placeholder="Enter your age"
            className="w-full px-3 py-2 border rounded-lg"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Any relevant medical conditions?</label>
          <div className="grid grid-cols-2 gap-2">
            {medicalConditions.map(condition => (
              <label
                key={condition}
                className="flex items-center p-2 rounded hover:bg-gray-50 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={patientInfo.medicalConditions.includes(condition)}
                  onChange={() => handleMedicalConditionToggle(condition)}
                  className="mr-2"
                />
                <span className="text-sm">{condition}</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Additional information (optional)</label>
          <textarea
            value={additionalInfo}
            onChange={(e) => setAdditionalInfo(e.target.value)}
            placeholder="Any other details about your symptoms..."
            className="w-full px-3 py-2 border rounded-lg"
            rows="3"
          />
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={() => setCurrentStep('symptoms')}
          className="flex-1 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
        >
          Back
        </button>
        <button
          onClick={analyzeSymptoms}
          className="flex-1 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 font-medium"
        >
          Get Assessment
        </button>
      </div>
    </div>
  );

  const renderResults = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Assessment Results</h2>
        <button
          onClick={resetAssessment}
          className="text-gray-500 hover:text-gray-700"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      {assessmentResult && (
        <>
          <div className={`border-2 rounded-lg p-6 ${
            assessmentResult.urgency.color === 'red' ? 'border-red-500 bg-red-50' :
            assessmentResult.urgency.color === 'orange' ? 'border-orange-500 bg-orange-50' :
            assessmentResult.urgency.color === 'yellow' ? 'border-yellow-500 bg-yellow-50' :
            'border-green-500 bg-green-50'
          }`}>
            <div className="flex items-start">
              <AlertCircle className={`w-6 h-6 mt-1 mr-3 flex-shrink-0 ${
                assessmentResult.urgency.color === 'red' ? 'text-red-600' :
                assessmentResult.urgency.color === 'orange' ? 'text-orange-600' :
                assessmentResult.urgency.color === 'yellow' ? 'text-yellow-600' :
                'text-green-600'
              }`} />
              <div className="flex-1">
                <h3 className="text-lg font-bold mb-1">
                  {assessmentResult.urgency.level} - {assessmentResult.urgency.action}
                </h3>
                <p className="text-sm mb-2">{assessmentResult.urgency.description}</p>
                <p className="text-xs font-medium">
                  Recommended timeframe: {assessmentResult.urgency.timeframe}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="font-semibold mb-3 flex items-center">
              <Info className="w-5 h-5 text-blue-500 mr-2" />
              Possible Conditions
            </h3>
            {assessmentResult.possibleConditions.length > 0 ? (
              <ul className="space-y-2">
                {assessmentResult.possibleConditions.map((condition, index) => (
                  <li key={index} className="flex items-center text-sm">
                    <ChevronRight className="w-4 h-4 text-gray-400 mr-2" />
                    {condition}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-600">
                Based on your symptoms, schedule a routine dental check-up for proper evaluation.
              </p>
            )}
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="font-semibold mb-3 flex items-center">
              <Shield className="w-5 h-5 text-green-500 mr-2" />
              Recommended Care
            </h3>
            {assessmentResult.recommendations.length > 0 ? (
              <ul className="space-y-2">
                {assessmentResult.recommendations.map((rec, index) => (
                  <li key={index} className="flex items-start text-sm">
                    <CheckCircle className="w-4 h-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-600">
                Maintain regular oral hygiene and schedule a dental appointment.
              </p>
            )}
          </div>

          <div className="bg-blue-50 rounded-lg p-6">
            <h3 className="font-semibold mb-3">Next Steps</h3>
            <div className="space-y-3">
              <button className="w-full py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 font-medium flex items-center justify-center">
                <Calendar className="w-5 h-5 mr-2" />
                Schedule Appointment
              </button>
              <button className="w-full py-3 bg-white text-blue-600 border border-blue-300 rounded-lg hover:bg-blue-50 font-medium flex items-center justify-center">
                <Phone className="w-5 h-5 mr-2" />
                Call Now: (555) 123-4567
              </button>
              <button className="w-full py-3 bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium flex items-center justify-center">
                <FileText className="w-5 h-5 mr-2" />
                Save Assessment Report
              </button>
            </div>
          </div>

          <div className="text-center">
            <button
              onClick={resetAssessment}
              className="text-blue-600 hover:text-blue-700 text-sm font-medium"
            >
              Start New Assessment
            </button>
          </div>
        </>
      )}
    </div>
  );

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 max-w-4xl mx-auto">
      {currentStep === 'initial' && renderInitialStep()}
      {currentStep === 'symptoms' && renderSymptomsStep()}
      {currentStep === 'details' && renderDetailsStep()}
      {currentStep === 'results' && renderResults()}
    </div>
  );
};

export default SymptomChecker;