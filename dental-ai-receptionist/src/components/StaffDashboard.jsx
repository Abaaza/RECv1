import React, { useState, useEffect } from 'react';
import { 
  Users, Calendar, DollarSign, TrendingUp, Clock, 
  Activity, FileText, Settings, Bell, Search, Filter,
  ChevronDown, ChevronUp, MoreVertical, Download, Upload,
  Phone, Mail, MapPin, Star, AlertCircle, CheckCircle,
  XCircle, BarChart3, PieChart, LineChart, Target,
  Briefcase, UserCheck, UserX, CreditCard, Package,
  Stethoscope, Zap, Shield, Award, Eye, Edit, Trash2
} from 'lucide-react';

const StaffDashboard = () => {
  const [activeView, setActiveView] = useState('overview');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [showNotifications, setShowNotifications] = useState(false);
  
  const [stats, setStats] = useState({
    todayAppointments: 12,
    completedAppointments: 8,
    canceledAppointments: 1,
    newPatients: 3,
    totalRevenue: 4850,
    averageWaitTime: 15,
    patientSatisfaction: 4.8,
    staffUtilization: 85
  });

  const [appointments, setAppointments] = useState([
    {
      id: 1,
      time: '09:00 AM',
      patient: 'John Smith',
      type: 'Regular Checkup',
      dentist: 'Dr. Sarah Johnson',
      status: 'completed',
      duration: 30,
      room: 'Room A',
      phone: '(555) 123-4567',
      notes: 'Regular 6-month checkup'
    },
    {
      id: 2,
      time: '09:30 AM',
      patient: 'Emily Davis',
      type: 'Cavity Filling',
      dentist: 'Dr. Michael Chen',
      status: 'completed',
      duration: 45,
      room: 'Room B',
      phone: '(555) 234-5678',
      notes: 'Upper molar cavity'
    },
    {
      id: 3,
      time: '10:15 AM',
      patient: 'Robert Wilson',
      type: 'Root Canal',
      dentist: 'Dr. Sarah Johnson',
      status: 'in-progress',
      duration: 90,
      room: 'Room C',
      phone: '(555) 345-6789',
      notes: 'Complex root canal procedure'
    },
    {
      id: 4,
      time: '11:00 AM',
      patient: 'Lisa Anderson',
      type: 'Teeth Cleaning',
      dentist: 'Dr. Jennifer Park',
      status: 'waiting',
      duration: 30,
      room: 'Room A',
      phone: '(555) 456-7890',
      notes: 'Routine cleaning'
    },
    {
      id: 5,
      time: '02:00 PM',
      patient: 'Michael Brown',
      type: 'Consultation',
      dentist: 'Dr. Michael Chen',
      status: 'scheduled',
      duration: 30,
      room: 'Room B',
      phone: '(555) 567-8901',
      notes: 'Invisalign consultation'
    }
  ]);

  const [staff, setStaff] = useState([
    {
      id: 1,
      name: 'Dr. Sarah Johnson',
      role: 'Senior Dentist',
      status: 'available',
      currentPatient: 'Robert Wilson',
      nextAvailable: '11:45 AM',
      appointmentsToday: 6,
      completedToday: 4,
      rating: 4.9,
      specialties: ['Endodontics', 'Oral Surgery']
    },
    {
      id: 2,
      name: 'Dr. Michael Chen',
      role: 'General Dentist',
      status: 'busy',
      currentPatient: null,
      nextAvailable: '02:00 PM',
      appointmentsToday: 5,
      completedToday: 3,
      rating: 4.8,
      specialties: ['Cosmetic', 'Orthodontics']
    },
    {
      id: 3,
      name: 'Dr. Jennifer Park',
      role: 'Dental Hygienist',
      status: 'available',
      currentPatient: null,
      nextAvailable: 'Now',
      appointmentsToday: 8,
      completedToday: 5,
      rating: 4.7,
      specialties: ['Preventive Care', 'Periodontics']
    },
    {
      id: 4,
      name: 'Amy Thompson',
      role: 'Dental Assistant',
      status: 'busy',
      currentPatient: 'Assisting Dr. Johnson',
      nextAvailable: '11:45 AM',
      appointmentsToday: 6,
      completedToday: 4,
      rating: 4.9,
      specialties: []
    }
  ]);

  const [patients, setPatients] = useState([
    {
      id: 1,
      name: 'John Smith',
      lastVisit: '2024-12-15',
      nextAppointment: '2025-01-15',
      balance: 0,
      insurance: 'Blue Cross',
      risk: 'low',
      loyalty: 'gold',
      visits: 12
    },
    {
      id: 2,
      name: 'Emily Davis',
      lastVisit: '2024-11-20',
      nextAppointment: '2025-01-20',
      balance: 150,
      insurance: 'Aetna',
      risk: 'medium',
      loyalty: 'silver',
      visits: 8
    },
    {
      id: 3,
      name: 'Robert Wilson',
      lastVisit: '2024-10-10',
      nextAppointment: 'Today',
      balance: 0,
      insurance: 'Delta Dental',
      risk: 'high',
      loyalty: 'platinum',
      visits: 24
    }
  ]);

  const [inventory, setInventory] = useState([
    {
      id: 1,
      item: 'Dental Gloves (Box)',
      category: 'PPE',
      quantity: 45,
      minStock: 20,
      status: 'good',
      lastOrdered: '2024-12-20',
      supplier: 'MedSupply Co'
    },
    {
      id: 2,
      item: 'Composite Filling Material',
      category: 'Materials',
      quantity: 12,
      minStock: 15,
      status: 'low',
      lastOrdered: '2024-12-10',
      supplier: 'DentalPro Supplies'
    },
    {
      id: 3,
      item: 'Local Anesthetic',
      category: 'Medication',
      quantity: 30,
      minStock: 25,
      status: 'order',
      lastOrdered: '2024-11-15',
      supplier: 'PharmaDent'
    }
  ]);

  const [notifications, setNotifications] = useState([
    {
      id: 1,
      type: 'appointment',
      message: 'New appointment request from Jane Doe',
      time: '5 min ago',
      read: false
    },
    {
      id: 2,
      type: 'alert',
      message: 'Low inventory alert: Composite Filling Material',
      time: '1 hour ago',
      read: false
    },
    {
      id: 3,
      type: 'payment',
      message: 'Payment received from John Smith - $250',
      time: '2 hours ago',
      read: true
    }
  ]);

  const [tasks, setTasks] = useState([
    {
      id: 1,
      task: 'Review treatment plan for Robert Wilson',
      assignedTo: 'Dr. Sarah Johnson',
      priority: 'high',
      dueTime: '11:00 AM',
      status: 'pending'
    },
    {
      id: 2,
      task: 'Order dental supplies - low inventory',
      assignedTo: 'Office Manager',
      priority: 'medium',
      dueTime: 'EOD',
      status: 'pending'
    },
    {
      id: 3,
      task: 'Prepare room C for root canal',
      assignedTo: 'Amy Thompson',
      priority: 'high',
      dueTime: '10:00 AM',
      status: 'completed'
    }
  ]);

  const performanceMetrics = {
    daily: {
      appointments: [8, 10, 12, 11, 9, 12, 8],
      revenue: [3200, 4100, 4850, 4500, 3800, 4850, 3200],
      satisfaction: [4.5, 4.7, 4.8, 4.6, 4.9, 4.8, 4.7]
    },
    procedures: {
      checkups: 35,
      cleanings: 28,
      fillings: 18,
      rootCanals: 8,
      extractions: 6,
      cosmetic: 12
    }
  };

  const handleStatusUpdate = (appointmentId, newStatus) => {
    setAppointments(appointments.map(apt =>
      apt.id === appointmentId ? { ...apt, status: newStatus } : apt
    ));
  };

  const handleTaskComplete = (taskId) => {
    setTasks(tasks.map(task =>
      task.id === taskId ? { ...task, status: 'completed' } : task
    ));
  };

  const renderOverview = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <Calendar className="w-8 h-8 text-blue-500" />
            <span className="text-2xl font-bold">{stats.todayAppointments}</span>
          </div>
          <p className="text-sm text-gray-600">Today's Appointments</p>
          <div className="mt-2 text-xs">
            <span className="text-green-600">{stats.completedAppointments} completed</span>
            {stats.canceledAppointments > 0 && (
              <span className="text-red-600 ml-2">{stats.canceledAppointments} canceled</span>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <DollarSign className="w-8 h-8 text-green-500" />
            <span className="text-2xl font-bold">${stats.totalRevenue}</span>
          </div>
          <p className="text-sm text-gray-600">Today's Revenue</p>
          <div className="mt-2 flex items-center text-xs">
            <TrendingUp className="w-3 h-3 text-green-500 mr-1" />
            <span className="text-green-600">+12% from yesterday</span>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <Users className="w-8 h-8 text-purple-500" />
            <span className="text-2xl font-bold">{stats.newPatients}</span>
          </div>
          <p className="text-sm text-gray-600">New Patients</p>
          <div className="mt-2 text-xs text-purple-600">
            This week: 15 total
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <Star className="w-8 h-8 text-yellow-500" />
            <span className="text-2xl font-bold">{stats.patientSatisfaction}</span>
          </div>
          <p className="text-sm text-gray-600">Patient Satisfaction</p>
          <div className="mt-2">
            <div className="flex text-yellow-400">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className={`w-3 h-3 ${i < Math.floor(stats.patientSatisfaction) ? 'fill-current' : ''}`} />
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Today's Schedule</h3>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {appointments.map(apt => (
              <div key={apt.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100">
                <div className="flex items-center space-x-4">
                  <div className="text-center">
                    <p className="text-sm font-medium">{apt.time}</p>
                    <p className="text-xs text-gray-500">{apt.duration} min</p>
                  </div>
                  <div className="border-l pl-4">
                    <p className="font-medium">{apt.patient}</p>
                    <p className="text-sm text-gray-600">{apt.type} - {apt.dentist}</p>
                    <p className="text-xs text-gray-500">Room {apt.room}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    apt.status === 'completed' ? 'bg-green-100 text-green-800' :
                    apt.status === 'in-progress' ? 'bg-blue-100 text-blue-800' :
                    apt.status === 'waiting' ? 'bg-yellow-100 text-yellow-800' :
                    apt.status === 'canceled' ? 'bg-red-100 text-red-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {apt.status}
                  </span>
                  <button className="p-1 hover:bg-gray-200 rounded">
                    <MoreVertical className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Priority Tasks</h3>
          <div className="space-y-3">
            {tasks.filter(t => t.status === 'pending').map(task => (
              <div key={task.id} className="p-3 bg-gray-50 rounded-lg">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-medium">{task.task}</p>
                    <p className="text-xs text-gray-600 mt-1">{task.assignedTo}</p>
                    <p className="text-xs text-gray-500">Due: {task.dueTime}</p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className={`px-2 py-1 text-xs rounded ${
                      task.priority === 'high' ? 'bg-red-100 text-red-700' :
                      task.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {task.priority}
                    </span>
                    <button
                      onClick={() => handleTaskComplete(task.id)}
                      className="text-green-600 hover:text-green-700"
                    >
                      <CheckCircle className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Staff Status</h3>
          <div className="space-y-3">
            {staff.map(member => (
              <div key={member.id} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                <div className="flex items-center space-x-3">
                  <div className={`w-2 h-2 rounded-full ${
                    member.status === 'available' ? 'bg-green-500' :
                    member.status === 'busy' ? 'bg-red-500' :
                    'bg-yellow-500'
                  }`} />
                  <div>
                    <p className="font-medium">{member.name}</p>
                    <p className="text-sm text-gray-600">{member.role}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm">
                    {member.completedToday}/{member.appointmentsToday} appointments
                  </p>
                  <p className="text-xs text-gray-500">
                    Next: {member.nextAvailable}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-3">
            <button className="p-3 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 flex items-center justify-center">
              <Calendar className="w-4 h-4 mr-2" />
              New Appointment
            </button>
            <button className="p-3 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 flex items-center justify-center">
              <Users className="w-4 h-4 mr-2" />
              Register Patient
            </button>
            <button className="p-3 bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 flex items-center justify-center">
              <FileText className="w-4 h-4 mr-2" />
              Generate Report
            </button>
            <button className="p-3 bg-orange-50 text-orange-700 rounded-lg hover:bg-orange-100 flex items-center justify-center">
              <Package className="w-4 h-4 mr-2" />
              Order Supplies
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderAppointments = () => (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Appointment Management</h2>
        <div className="flex items-center space-x-3">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-3 py-2 border rounded-lg"
          />
          <button className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600">
            New Appointment
          </button>
        </div>
      </div>

      <div className="mb-4 flex items-center space-x-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search appointments..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-4 py-2 border rounded-lg"
        >
          <option value="all">All Status</option>
          <option value="scheduled">Scheduled</option>
          <option value="waiting">Waiting</option>
          <option value="in-progress">In Progress</option>
          <option value="completed">Completed</option>
          <option value="canceled">Canceled</option>
        </select>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Patient</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Procedure</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Provider</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Room</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {appointments
              .filter(apt => filterStatus === 'all' || apt.status === filterStatus)
              .filter(apt => apt.patient.toLowerCase().includes(searchTerm.toLowerCase()))
              .map(apt => (
                <tr key={apt.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium">{apt.time}</p>
                      <p className="text-xs text-gray-500">{apt.duration} min</p>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium">{apt.patient}</p>
                      <p className="text-xs text-gray-500">{apt.phone}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3">{apt.type}</td>
                  <td className="px-4 py-3">{apt.dentist}</td>
                  <td className="px-4 py-3">{apt.room}</td>
                  <td className="px-4 py-3">
                    <select
                      value={apt.status}
                      onChange={(e) => handleStatusUpdate(apt.id, e.target.value)}
                      className={`px-2 py-1 text-xs rounded-full border-0 ${
                        apt.status === 'completed' ? 'bg-green-100 text-green-800' :
                        apt.status === 'in-progress' ? 'bg-blue-100 text-blue-800' :
                        apt.status === 'waiting' ? 'bg-yellow-100 text-yellow-800' :
                        apt.status === 'canceled' ? 'bg-red-100 text-red-800' :
                        'bg-gray-100 text-gray-800'
                      }`}
                    >
                      <option value="scheduled">Scheduled</option>
                      <option value="waiting">Waiting</option>
                      <option value="in-progress">In Progress</option>
                      <option value="completed">Completed</option>
                      <option value="canceled">Canceled</option>
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center space-x-2">
                      <button className="text-blue-600 hover:text-blue-700">
                        <Eye className="w-4 h-4" />
                      </button>
                      <button className="text-gray-600 hover:text-gray-700">
                        <Edit className="w-4 h-4" />
                      </button>
                      <button className="text-red-600 hover:text-red-700">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderPatients = () => (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Patient Management</h2>
        <button className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600">
          Add New Patient
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <div className="bg-blue-50 p-4 rounded-lg">
          <p className="text-sm text-blue-600">Total Patients</p>
          <p className="text-2xl font-bold text-blue-900">1,284</p>
          <p className="text-xs text-blue-700 mt-1">+42 this month</p>
        </div>
        <div className="bg-green-50 p-4 rounded-lg">
          <p className="text-sm text-green-600">Active Patients</p>
          <p className="text-2xl font-bold text-green-900">956</p>
          <p className="text-xs text-green-700 mt-1">74% of total</p>
        </div>
        <div className="bg-purple-50 p-4 rounded-lg">
          <p className="text-sm text-purple-600">VIP Patients</p>
          <p className="text-2xl font-bold text-purple-900">128</p>
          <p className="text-xs text-purple-700 mt-1">Platinum & Gold</p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Patient</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Last Visit</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Next Appointment</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Balance</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Insurance</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Risk Level</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Loyalty</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {patients.map(patient => (
              <tr key={patient.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{patient.name}</td>
                <td className="px-4 py-3 text-sm">{patient.lastVisit}</td>
                <td className="px-4 py-3 text-sm">{patient.nextAppointment}</td>
                <td className="px-4 py-3">
                  <span className={patient.balance > 0 ? 'text-red-600' : 'text-green-600'}>
                    ${patient.balance}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm">{patient.insurance}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    patient.risk === 'low' ? 'bg-green-100 text-green-800' :
                    patient.risk === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {patient.risk}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    patient.loyalty === 'platinum' ? 'bg-purple-100 text-purple-800' :
                    patient.loyalty === 'gold' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {patient.loyalty}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center space-x-2">
                    <button className="text-blue-600 hover:text-blue-700">
                      <Eye className="w-4 h-4" />
                    </button>
                    <button className="text-gray-600 hover:text-gray-700">
                      <Edit className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderStaff = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">Staff Management</h2>
          <button className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600">
            Add Staff Member
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-green-50 p-4 rounded-lg">
            <p className="text-sm text-green-600">Available</p>
            <p className="text-2xl font-bold text-green-900">2</p>
          </div>
          <div className="bg-yellow-50 p-4 rounded-lg">
            <p className="text-sm text-yellow-600">On Break</p>
            <p className="text-2xl font-bold text-yellow-900">0</p>
          </div>
          <div className="bg-red-50 p-4 rounded-lg">
            <p className="text-sm text-red-600">Busy</p>
            <p className="text-2xl font-bold text-red-900">2</p>
          </div>
          <div className="bg-blue-50 p-4 rounded-lg">
            <p className="text-sm text-blue-600">Utilization</p>
            <p className="text-2xl font-bold text-blue-900">{stats.staffUtilization}%</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {staff.map(member => (
            <div key={member.id} className="border rounded-lg p-4">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="font-semibold text-lg">{member.name}</h3>
                  <p className="text-sm text-gray-600">{member.role}</p>
                </div>
                <span className={`px-2 py-1 text-xs rounded-full ${
                  member.status === 'available' ? 'bg-green-100 text-green-800' :
                  member.status === 'busy' ? 'bg-red-100 text-red-800' :
                  'bg-yellow-100 text-yellow-800'
                }`}>
                  {member.status}
                </span>
              </div>

              <div className="space-y-2 text-sm">
                {member.currentPatient && (
                  <p className="flex items-center">
                    <User className="w-4 h-4 mr-2 text-gray-400" />
                    Current: {member.currentPatient}
                  </p>
                )}
                <p className="flex items-center">
                  <Clock className="w-4 h-4 mr-2 text-gray-400" />
                  Next Available: {member.nextAvailable}
                </p>
                <p className="flex items-center">
                  <Calendar className="w-4 h-4 mr-2 text-gray-400" />
                  Today: {member.completedToday}/{member.appointmentsToday} appointments
                </p>
                <p className="flex items-center">
                  <Star className="w-4 h-4 mr-2 text-gray-400" />
                  Rating: {member.rating}/5.0
                </p>
                {member.specialties.length > 0 && (
                  <div className="flex items-start">
                    <Award className="w-4 h-4 mr-2 text-gray-400 mt-0.5" />
                    <div className="flex flex-wrap gap-1">
                      {member.specialties.map((specialty, idx) => (
                        <span key={idx} className="px-2 py-0.5 bg-gray-100 text-xs rounded">
                          {specialty}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-4 flex gap-2">
                <button className="flex-1 py-1 bg-blue-50 text-blue-600 rounded text-sm hover:bg-blue-100">
                  View Schedule
                </button>
                <button className="flex-1 py-1 bg-gray-50 text-gray-600 rounded text-sm hover:bg-gray-100">
                  Message
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Staff Performance</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-center">
            <p className="text-sm text-gray-600 mb-2">Average Appointments/Day</p>
            <p className="text-3xl font-bold text-blue-600">6.2</p>
          </div>
          <div className="text-center">
            <p className="text-sm text-gray-600 mb-2">Patient Satisfaction</p>
            <p className="text-3xl font-bold text-green-600">4.8</p>
          </div>
          <div className="text-center">
            <p className="text-sm text-gray-600 mb-2">Revenue/Provider</p>
            <p className="text-3xl font-bold text-purple-600">$1,617</p>
          </div>
        </div>
      </div>
    </div>
  );

  const renderInventory = () => (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Inventory Management</h2>
        <div className="flex space-x-3">
          <button className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600">
            Order Supplies
          </button>
          <button className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600">
            Add Item
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-green-50 p-4 rounded-lg">
          <p className="text-sm text-green-600">In Stock</p>
          <p className="text-2xl font-bold text-green-900">142</p>
        </div>
        <div className="bg-yellow-50 p-4 rounded-lg">
          <p className="text-sm text-yellow-600">Low Stock</p>
          <p className="text-2xl font-bold text-yellow-900">8</p>
        </div>
        <div className="bg-red-50 p-4 rounded-lg">
          <p className="text-sm text-red-600">Out of Stock</p>
          <p className="text-2xl font-bold text-red-900">2</p>
        </div>
        <div className="bg-blue-50 p-4 rounded-lg">
          <p className="text-sm text-blue-600">On Order</p>
          <p className="text-2xl font-bold text-blue-900">5</p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Quantity</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Min Stock</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Last Ordered</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Supplier</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {inventory.map(item => (
              <tr key={item.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{item.item}</td>
                <td className="px-4 py-3">{item.category}</td>
                <td className="px-4 py-3">{item.quantity}</td>
                <td className="px-4 py-3">{item.minStock}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    item.status === 'good' ? 'bg-green-100 text-green-800' :
                    item.status === 'low' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {item.status === 'order' ? 'Order Now' : item.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm">{item.lastOrdered}</td>
                <td className="px-4 py-3 text-sm">{item.supplier}</td>
                <td className="px-4 py-3">
                  <button className="text-blue-600 hover:text-blue-700 text-sm">
                    Order
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderAnalytics = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-2xl font-bold mb-6">Practice Analytics</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="text-center">
            <p className="text-sm text-gray-600 mb-2">Monthly Revenue</p>
            <p className="text-3xl font-bold text-green-600">$142,850</p>
            <p className="text-xs text-green-500">+15% from last month</p>
          </div>
          <div className="text-center">
            <p className="text-sm text-gray-600 mb-2">Appointments</p>
            <p className="text-3xl font-bold text-blue-600">342</p>
            <p className="text-xs text-blue-500">This month</p>
          </div>
          <div className="text-center">
            <p className="text-sm text-gray-600 mb-2">New Patients</p>
            <p className="text-3xl font-bold text-purple-600">48</p>
            <p className="text-xs text-purple-500">+20% growth</p>
          </div>
          <div className="text-center">
            <p className="text-sm text-gray-600 mb-2">Retention Rate</p>
            <p className="text-3xl font-bold text-orange-600">92%</p>
            <p className="text-xs text-orange-500">Above average</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="border rounded-lg p-4">
            <h3 className="font-semibold mb-4">Procedures Distribution</h3>
            <div className="space-y-2">
              {Object.entries(performanceMetrics.procedures).map(([procedure, count]) => (
                <div key={procedure} className="flex items-center justify-between">
                  <span className="text-sm capitalize">{procedure}</span>
                  <div className="flex items-center">
                    <div className="w-32 bg-gray-200 rounded-full h-2 mr-2">
                      <div 
                        className="bg-blue-500 h-2 rounded-full" 
                        style={{ width: `${(count / 35) * 100}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium">{count}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="border rounded-lg p-4">
            <h3 className="font-semibold mb-4">Weekly Performance</h3>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-600 mb-1">Appointments</p>
                <div className="flex items-end space-x-1">
                  {performanceMetrics.daily.appointments.map((val, idx) => (
                    <div 
                      key={idx} 
                      className="flex-1 bg-blue-500 rounded-t"
                      style={{ height: `${val * 10}px` }}
                    />
                  ))}
                </div>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">Revenue</p>
                <div className="flex items-end space-x-1">
                  {performanceMetrics.daily.revenue.map((val, idx) => (
                    <div 
                      key={idx} 
                      className="flex-1 bg-green-500 rounded-t"
                      style={{ height: `${val / 100}px` }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-4">
            <div className="flex items-center">
              <Briefcase className="w-8 h-8 text-blue-500 mr-3" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Staff Dashboard</h1>
                <p className="text-sm text-gray-500">Practice Management System</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <button 
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative p-2 text-gray-600 hover:text-gray-900"
              >
                <Bell className="w-6 h-6" />
                {notifications.filter(n => !n.read).length > 0 && (
                  <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/2 -translate-y-1/2 bg-red-500 rounded-full">
                    {notifications.filter(n => !n.read).length}
                  </span>
                )}
              </button>
              <button className="flex items-center space-x-2 p-2 text-gray-600 hover:text-gray-900">
                <Settings className="w-6 h-6" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {showNotifications && (
        <div className="absolute right-4 top-16 w-80 bg-white rounded-lg shadow-lg z-50 p-4">
          <h3 className="font-semibold mb-3">Notifications</h3>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {notifications.map(notif => (
              <div 
                key={notif.id} 
                className={`p-3 rounded ${notif.read ? 'bg-gray-50' : 'bg-blue-50'}`}
              >
                <p className="text-sm">{notif.message}</p>
                <p className="text-xs text-gray-500 mt-1">{notif.time}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="mb-6">
          <nav className="flex space-x-4">
            {[
              { id: 'overview', label: 'Overview', icon: Activity },
              { id: 'appointments', label: 'Appointments', icon: Calendar },
              { id: 'patients', label: 'Patients', icon: Users },
              { id: 'staff', label: 'Staff', icon: Stethoscope },
              { id: 'inventory', label: 'Inventory', icon: Package },
              { id: 'analytics', label: 'Analytics', icon: BarChart3 }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveView(tab.id)}
                className={`flex items-center px-4 py-2 rounded-lg font-medium transition-colors ${
                  activeView === tab.id
                    ? 'bg-blue-500 text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-100'
                }`}
              >
                <tab.icon className="w-4 h-4 mr-2" />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {activeView === 'overview' && renderOverview()}
        {activeView === 'appointments' && renderAppointments()}
        {activeView === 'patients' && renderPatients()}
        {activeView === 'staff' && renderStaff()}
        {activeView === 'inventory' && renderInventory()}
        {activeView === 'analytics' && renderAnalytics()}
      </div>
    </div>
  );
};

export default StaffDashboard;