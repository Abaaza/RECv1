import React, { useState, useEffect } from 'react';
import Calendar from 'react-calendar';
import { format } from 'date-fns';
import { Calendar as CalendarIcon, Clock, User, Phone, Mail, FileText } from 'lucide-react';
import appointmentService from '../services/appointmentService';
import 'react-calendar/dist/Calendar.css';

const AppointmentCalendar = ({ onAppointmentBooked }) => {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [availableSlots, setAvailableSlots] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [showBookingForm, setShowBookingForm] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [formData, setFormData] = useState({
    patientName: '',
    patientPhone: '',
    patientEmail: '',
    appointmentType: 'Regular Checkup',
    notes: ''
  });

  const appointmentTypes = [
    { value: 'Regular Checkup', duration: 30 },
    { value: 'Emergency', duration: 45 },
    { value: 'Consultation', duration: 20 },
    { value: 'Filling', duration: 60 },
    { value: 'Root Canal', duration: 90 },
    { value: 'Extraction', duration: 45 },
    { value: 'Crown/Bridge', duration: 60 },
    { value: 'Orthodontic', duration: 30 }
  ];

  useEffect(() => {
    loadDayData(selectedDate);
  }, [selectedDate, formData.appointmentType]);

  const loadDayData = async (date) => {
    try {
      const dayAppointments = await appointmentService.getAppointmentsByDate(date);
      setAppointments(dayAppointments);
      
      const duration = appointmentTypes.find(t => t.value === formData.appointmentType)?.duration || 30;
      const slots = await appointmentService.getAvailableSlots(date, duration);
      setAvailableSlots(slots);
    } catch (error) {
      console.error('Failed to load appointment data:', error);
      setAppointments([]);
      setAvailableSlots([]);
    }
  };

  const handleDateChange = (date) => {
    setSelectedDate(date);
    setShowBookingForm(false);
    setSelectedSlot(null);
  };

  const handleSlotSelect = (slot) => {
    setSelectedSlot(slot);
    setShowBookingForm(true);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!selectedSlot) return;
    
    try {
      const duration = appointmentTypes.find(t => t.value === formData.appointmentType)?.duration || 30;
      const endTime = new Date(selectedSlot.time.getTime() + duration * 60000);
      
      const appointment = await appointmentService.createAppointment({
        ...formData,
        type: formData.appointmentType,
        startTime: selectedSlot.time.toISOString(),
        endTime: endTime.toISOString(),
        duration
      });
      
      if (onAppointmentBooked) {
        onAppointmentBooked(appointment);
      }
      
      // Reset form
      setFormData({
        patientName: '',
        patientPhone: '',
        patientEmail: '',
        appointmentType: 'Regular Checkup',
        notes: ''
      });
      setShowBookingForm(false);
      setSelectedSlot(null);
      
      // Reload appointments
      await loadDayData(selectedDate);
      
      alert('Appointment booked successfully!');
    } catch (error) {
      console.error('Failed to book appointment:', error);
      alert('Failed to book appointment. Please try again.');
    }
  };

  const tileClassName = ({ date, view }) => {
    // For calendar tile coloring, we'll skip async check for performance
    // The actual appointments will be loaded when a day is selected
    return null;
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center">
        <CalendarIcon className="w-6 h-6 mr-2" />
        Appointment Calendar
      </h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Calendar */}
        <div>
          <Calendar
            onChange={handleDateChange}
            value={selectedDate}
            tileClassName={tileClassName}
            minDate={new Date()}
            className="w-full border rounded-lg"
          />
          
          {/* Appointment Type Selector */}
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Appointment Type
            </label>
            <select
              value={formData.appointmentType}
              onChange={handleInputChange}
              name="appointmentType"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {appointmentTypes.map(type => (
                <option key={type.value} value={type.value}>
                  {type.value} ({type.duration} min)
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Time Slots and Appointments */}
        <div>
          <h3 className="text-lg font-semibold text-gray-700 mb-3">
            {format(selectedDate, 'EEEE, MMMM d, yyyy')}
          </h3>

          {/* Existing Appointments */}
          {appointments.length > 0 && (
            <div className="mb-4">
              <h4 className="text-sm font-medium text-gray-600 mb-2">Scheduled Appointments</h4>
              <div className="space-y-2">
                {appointments.map(apt => (
                  <div key={apt.id} className="bg-blue-50 p-3 rounded-lg text-sm">
                    <div className="font-medium text-blue-900">
                      {format(new Date(apt.startTime), 'h:mm a')} - {apt.appointmentType}
                    </div>
                    <div className="text-gray-700">{apt.patientName}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Available Slots */}
          <div>
            <h4 className="text-sm font-medium text-gray-600 mb-2">Available Time Slots</h4>
            <div className="grid grid-cols-3 gap-2 max-h-64 overflow-y-auto">
              {availableSlots.map((slot, index) => (
                <button
                  key={index}
                  onClick={() => handleSlotSelect(slot)}
                  className={`py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                    selectedSlot === slot
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                  }`}
                >
                  {slot.display}
                </button>
              ))}
            </div>
            {availableSlots.length === 0 && (
              <p className="text-gray-500 text-sm">No available slots for this day</p>
            )}
          </div>
        </div>
      </div>

      {/* Booking Form */}
      {showBookingForm && selectedSlot && (
        <div className="mt-6 border-t pt-6">
          <h3 className="text-lg font-semibold text-gray-700 mb-4">
            Book Appointment for {selectedSlot.display}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <User className="w-4 h-4 inline mr-1" />
                  Patient Name *
                </label>
                <input
                  type="text"
                  name="patientName"
                  value={formData.patientName}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <Phone className="w-4 h-4 inline mr-1" />
                  Phone Number *
                </label>
                <input
                  type="tel"
                  name="patientPhone"
                  value={formData.patientPhone}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <Mail className="w-4 h-4 inline mr-1" />
                  Email
                </label>
                <input
                  type="email"
                  name="patientEmail"
                  value={formData.patientEmail}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <FileText className="w-4 h-4 inline mr-1" />
                  Notes
                </label>
                <textarea
                  name="notes"
                  value={formData.notes}
                  onChange={handleInputChange}
                  rows="2"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => {
                  setShowBookingForm(false);
                  setSelectedSlot(null);
                }}
                className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-white bg-blue-500 rounded-md hover:bg-blue-600"
              >
                Book Appointment
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default AppointmentCalendar;