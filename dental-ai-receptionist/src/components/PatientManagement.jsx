import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, Plus, Edit, Trash2, Eye, Download, 
  User, Phone, Mail, Calendar, FileText, 
  Heart, AlertCircle, Pill, Activity,
  ChevronDown, ChevronUp, Filter, X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import apiService from '../services/apiService';
import { Users } from 'lucide-react';

const PatientManagement = () => {
  const [patients, setPatients] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    ageGroup: 'all',
    lastVisit: 'all',
    status: 'all'
  });
  const [newPatientData, setNewPatientData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    dateOfBirth: '',
    password: 'TempPass123!',
    address: {
      street: '',
      city: '',
      state: '',
      zipCode: ''
    }
  });

  // Remove sample data - we'll only use real MongoDB data

  useEffect(() => {
    fetchPatients();
  }, []); // Only fetch on mount, not on filter changes

  const fetchPatients = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiService.getPatients({ 
        page: 1, 
        limit: 100
      });
      
      // Transform the data from backend to match frontend expectations
      const transformedPatients = response.patients ? response.patients.map(patient => ({
        id: patient._id,
        name: patient.fullName || `${patient.firstName} ${patient.lastName}`,
        age: patient.age || calculateAge(patient.dateOfBirth),
        phone: patient.phone,
        email: patient.email,
        dateOfBirth: patient.dateOfBirth,
        address: patient.address ? 
          `${patient.address.street}, ${patient.address.city}, ${patient.address.state} ${patient.address.zipCode}` : 
          'No address on file',
        insurance: patient.insurance?.provider || 'No insurance',
        emergencyContact: patient.emergencyContact ? 
          `${patient.emergencyContact.name} - ${patient.emergencyContact.phone}` : 
          'No emergency contact',
        lastVisit: patient.lastVisit || patient.treatmentHistory?.[0]?.date,
        nextAppointment: patient.upcomingAppointments?.[0]?.date,
        status: patient.status || 'active',
        medicalHistory: {
          allergies: patient.allergies?.map(a => a.allergen || a) || [],
          medications: patient.currentMedications?.map(m => m.name || m) || [],
          conditions: patient.medicalHistory?.map(h => h.condition) || [],
          surgeries: [],
          familyHistory: []
        },
        dentalHistory: {
          lastCleaning: patient.treatmentHistory?.find(t => t.procedure?.toLowerCase().includes('cleaning'))?.date,
          lastXray: patient.treatmentHistory?.find(t => t.procedure?.toLowerCase().includes('xray') || t.procedure?.toLowerCase().includes('x-ray'))?.date,
          procedures: patient.treatmentHistory?.slice(0, 5).map(t => ({
            date: t.date,
            procedure: t.procedure,
            dentist: t.dentist?.name || 'Dr. Smith'
          })) || [],
          notes: patient.notes || ''
        },
        treatmentPlan: [],
        rawData: patient // Keep original data for updates
      })) : [];
      
      // Use the transformed patients from MongoDB
      setPatients(transformedPatients);
    } catch (error) {
      console.error('Failed to fetch patients:', error);
      setError('Failed to load patients. Please check your connection.');
      setPatients([]);
    } finally {
      setLoading(false);
    }
  };

  const calculateAge = (dateOfBirth) => {
    if (!dateOfBirth) return null;
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const filteredPatients = useMemo(() => {
    return patients.filter(patient => {
      const matchesSearch = patient.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           patient.phone.includes(searchTerm) ||
                           patient.email.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesFilters = 
        (filters.status === 'all' || patient.status === filters.status);
      
      return matchesSearch && matchesFilters;
    });
  }, [patients, searchTerm, filters.status]);

  const PatientCard = React.memo(({ patient }) => (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2 }}
      className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow p-6"
    >
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center">
          <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mr-3">
            <User className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-800">{patient.name}</h3>
            <p className="text-sm text-gray-500">Age: {patient.age}</p>
          </div>
        </div>
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
          patient.status === 'active' 
            ? 'bg-green-100 text-green-700'
            : 'bg-gray-100 text-gray-700'
        }`}>
          {patient.status}
        </span>
      </div>

      <div className="space-y-2 mb-4">
        <div className="flex items-center text-sm text-gray-600">
          <Phone className="w-4 h-4 mr-2" />
          {patient.phone}
        </div>
        <div className="flex items-center text-sm text-gray-600">
          <Mail className="w-4 h-4 mr-2" />
          {patient.email}
        </div>
        <div className="flex items-center text-sm text-gray-600">
          <Calendar className="w-4 h-4 mr-2" />
          Last visit: {new Date(patient.lastVisit).toLocaleDateString()}
        </div>
      </div>

      {patient.medicalHistory?.allergies?.length > 0 && (
        <div className="mb-4 p-2 bg-red-50 rounded-lg">
          <div className="flex items-center text-sm text-red-700">
            <AlertCircle className="w-4 h-4 mr-2" />
            Allergies: {patient.medicalHistory.allergies.join(', ')}
          </div>
        </div>
      )}

      <div className="flex space-x-2">
        <button
          onClick={() => {
            setSelectedPatient(patient);
            setShowDetailsModal(true);
          }}
          className="flex-1 px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center justify-center"
        >
          <Eye className="w-4 h-4 mr-1" />
          View Details
        </button>
        <button className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors">
          <Edit className="w-4 h-4" />
        </button>
      </div>
    </motion.div>
  ));

  const PatientDetailsModal = () => {
    const [activeTab, setActiveTab] = useState('overview');

    if (!selectedPatient) return null;

    return (
      <AnimatePresence>
        {showDetailsModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowDetailsModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="bg-blue-500 text-white p-6">
                <div className="flex justify-between items-center">
                  <div>
                    <h2 className="text-2xl font-bold">{selectedPatient.name}</h2>
                    <p className="text-blue-100">Patient ID: #{selectedPatient.id}</p>
                  </div>
                  <button
                    onClick={() => setShowDetailsModal(false)}
                    className="p-2 hover:bg-blue-600 rounded-lg transition-colors"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>

              {/* Tabs */}
              <div className="border-b border-gray-200">
                <div className="flex space-x-4 px-6">
                  {['overview', 'medical', 'dental', 'appointments', 'documents'].map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`py-3 px-2 capitalize border-b-2 transition-colors ${
                        activeTab === tab
                          ? 'border-blue-500 text-blue-600'
                          : 'border-transparent text-gray-600 hover:text-gray-800'
                      }`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tab Content */}
              <div className="p-6 overflow-y-auto max-h-[500px]">
                {activeTab === 'overview' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-gray-500">Date of Birth</label>
                        <p className="text-gray-800">{selectedPatient.dateOfBirth}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">Age</label>
                        <p className="text-gray-800">{selectedPatient.age} years</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">Phone</label>
                        <p className="text-gray-800">{selectedPatient.phone}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">Email</label>
                        <p className="text-gray-800">{selectedPatient.email}</p>
                      </div>
                      <div className="col-span-2">
                        <label className="text-sm font-medium text-gray-500">Address</label>
                        <p className="text-gray-800">{selectedPatient.address}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">Insurance</label>
                        <p className="text-gray-800">{selectedPatient.insurance}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">Emergency Contact</label>
                        <p className="text-gray-800">{selectedPatient.emergencyContact}</p>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'medical' && selectedPatient.medicalHistory && (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center">
                        <AlertCircle className="w-5 h-5 mr-2 text-red-500" />
                        Allergies
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {selectedPatient.medicalHistory.allergies.map((allergy, index) => (
                          <span key={index} className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm">
                            {allergy}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center">
                        <Pill className="w-5 h-5 mr-2 text-blue-500" />
                        Current Medications
                      </h3>
                      <ul className="space-y-2">
                        {selectedPatient.medicalHistory.medications.map((med, index) => (
                          <li key={index} className="flex items-center text-gray-700">
                            <span className="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>
                            {med}
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div>
                      <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center">
                        <Heart className="w-5 h-5 mr-2 text-pink-500" />
                        Medical Conditions
                      </h3>
                      <ul className="space-y-2">
                        {selectedPatient.medicalHistory.conditions.map((condition, index) => (
                          <li key={index} className="flex items-center text-gray-700">
                            <span className="w-2 h-2 bg-pink-500 rounded-full mr-2"></span>
                            {condition}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}

                {activeTab === 'dental' && selectedPatient.dentalHistory && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                      <div>
                        <label className="text-sm font-medium text-gray-500">Last Cleaning</label>
                        <p className="text-gray-800">{selectedPatient.dentalHistory.lastCleaning}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">Last X-Ray</label>
                        <p className="text-gray-800">{selectedPatient.dentalHistory.lastXray}</p>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-lg font-semibold text-gray-800 mb-3">Recent Procedures</h3>
                      <div className="space-y-3">
                        {selectedPatient.dentalHistory.procedures.map((proc, index) => (
                          <div key={index} className="border-l-4 border-blue-500 pl-4 py-2">
                            <p className="font-medium text-gray-800">{proc.procedure}</p>
                            <p className="text-sm text-gray-600">
                              {proc.date} • {proc.dentist}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {selectedPatient.treatmentPlan?.length > 0 && (
                      <div>
                        <h3 className="text-lg font-semibold text-gray-800 mb-3">Treatment Plan</h3>
                        <div className="space-y-2">
                          {selectedPatient.treatmentPlan.map((treatment, index) => (
                            <div key={index} className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                              <div>
                                <p className="font-medium text-gray-800">{treatment.procedure}</p>
                                {treatment.date && (
                                  <p className="text-sm text-gray-600">Scheduled: {treatment.date}</p>
                                )}
                              </div>
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                treatment.status === 'scheduled'
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-yellow-100 text-yellow-700'
                              }`}>
                                {treatment.status}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {selectedPatient.dentalHistory.notes && (
                      <div className="p-4 bg-yellow-50 rounded-lg">
                        <h4 className="font-medium text-gray-800 mb-2">Clinical Notes</h4>
                        <p className="text-sm text-gray-700">{selectedPatient.dentalHistory.notes}</p>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'appointments' && (
                  <div className="space-y-4">
                    <div className="p-4 bg-blue-50 rounded-lg">
                      <h3 className="font-medium text-gray-800 mb-2">Next Appointment</h3>
                      <p className="text-gray-700">{selectedPatient.nextAppointment || 'No upcoming appointments'}</p>
                    </div>
                    <button className="w-full py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors">
                      Schedule New Appointment
                    </button>
                  </div>
                )}

                {activeTab === 'documents' && (
                  <div className="space-y-4">
                    <button className="w-full py-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-gray-400 transition-colors">
                      <Plus className="w-5 h-5 mx-auto mb-1 text-gray-400" />
                      <span className="text-gray-600">Upload Document</span>
                    </button>
                    <p className="text-center text-gray-500">No documents uploaded yet</p>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="border-t border-gray-200 p-4 flex justify-end space-x-3">
                <button className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors">
                  Export Record
                </button>
                <button className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors">
                  Edit Patient
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    );
  };

  const handleAddPatient = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    try {
      const response = await apiService.createPatient(newPatientData);
      console.log('Patient created:', response);
      
      // Refresh patients list
      await fetchPatients();
      
      // Close modal and reset form
      setShowAddModal(false);
      setNewPatientData({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        dateOfBirth: '',
        password: 'TempPass123!',
        address: {
          street: '',
          city: '',
          state: '',
          zipCode: ''
        }
      });
      
      alert('Patient added successfully!');
    } catch (error) {
      console.error('Failed to add patient:', error);
      setError(error.message || 'Failed to add patient. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800">Patient Management</h1>
        <p className="text-gray-600 mt-2">Manage patient records and medical history</p>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-lg shadow-md p-4 mb-6">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search patients by name, phone, or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex gap-2">
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
            <button
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center"
            >
              <Plus className="w-5 h-5 mr-2" />
              Add Patient
            </button>
          </div>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow-md p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Patients</p>
              <p className="text-2xl font-bold text-gray-800">{patients.length}</p>
            </div>
            <Users className="w-8 h-8 text-blue-500" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-md p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Active Patients</p>
              <p className="text-2xl font-bold text-gray-800">
                {patients.filter(p => p.status === 'active').length}
              </p>
            </div>
            <Activity className="w-8 h-8 text-green-500" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-md p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">With Allergies</p>
              <p className="text-2xl font-bold text-gray-800">
                {patients.filter(p => p.medicalHistory?.allergies?.length > 0).length}
              </p>
            </div>
            <AlertCircle className="w-8 h-8 text-red-500" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-md p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">New This Month</p>
              <p className="text-2xl font-bold text-gray-800">7</p>
            </div>
            <Calendar className="w-8 h-8 text-purple-500" />
          </div>
        </div>
      </div>

      {/* Patient Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl shadow-md p-6 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-3"></div>
              <div className="h-3 bg-gray-200 rounded w-1/2 mb-2"></div>
              <div className="h-3 bg-gray-200 rounded w-2/3"></div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPatients.map((patient) => (
            <PatientCard key={`patient-${patient.id}`} patient={patient} />
          ))}
        </div>
      )}

      {/* Patient Details Modal */}
      <PatientDetailsModal />

      {/* Add Patient Modal */}
      <AnimatePresence>
        {showAddModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowAddModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-lg max-w-2xl w-full p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-2xl font-bold text-gray-800 mb-4">Add New Patient</h2>
              <form className="space-y-4" onSubmit={handleAddPatient}>
                <div className="grid grid-cols-2 gap-4">
                  <input
                    type="text"
                    placeholder="First Name"
                    value={newPatientData.firstName}
                    onChange={(e) => setNewPatientData({...newPatientData, firstName: e.target.value})}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                  <input
                    type="text"
                    placeholder="Last Name"
                    value={newPatientData.lastName}
                    onChange={(e) => setNewPatientData({...newPatientData, lastName: e.target.value})}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <input
                  type="email"
                  placeholder="Email"
                  value={newPatientData.email}
                  onChange={(e) => setNewPatientData({...newPatientData, email: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
                <input
                  type="tel"
                  placeholder="Phone (e.g., 555-123-4567)"
                  value={newPatientData.phone}
                  onChange={(e) => setNewPatientData({...newPatientData, phone: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
                <input
                  type="date"
                  placeholder="Date of Birth"
                  value={newPatientData.dateOfBirth}
                  onChange={(e) => setNewPatientData({...newPatientData, dateOfBirth: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
                <div className="grid grid-cols-2 gap-4">
                  <input
                    type="text"
                    placeholder="Street Address"
                    value={newPatientData.address.street}
                    onChange={(e) => setNewPatientData({
                      ...newPatientData, 
                      address: {...newPatientData.address, street: e.target.value}
                    })}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <input
                    type="text"
                    placeholder="City"
                    value={newPatientData.address.city}
                    onChange={(e) => setNewPatientData({
                      ...newPatientData, 
                      address: {...newPatientData.address, city: e.target.value}
                    })}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <input
                    type="text"
                    placeholder="State"
                    value={newPatientData.address.state}
                    onChange={(e) => setNewPatientData({
                      ...newPatientData, 
                      address: {...newPatientData.address, state: e.target.value}
                    })}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <input
                    type="text"
                    placeholder="ZIP Code"
                    value={newPatientData.address.zipCode}
                    onChange={(e) => setNewPatientData({
                      ...newPatientData, 
                      address: {...newPatientData.address, zipCode: e.target.value}
                    })}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                {error && (
                  <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">
                    {error}
                  </div>
                )}
                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddModal(false);
                      setError(null);
                      setNewPatientData({
                        firstName: '',
                        lastName: '',
                        email: '',
                        phone: '',
                        dateOfBirth: '',
                        password: 'TempPass123!',
                        address: {
                          street: '',
                          city: '',
                          state: '',
                          zipCode: ''
                        }
                      });
                    }}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? 'Adding...' : 'Add Patient'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default PatientManagement;
