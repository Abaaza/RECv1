import React, { useState, useEffect } from 'react';
import { Calendar, Clock, User, Phone, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import apiService from '../services/apiService';

const AppointmentsList = () => {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, today, upcoming, past

  useEffect(() => {
    loadAppointments();
    const interval = setInterval(loadAppointments, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const loadAppointments = async () => {
    try {
      setLoading(true);
      const data = await apiService.getAppointments();
      setAppointments(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to load appointments:', error);
      setAppointments([]);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'scheduled':
      case 'confirmed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'cancelled':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-blue-500" />;
      default:
        return <AlertCircle className="w-4 h-4 text-gray-500" />;
    }
  };

  const getTypeColor = (type) => {
    const colors = {
      'emergency': 'bg-red-100 text-red-800',
      'cleaning': 'bg-blue-100 text-blue-800',
      'checkup': 'bg-green-100 text-green-800',
      'filling': 'bg-yellow-100 text-yellow-800',
      'root-canal': 'bg-purple-100 text-purple-800',
      'crown': 'bg-pink-100 text-pink-800',
      'extraction': 'bg-orange-100 text-orange-800',
      'consultation': 'bg-teal-100 text-teal-800',
      'other': 'bg-gray-100 text-gray-800'
    };
    return colors[type] || colors['other'];
  };

  const filterAppointments = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    switch (filter) {
      case 'today':
        return appointments.filter(apt => {
          const aptDate = new Date(apt.date);
          return aptDate >= today && aptDate < tomorrow;
        });
      case 'upcoming':
        return appointments.filter(apt => {
          const aptDate = new Date(apt.date);
          return aptDate >= today;
        });
      case 'past':
        return appointments.filter(apt => {
          const aptDate = new Date(apt.date);
          return aptDate < today;
        });
      default:
        return appointments;
    }
  };

  const filteredAppointments = filterAppointments();

  if (loading && appointments.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading appointments...</div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">All Appointments</h2>
        <div className="flex space-x-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1 rounded-md text-sm ${
              filter === 'all' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700'
            }`}
          >
            All ({appointments.length})
          </button>
          <button
            onClick={() => setFilter('today')}
            className={`px-3 py-1 rounded-md text-sm ${
              filter === 'today' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700'
            }`}
          >
            Today
          </button>
          <button
            onClick={() => setFilter('upcoming')}
            className={`px-3 py-1 rounded-md text-sm ${
              filter === 'upcoming' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700'
            }`}
          >
            Upcoming
          </button>
          <button
            onClick={() => setFilter('past')}
            className={`px-3 py-1 rounded-md text-sm ${
              filter === 'past' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700'
            }`}
          >
            Past
          </button>
        </div>
      </div>

      {filteredAppointments.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          No appointments found
        </div>
      ) : (
        <div className="space-y-3">
          {filteredAppointments.map((apt, index) => (
            <div
              key={apt._id || index}
              className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getTypeColor(apt.type)}`}>
                      {apt.type?.toUpperCase()}
                    </span>
                    <div className="flex items-center space-x-1">
                      {getStatusIcon(apt.status)}
                      <span className="text-sm text-gray-600">{apt.status}</span>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center text-sm text-gray-600">
                        <Calendar className="w-4 h-4 mr-1" />
                        {format(new Date(apt.date), 'MMM d, yyyy')}
                      </div>
                      <div className="flex items-center text-sm text-gray-600">
                        <Clock className="w-4 h-4 mr-1" />
                        {apt.startTime} - {apt.endTime}
                      </div>
                    </div>
                    
                    <div className="space-y-1">
                      {apt.confirmationNumber && (
                        <div className="text-sm">
                          <span className="text-gray-500">Confirmation:</span>
                          <span className="ml-1 font-mono text-xs">{apt.confirmationNumber}</span>
                        </div>
                      )}
                      {apt.patientId && (
                        <div className="flex items-center text-sm text-gray-600">
                          <User className="w-4 h-4 mr-1" />
                          {apt.patientId.profile?.firstName || 'Patient'} {apt.patientId.profile?.lastName || ''}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {apt.notes && (
                    <div className="mt-2 text-sm text-gray-500 italic">{apt.notes}</div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AppointmentsList;