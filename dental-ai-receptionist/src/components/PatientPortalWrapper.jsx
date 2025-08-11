import React, { useState, useEffect } from 'react';
import PatientAuth from './PatientAuth';
import PatientPortal from './PatientPortal';
import apiService from '../services/apiService';

const PatientPortalWrapper = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [patientData, setPatientData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuthentication();
  }, []);

  const checkAuthentication = () => {
    const token = localStorage.getItem('authToken');
    const storedPatientData = localStorage.getItem('patientData');

    if (token && storedPatientData) {
      apiService.setAuthToken(token);
      setPatientData(JSON.parse(storedPatientData));
      setIsAuthenticated(true);
    }
    setLoading(false);
  };

  const handleAuthenticated = (patient) => {
    setPatientData(patient);
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    apiService.logout();
    setIsAuthenticated(false);
    setPatientData(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return isAuthenticated ? (
    <div>
      <PatientPortal patientData={patientData} onLogout={handleLogout} />
    </div>
  ) : (
    <PatientAuth onAuthenticated={handleAuthenticated} />
  );
};

export default PatientPortalWrapper;