import React, { useState, useEffect } from 'react';
import { 
  User, Calendar, FileText, CreditCard, Bell, MessageSquare, 
  Clock, Download, Upload, AlertCircle, CheckCircle, XCircle,
  ChevronRight, Settings, Shield, Heart, Pill, Phone, Mail,
  MapPin, Edit2, Save, X, Plus, Trash2, Eye, EyeOff
} from 'lucide-react';

const PatientPortal = () => {
  const [activeSection, setActiveSection] = useState('dashboard');
  const [patientData, setPatientData] = useState({
    id: 'PT001',
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.doe@email.com',
    phone: '(555) 123-4567',
    dateOfBirth: '1985-03-15',
    address: '123 Main St, Springfield, IL 62701',
    insurance: {
      provider: 'Delta Dental',
      policyNumber: 'DD123456789',
      groupNumber: 'GRP001'
    },
    emergencyContact: {
      name: 'Jane Doe',
      relationship: 'Spouse',
      phone: '(555) 987-6543'
    }
  });

  const [appointments, setAppointments] = useState([
    {
      id: 1,
      date: '2025-01-15',
      time: '10:00 AM',
      type: 'Regular Checkup',
      doctor: 'Dr. Smith',
      status: 'confirmed'
    },
    {
      id: 2,
      date: '2025-02-20',
      time: '2:30 PM',
      type: 'Teeth Cleaning',
      doctor: 'Dr. Johnson',
      status: 'scheduled'
    }
  ]);

  const [medicalHistory, setMedicalHistory] = useState([
    {
      id: 1,
      date: '2024-12-01',
      procedure: 'Cavity Filling',
      doctor: 'Dr. Smith',
      notes: 'Upper left molar, composite filling'
    },
    {
      id: 2,
      date: '2024-09-15',
      procedure: 'Regular Checkup',
      doctor: 'Dr. Johnson',
      notes: 'No issues found, recommended flossing more regularly'
    }
  ]);

  const [bills, setBills] = useState([
    {
      id: 1,
      date: '2024-12-01',
      description: 'Cavity Filling',
      amount: 250.00,
      insuranceCovered: 200.00,
      patientOwes: 50.00,
      status: 'paid'
    },
    {
      id: 2,
      date: '2024-09-15',
      description: 'Regular Checkup',
      amount: 150.00,
      insuranceCovered: 150.00,
      patientOwes: 0.00,
      status: 'paid'
    }
  ]);

  const [prescriptions, setPrescriptions] = useState([
    {
      id: 1,
      medication: 'Amoxicillin 500mg',
      prescribedDate: '2024-12-01',
      doctor: 'Dr. Smith',
      dosage: 'Take 1 capsule 3 times daily for 7 days',
      refills: 0,
      status: 'active'
    }
  ]);

  const [documents, setDocuments] = useState([
    {
      id: 1,
      name: 'X-Ray Results - December 2024',
      type: 'X-Ray',
      date: '2024-12-01',
      size: '2.5 MB'
    },
    {
      id: 2,
      name: 'Treatment Plan 2024',
      type: 'Document',
      date: '2024-09-15',
      size: '156 KB'
    }
  ]);

  const [notifications, setNotifications] = useState([
    {
      id: 1,
      message: 'Reminder: Appointment tomorrow at 10:00 AM',
      type: 'reminder',
      date: '2025-01-14',
      read: false
    },
    {
      id: 2,
      message: 'Your insurance claim has been processed',
      type: 'billing',
      date: '2025-01-10',
      read: true
    }
  ]);

  const [editMode, setEditMode] = useState(false);
  const [showNewAppointment, setShowNewAppointment] = useState(false);
  const [newAppointment, setNewAppointment] = useState({
    date: '',
    time: '',
    type: 'Regular Checkup',
    notes: ''
  });

  const [messages, setMessages] = useState([
    {
      id: 1,
      from: 'Dr. Smith',
      subject: 'Follow-up on recent procedure',
      message: 'How are you feeling after the cavity filling? Any discomfort?',
      date: '2024-12-03',
      read: true
    }
  ]);

  const [showPassword, setShowPassword] = useState(false);
  const [preferences, setPreferences] = useState({
    emailReminders: true,
    smsReminders: true,
    appointmentReminders: '24',
    newsletterSubscription: false,
    twoFactorAuth: false
  });

  const handleEditProfile = () => {
    setEditMode(!editMode);
    if (editMode) {
      console.log('Saving profile changes...');
    }
  };

  const handleScheduleAppointment = () => {
    if (newAppointment.date && newAppointment.time) {
      const appointment = {
        id: appointments.length + 1,
        ...newAppointment,
        doctor: 'TBD',
        status: 'pending'
      };
      setAppointments([...appointments, appointment]);
      setShowNewAppointment(false);
      setNewAppointment({ date: '', time: '', type: 'Regular Checkup', notes: '' });
    }
  };

  const handleCancelAppointment = (id) => {
    setAppointments(appointments.filter(apt => apt.id !== id));
  };

  const handlePayBill = (billId) => {
    setBills(bills.map(bill => 
      bill.id === billId ? { ...bill, status: 'paid' } : bill
    ));
  };

  const handleRequestRefill = (prescriptionId) => {
    console.log('Requesting refill for prescription:', prescriptionId);
  };

  const handleDownloadDocument = (docId) => {
    console.log('Downloading document:', docId);
  };

  const handleMarkNotificationRead = (notifId) => {
    setNotifications(notifications.map(notif =>
      notif.id === notifId ? { ...notif, read: true } : notif
    ));
  };

  const renderDashboard = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-blue-50 p-4 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-blue-600">Next Appointment</p>
              <p className="text-xl font-bold text-blue-900">Jan 15, 2025</p>
              <p className="text-sm text-blue-700">10:00 AM - Dr. Smith</p>
            </div>
            <Calendar className="w-8 h-8 text-blue-500" />
          </div>
        </div>
        
        <div className="bg-green-50 p-4 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-green-600">Account Balance</p>
              <p className="text-xl font-bold text-green-900">$0.00</p>
              <p className="text-sm text-green-700">All paid</p>
            </div>
            <CreditCard className="w-8 h-8 text-green-500" />
          </div>
        </div>
        
        <div className="bg-purple-50 p-4 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-purple-600">Active Prescriptions</p>
              <p className="text-xl font-bold text-purple-900">1</p>
              <p className="text-sm text-purple-700">Refills available</p>
            </div>
            <Pill className="w-8 h-8 text-purple-500" />
          </div>
        </div>
        
        <div className="bg-orange-50 p-4 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-orange-600">Unread Messages</p>
              <p className="text-xl font-bold text-orange-900">0</p>
              <p className="text-sm text-orange-700">All caught up</p>
            </div>
            <MessageSquare className="w-8 h-8 text-orange-500" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Upcoming Appointments</h3>
          <div className="space-y-3">
            {appointments.slice(0, 2).map(apt => (
              <div key={apt.id} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                <div>
                  <p className="font-medium">{apt.type}</p>
                  <p className="text-sm text-gray-600">{apt.date} at {apt.time}</p>
                </div>
                <span className={`px-2 py-1 text-xs rounded-full ${
                  apt.status === 'confirmed' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                }`}>
                  {apt.status}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Recent Activity</h3>
          <div className="space-y-3">
            {medicalHistory.slice(0, 2).map(record => (
              <div key={record.id} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                <div>
                  <p className="font-medium">{record.procedure}</p>
                  <p className="text-sm text-gray-600">{record.date} - {record.doctor}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  const renderProfile = () => (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">My Profile</h2>
        <button
          onClick={handleEditProfile}
          className="flex items-center px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
        >
          {editMode ? <Save className="w-4 h-4 mr-2" /> : <Edit2 className="w-4 h-4 mr-2" />}
          {editMode ? 'Save Changes' : 'Edit Profile'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
            <input
              type="text"
              value={patientData.firstName}
              onChange={(e) => setPatientData({...patientData, firstName: e.target.value})}
              disabled={!editMode}
              className="w-full px-3 py-2 border rounded-lg disabled:bg-gray-50"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
            <input
              type="text"
              value={patientData.lastName}
              onChange={(e) => setPatientData({...patientData, lastName: e.target.value})}
              disabled={!editMode}
              className="w-full px-3 py-2 border rounded-lg disabled:bg-gray-50"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={patientData.email}
              onChange={(e) => setPatientData({...patientData, email: e.target.value})}
              disabled={!editMode}
              className="w-full px-3 py-2 border rounded-lg disabled:bg-gray-50"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
            <input
              type="tel"
              value={patientData.phone}
              onChange={(e) => setPatientData({...patientData, phone: e.target.value})}
              disabled={!editMode}
              className="w-full px-3 py-2 border rounded-lg disabled:bg-gray-50"
            />
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth</label>
            <input
              type="date"
              value={patientData.dateOfBirth}
              onChange={(e) => setPatientData({...patientData, dateOfBirth: e.target.value})}
              disabled={!editMode}
              className="w-full px-3 py-2 border rounded-lg disabled:bg-gray-50"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
            <input
              type="text"
              value={patientData.address}
              onChange={(e) => setPatientData({...patientData, address: e.target.value})}
              disabled={!editMode}
              className="w-full px-3 py-2 border rounded-lg disabled:bg-gray-50"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Patient ID</label>
            <input
              type="text"
              value={patientData.id}
              disabled
              className="w-full px-3 py-2 border rounded-lg bg-gray-50"
            />
          </div>
        </div>
      </div>

      <div className="mt-8 border-t pt-6">
        <h3 className="text-lg font-semibold mb-4">Insurance Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Provider</label>
            <input
              type="text"
              value={patientData.insurance.provider}
              onChange={(e) => setPatientData({
                ...patientData,
                insurance: {...patientData.insurance, provider: e.target.value}
              })}
              disabled={!editMode}
              className="w-full px-3 py-2 border rounded-lg disabled:bg-gray-50"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Policy Number</label>
            <input
              type="text"
              value={patientData.insurance.policyNumber}
              onChange={(e) => setPatientData({
                ...patientData,
                insurance: {...patientData.insurance, policyNumber: e.target.value}
              })}
              disabled={!editMode}
              className="w-full px-3 py-2 border rounded-lg disabled:bg-gray-50"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Group Number</label>
            <input
              type="text"
              value={patientData.insurance.groupNumber}
              onChange={(e) => setPatientData({
                ...patientData,
                insurance: {...patientData.insurance, groupNumber: e.target.value}
              })}
              disabled={!editMode}
              className="w-full px-3 py-2 border rounded-lg disabled:bg-gray-50"
            />
          </div>
        </div>
      </div>

      <div className="mt-8 border-t pt-6">
        <h3 className="text-lg font-semibold mb-4">Emergency Contact</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              type="text"
              value={patientData.emergencyContact.name}
              onChange={(e) => setPatientData({
                ...patientData,
                emergencyContact: {...patientData.emergencyContact, name: e.target.value}
              })}
              disabled={!editMode}
              className="w-full px-3 py-2 border rounded-lg disabled:bg-gray-50"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Relationship</label>
            <input
              type="text"
              value={patientData.emergencyContact.relationship}
              onChange={(e) => setPatientData({
                ...patientData,
                emergencyContact: {...patientData.emergencyContact, relationship: e.target.value}
              })}
              disabled={!editMode}
              className="w-full px-3 py-2 border rounded-lg disabled:bg-gray-50"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
            <input
              type="tel"
              value={patientData.emergencyContact.phone}
              onChange={(e) => setPatientData({
                ...patientData,
                emergencyContact: {...patientData.emergencyContact, phone: e.target.value}
              })}
              disabled={!editMode}
              className="w-full px-3 py-2 border rounded-lg disabled:bg-gray-50"
            />
          </div>
        </div>
      </div>
    </div>
  );

  const renderAppointments = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">My Appointments</h2>
          <button
            onClick={() => setShowNewAppointment(true)}
            className="flex items-center px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
          >
            <Plus className="w-4 h-4 mr-2" />
            Schedule New
          </button>
        </div>

        {showNewAppointment && (
          <div className="mb-6 p-4 bg-blue-50 rounded-lg">
            <h3 className="text-lg font-semibold mb-4">Request New Appointment</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Preferred Date</label>
                <input
                  type="date"
                  value={newAppointment.date}
                  onChange={(e) => setNewAppointment({...newAppointment, date: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Preferred Time</label>
                <input
                  type="time"
                  value={newAppointment.time}
                  onChange={(e) => setNewAppointment({...newAppointment, time: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Appointment Type</label>
                <select
                  value={newAppointment.type}
                  onChange={(e) => setNewAppointment({...newAppointment, type: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option>Regular Checkup</option>
                  <option>Teeth Cleaning</option>
                  <option>Emergency</option>
                  <option>Consultation</option>
                  <option>Follow-up</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes (Optional)</label>
                <input
                  type="text"
                  value={newAppointment.notes}
                  onChange={(e) => setNewAppointment({...newAppointment, notes: e.target.value})}
                  placeholder="Any special requests..."
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button
                onClick={handleScheduleAppointment}
                className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
              >
                Submit Request
              </button>
              <button
                onClick={() => setShowNewAppointment(false)}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="space-y-4">
          {appointments.map(apt => (
            <div key={apt.id} className="border rounded-lg p-4">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h4 className="font-semibold text-lg">{apt.type}</h4>
                  <div className="mt-2 space-y-1 text-sm text-gray-600">
                    <p className="flex items-center">
                      <Calendar className="w-4 h-4 mr-2" />
                      {apt.date}
                    </p>
                    <p className="flex items-center">
                      <Clock className="w-4 h-4 mr-2" />
                      {apt.time}
                    </p>
                    <p className="flex items-center">
                      <User className="w-4 h-4 mr-2" />
                      {apt.doctor}
                    </p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className={`px-3 py-1 text-sm rounded-full ${
                    apt.status === 'confirmed' ? 'bg-green-100 text-green-800' :
                    apt.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-blue-100 text-blue-800'
                  }`}>
                    {apt.status}
                  </span>
                  <div className="flex gap-2">
                    <button className="text-blue-600 hover:text-blue-800 text-sm">
                      Reschedule
                    </button>
                    <button 
                      onClick={() => handleCancelAppointment(apt.id)}
                      className="text-red-600 hover:text-red-800 text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderMedicalRecords = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-2xl font-bold mb-6">Medical History</h2>
        
        <div className="space-y-4">
          {medicalHistory.map(record => (
            <div key={record.id} className="border rounded-lg p-4">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-semibold">{record.procedure}</h4>
                  <p className="text-sm text-gray-600 mt-1">{record.date} - {record.doctor}</p>
                  <p className="text-sm mt-2">{record.notes}</p>
                </div>
                <button className="text-blue-600 hover:text-blue-800">
                  <Eye className="w-5 h-5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-2xl font-bold mb-6">Documents</h2>
        
        <div className="space-y-3">
          {documents.map(doc => (
            <div key={doc.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
              <div className="flex items-center">
                <FileText className="w-5 h-5 text-gray-500 mr-3" />
                <div>
                  <p className="font-medium">{doc.name}</p>
                  <p className="text-sm text-gray-600">{doc.date} • {doc.size}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => handleDownloadDocument(doc.id)}
                  className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                >
                  <Download className="w-4 h-4" />
                </button>
                <button className="p-2 text-gray-600 hover:bg-gray-50 rounded">
                  <Eye className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>

        <button className="mt-4 flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">
          <Upload className="w-4 h-4 mr-2" />
          Upload Document
        </button>
      </div>
    </div>
  );

  const renderBilling = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-2xl font-bold mb-6">Billing & Payments</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-green-50 p-4 rounded-lg">
            <p className="text-sm text-green-600">Total Paid</p>
            <p className="text-2xl font-bold text-green-900">$400.00</p>
          </div>
          <div className="bg-blue-50 p-4 rounded-lg">
            <p className="text-sm text-blue-600">Insurance Covered</p>
            <p className="text-2xl font-bold text-blue-900">$350.00</p>
          </div>
          <div className="bg-orange-50 p-4 rounded-lg">
            <p className="text-sm text-orange-600">Outstanding</p>
            <p className="text-2xl font-bold text-orange-900">$0.00</p>
          </div>
        </div>

        <div className="space-y-4">
          {bills.map(bill => (
            <div key={bill.id} className="border rounded-lg p-4">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-semibold">{bill.description}</h4>
                  <p className="text-sm text-gray-600 mt-1">{bill.date}</p>
                  <div className="mt-3 space-y-1 text-sm">
                    <p>Total Amount: <span className="font-medium">${bill.amount.toFixed(2)}</span></p>
                    <p>Insurance Paid: <span className="font-medium text-green-600">${bill.insuranceCovered.toFixed(2)}</span></p>
                    <p>You Owe: <span className="font-bold">${bill.patientOwes.toFixed(2)}</span></p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className={`px-3 py-1 text-sm rounded-full ${
                    bill.status === 'paid' ? 'bg-green-100 text-green-800' :
                    'bg-yellow-100 text-yellow-800'
                  }`}>
                    {bill.status}
                  </span>
                  {bill.status !== 'paid' && bill.patientOwes > 0 && (
                    <button 
                      onClick={() => handlePayBill(bill.id)}
                      className="px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600"
                    >
                      Pay Now
                    </button>
                  )}
                  <button className="text-blue-600 hover:text-blue-800 text-sm">
                    View Details
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <h3 className="font-semibold mb-2">Payment Methods</h3>
          <div className="space-y-2">
            <div className="flex items-center justify-between p-2">
              <div className="flex items-center">
                <CreditCard className="w-5 h-5 text-gray-500 mr-3" />
                <span>•••• •••• •••• 4242</span>
              </div>
              <button className="text-blue-600 text-sm">Edit</button>
            </div>
          </div>
          <button className="mt-2 text-blue-600 text-sm">+ Add Payment Method</button>
        </div>
      </div>
    </div>
  );

  const renderPrescriptions = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-2xl font-bold mb-6">My Prescriptions</h2>
        
        <div className="space-y-4">
          {prescriptions.map(prescription => (
            <div key={prescription.id} className="border rounded-lg p-4">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-semibold text-lg">{prescription.medication}</h4>
                  <p className="text-sm text-gray-600 mt-1">
                    Prescribed by {prescription.doctor} on {prescription.prescribedDate}
                  </p>
                  <div className="mt-3 p-3 bg-yellow-50 rounded">
                    <p className="text-sm font-medium text-yellow-800">Dosage Instructions:</p>
                    <p className="text-sm text-yellow-700 mt-1">{prescription.dosage}</p>
                  </div>
                  <p className="text-sm text-gray-600 mt-2">
                    Refills remaining: {prescription.refills}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className={`px-3 py-1 text-sm rounded-full ${
                    prescription.status === 'active' ? 'bg-green-100 text-green-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {prescription.status}
                  </span>
                  <button 
                    onClick={() => handleRequestRefill(prescription.id)}
                    className="px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600"
                  >
                    Request Refill
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 p-4 bg-blue-50 rounded-lg">
          <h3 className="font-semibold text-blue-900 mb-2">Pharmacy Information</h3>
          <p className="text-sm text-blue-800">CVS Pharmacy</p>
          <p className="text-sm text-blue-700">456 Oak Street, Springfield, IL</p>
          <p className="text-sm text-blue-700">(555) 234-5678</p>
          <button className="mt-2 text-blue-600 text-sm font-medium">Change Pharmacy</button>
        </div>
      </div>
    </div>
  );

  const renderMessages = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">Messages</h2>
          <button className="flex items-center px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600">
            <Plus className="w-4 h-4 mr-2" />
            New Message
          </button>
        </div>

        <div className="space-y-4">
          {messages.map(message => (
            <div key={message.id} className="border rounded-lg p-4 hover:bg-gray-50 cursor-pointer">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold">{message.from}</h4>
                    {!message.read && (
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">New</span>
                    )}
                  </div>
                  <p className="text-sm font-medium mt-1">{message.subject}</p>
                  <p className="text-sm text-gray-600 mt-2">{message.message}</p>
                </div>
                <p className="text-sm text-gray-500">{message.date}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderSettings = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-2xl font-bold mb-6">Settings & Preferences</h2>
        
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold mb-4">Notification Preferences</h3>
            <div className="space-y-3">
              <label className="flex items-center justify-between">
                <span className="text-sm">Email Reminders</span>
                <input
                  type="checkbox"
                  checked={preferences.emailReminders}
                  onChange={(e) => setPreferences({...preferences, emailReminders: e.target.checked})}
                  className="w-4 h-4"
                />
              </label>
              <label className="flex items-center justify-between">
                <span className="text-sm">SMS Reminders</span>
                <input
                  type="checkbox"
                  checked={preferences.smsReminders}
                  onChange={(e) => setPreferences({...preferences, smsReminders: e.target.checked})}
                  className="w-4 h-4"
                />
              </label>
              <div className="flex items-center justify-between">
                <span className="text-sm">Appointment Reminder Time</span>
                <select
                  value={preferences.appointmentReminders}
                  onChange={(e) => setPreferences({...preferences, appointmentReminders: e.target.value})}
                  className="px-3 py-1 border rounded"
                >
                  <option value="24">24 hours before</option>
                  <option value="48">48 hours before</option>
                  <option value="72">72 hours before</option>
                </select>
              </div>
              <label className="flex items-center justify-between">
                <span className="text-sm">Newsletter Subscription</span>
                <input
                  type="checkbox"
                  checked={preferences.newsletterSubscription}
                  onChange={(e) => setPreferences({...preferences, newsletterSubscription: e.target.checked})}
                  className="w-4 h-4"
                />
              </label>
            </div>
          </div>

          <div className="border-t pt-6">
            <h3 className="text-lg font-semibold mb-4">Security Settings</h3>
            <div className="space-y-3">
              <label className="flex items-center justify-between">
                <div>
                  <span className="text-sm font-medium">Two-Factor Authentication</span>
                  <p className="text-xs text-gray-500">Add an extra layer of security to your account</p>
                </div>
                <input
                  type="checkbox"
                  checked={preferences.twoFactorAuth}
                  onChange={(e) => setPreferences({...preferences, twoFactorAuth: e.target.checked})}
                  className="w-4 h-4"
                />
              </label>
              <div>
                <button className="text-blue-600 text-sm">Change Password</button>
              </div>
            </div>
          </div>

          <div className="border-t pt-6">
            <h3 className="text-lg font-semibold mb-4">Account Actions</h3>
            <div className="space-y-2">
              <button className="text-blue-600 text-sm">Download My Data</button>
              <br />
              <button className="text-red-600 text-sm">Delete Account</button>
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600">
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );

  const unreadNotifications = notifications.filter(n => !n.read).length;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-4">
            <div className="flex items-center">
              <Heart className="w-8 h-8 text-blue-500 mr-3" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Patient Portal</h1>
                <p className="text-sm text-gray-500">Welcome back, {patientData.firstName}!</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <button className="relative p-2 text-gray-600 hover:text-gray-900">
                <Bell className="w-6 h-6" />
                {unreadNotifications > 0 && (
                  <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/2 -translate-y-1/2 bg-red-500 rounded-full">
                    {unreadNotifications}
                  </span>
                )}
              </button>
              <button className="flex items-center space-x-2 p-2 text-gray-600 hover:text-gray-900">
                <User className="w-6 h-6" />
                <span className="hidden md:inline">My Account</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-col lg:flex-row gap-6">
          <div className="lg:w-64">
            <nav className="bg-white rounded-lg shadow p-4">
              <ul className="space-y-2">
                {[
                  { id: 'dashboard', label: 'Dashboard', icon: Activity },
                  { id: 'profile', label: 'My Profile', icon: User },
                  { id: 'appointments', label: 'Appointments', icon: Calendar },
                  { id: 'records', label: 'Medical Records', icon: FileText },
                  { id: 'billing', label: 'Billing', icon: CreditCard },
                  { id: 'prescriptions', label: 'Prescriptions', icon: Pill },
                  { id: 'messages', label: 'Messages', icon: MessageSquare },
                  { id: 'settings', label: 'Settings', icon: Settings },
                ].map(item => (
                  <li key={item.id}>
                    <button
                      onClick={() => setActiveSection(item.id)}
                      className={`w-full flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        activeSection === item.id
                          ? 'bg-blue-50 text-blue-600'
                          : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <item.icon className="w-5 h-5 mr-3" />
                      {item.label}
                      {item.id === 'messages' && messages.filter(m => !m.read).length > 0 && (
                        <span className="ml-auto bg-red-500 text-white text-xs px-2 py-1 rounded-full">
                          {messages.filter(m => !m.read).length}
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            </nav>

            <div className="mt-6 bg-blue-50 rounded-lg p-4">
              <h3 className="font-semibold text-blue-900 mb-2">Need Help?</h3>
              <p className="text-sm text-blue-700 mb-3">Contact our support team</p>
              <button className="w-full px-3 py-2 bg-blue-500 text-white rounded text-sm hover:bg-blue-600">
                <Phone className="w-4 h-4 inline mr-2" />
                Call Support
              </button>
            </div>
          </div>

          <div className="flex-1">
            {activeSection === 'dashboard' && renderDashboard()}
            {activeSection === 'profile' && renderProfile()}
            {activeSection === 'appointments' && renderAppointments()}
            {activeSection === 'records' && renderMedicalRecords()}
            {activeSection === 'billing' && renderBilling()}
            {activeSection === 'prescriptions' && renderPrescriptions()}
            {activeSection === 'messages' && renderMessages()}
            {activeSection === 'settings' && renderSettings()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PatientPortal;