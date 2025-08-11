import React, { useState, useEffect, useMemo } from 'react';
// Removed framer-motion to fix flashing issues
import {
  Calendar, Clock, Users, Settings, Plus, Minus,
  Save, RefreshCw, AlertCircle, CheckCircle, XCircle,
  Coffee, Sun, Moon, Sunrise, Sunset, Lock, Unlock,
  Edit, Trash2, Copy, ChevronLeft, ChevronRight,
  ToggleLeft, ToggleRight, Info, CalendarOff
} from 'lucide-react';
import { format, addDays, startOfWeek, endOfWeek, eachDayOfInterval, 
         isSameDay, isToday, isPast, addWeeks, subWeeks } from 'date-fns';
import apiService from '../services/apiService';

const AdminSchedulePortal = () => {
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [scheduleData, setScheduleData] = useState({});
  const [selectedDate, setSelectedDate] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null);
  const [dentists, setDentists] = useState([]);
  const [selectedDentist, setSelectedDentist] = useState('all');
  const [editMode, setEditMode] = useState(false);

  // Default working hours template
  const [defaultSchedule, setDefaultSchedule] = useState({
    monday: { enabled: true, start: '09:00', end: '17:00', lunch: { start: '12:00', end: '13:00' }, slots: [] },
    tuesday: { enabled: true, start: '09:00', end: '17:00', lunch: { start: '12:00', end: '13:00' }, slots: [] },
    wednesday: { enabled: true, start: '09:00', end: '17:00', lunch: { start: '12:00', end: '13:00' }, slots: [] },
    thursday: { enabled: true, start: '09:00', end: '17:00', lunch: { start: '12:00', end: '13:00' }, slots: [] },
    friday: { enabled: true, start: '09:00', end: '17:00', lunch: { start: '12:00', end: '13:00' }, slots: [] },
    saturday: { enabled: false, start: '09:00', end: '13:00', lunch: null, slots: [] },
    sunday: { enabled: false, start: '09:00', end: '13:00', lunch: null, slots: [] }
  });

  const [holidays, setHolidays] = useState([]);
  const [specialHours, setSpecialHours] = useState([]);
  const [blockedSlots, setBlockedSlots] = useState({});

  const timeSlotDurations = [15, 30, 45, 60, 90, 120];

  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      loadScheduleData();
    }, 300);
    return () => clearTimeout(debounceTimer);
  }, [currentWeek, selectedDentist]);

  useEffect(() => {
    loadDentists();
    loadHolidays();
  }, []);

  const loadScheduleData = async () => {
    setLoading(true);
    try {
      const weekStart = startOfWeek(currentWeek);
      const weekEnd = endOfWeek(currentWeek);
      
      const response = await apiService.getSchedule({
        startDate: format(weekStart, 'yyyy-MM-dd'),
        endDate: format(weekEnd, 'yyyy-MM-dd'),
        dentistId: selectedDentist
      });

      setScheduleData(response.schedule || {});
      setBlockedSlots(response.blockedSlots || {});
      setSpecialHours(response.specialHours || []);
    } catch (error) {
      console.error('Failed to load schedule:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadDentists = async () => {
    try {
      const response = await apiService.getDentists();
      setDentists(response || []);
    } catch (error) {
      console.error('Failed to load dentists:', error);
    }
  };

  const loadHolidays = async () => {
    try {
      const response = await apiService.getHolidays();
      setHolidays(response || []);
    } catch (error) {
      console.error('Failed to load holidays:', error);
    }
  };

  const generateTimeSlots = (startTime, endTime, duration = 30, excludeLunch = true) => {
    const slots = [];
    const [startHour, startMin] = startTime.split(':').map(Number);
    const [endHour, endMin] = endTime.split(':').map(Number);
    
    let currentHour = startHour;
    let currentMin = startMin;

    while (currentHour < endHour || (currentHour === endHour && currentMin < endMin)) {
      const timeString = `${String(currentHour).padStart(2, '0')}:${String(currentMin).padStart(2, '0')}`;
      
      // Check if this is during lunch time
      if (excludeLunch && defaultSchedule.monday.lunch) {
        const [lunchStartHour, lunchStartMin] = defaultSchedule.monday.lunch.start.split(':').map(Number);
        const [lunchEndHour, lunchEndMin] = defaultSchedule.monday.lunch.end.split(':').map(Number);
        
        const isLunchTime = (currentHour > lunchStartHour || (currentHour === lunchStartHour && currentMin >= lunchStartMin)) &&
                           (currentHour < lunchEndHour || (currentHour === lunchEndHour && currentMin < lunchEndMin));
        
        if (!isLunchTime) {
          slots.push({
            time: timeString,
            available: true,
            duration: duration
          });
        }
      } else {
        slots.push({
          time: timeString,
          available: true,
          duration: duration
        });
      }

      // Increment time
      currentMin += duration;
      if (currentMin >= 60) {
        currentHour += Math.floor(currentMin / 60);
        currentMin = currentMin % 60;
      }
    }

    return slots;
  };

  const toggleSlotAvailability = (date, time, dentistId = null) => {
    const dateKey = format(date, 'yyyy-MM-dd');
    const slotKey = dentistId ? `${dateKey}-${dentistId}` : dateKey;

    setBlockedSlots(prev => {
      const updated = { ...prev };
      if (!updated[slotKey]) {
        updated[slotKey] = [];
      }

      const slotIndex = updated[slotKey].indexOf(time);
      if (slotIndex > -1) {
        updated[slotKey].splice(slotIndex, 1);
      } else {
        updated[slotKey].push(time);
      }

      return updated;
    });
  };

  const saveScheduleChanges = async () => {
    setSaveStatus('saving');
    try {
      await apiService.updateSchedule({
        schedule: scheduleData,
        blockedSlots: blockedSlots,
        specialHours: specialHours,
        defaultSchedule: defaultSchedule
      });

      setSaveStatus('saved');
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (error) {
      console.error('Failed to save schedule:', error);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus(null), 3000);
    }
  };

  const applyTemplateToWeek = () => {
    const weekDays = eachDayOfInterval({
      start: startOfWeek(currentWeek),
      end: endOfWeek(currentWeek)
    });

    const newScheduleData = {};
    
    weekDays.forEach(day => {
      const dayName = format(day, 'EEEE').toLowerCase();
      const daySchedule = defaultSchedule[dayName];
      
      if (daySchedule && daySchedule.enabled) {
        const dateKey = format(day, 'yyyy-MM-dd');
        newScheduleData[dateKey] = {
          ...daySchedule,
          slots: generateTimeSlots(daySchedule.start, daySchedule.end)
        };
      }
    });

    setScheduleData(newScheduleData);
  };

  const addHoliday = (date, name) => {
    const holiday = {
      date: format(date, 'yyyy-MM-dd'),
      name: name,
      closed: true
    };

    setHolidays(prev => [...prev, holiday]);
    
    // Block all slots for this day
    const dateKey = format(date, 'yyyy-MM-dd');
    setScheduleData(prev => ({
      ...prev,
      [dateKey]: { enabled: false, closed: true, reason: name }
    }));
  };

  const addSpecialHours = (date, startTime, endTime, reason) => {
    const special = {
      date: format(date, 'yyyy-MM-dd'),
      start: startTime,
      end: endTime,
      reason: reason
    };

    setSpecialHours(prev => [...prev, special]);
    
    // Update schedule for this day
    const dateKey = format(date, 'yyyy-MM-dd');
    setScheduleData(prev => ({
      ...prev,
      [dateKey]: {
        ...prev[dateKey],
        start: startTime,
        end: endTime,
        special: true,
        reason: reason,
        slots: generateTimeSlots(startTime, endTime)
      }
    }));
  };

  const WeekView = () => {
    const weekDays = eachDayOfInterval({
      start: startOfWeek(currentWeek),
      end: endOfWeek(currentWeek)
    });

    return (
      <div className="bg-white rounded-lg shadow-lg p-6">
        {/* Week Navigation */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => setCurrentWeek(subWeeks(currentWeek, 1))}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          
          <h2 className="text-xl font-semibold">
            {format(weekDays[0], 'MMM d')} - {format(weekDays[6], 'MMM d, yyyy')}
          </h2>
          
          <button
            onClick={() => setCurrentWeek(addWeeks(currentWeek, 1))}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* Days Grid */}
        <div className="grid grid-cols-7 gap-4">
          {weekDays.map(day => {
            const dateKey = format(day, 'yyyy-MM-dd');
            const daySchedule = scheduleData[dateKey];
            const isHoliday = holidays.some(h => h.date === dateKey);
            const hasSpecialHours = specialHours.some(s => s.date === dateKey);
            const dayName = format(day, 'EEEE').toLowerCase();
            const defaultDaySchedule = defaultSchedule[dayName];

            return (
              <div
                key={dateKey}
                className={`border rounded-lg p-3 cursor-pointer transition-colors hover:shadow-md ${
                  isToday(day) ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                } ${selectedDate && isSameDay(day, selectedDate) ? 'ring-2 ring-blue-500' : ''}
                ${isPast(day) && !isToday(day) ? 'opacity-50' : ''}
                ${isHoliday ? 'bg-red-50' : ''}
                ${hasSpecialHours ? 'bg-yellow-50' : ''}`}
                onClick={() => setSelectedDate(day)}
              >
                <div className="text-center mb-2">
                  <p className="text-xs text-gray-500">{format(day, 'EEE')}</p>
                  <p className={`text-lg font-semibold ${isToday(day) ? 'text-blue-600' : ''}`}>
                    {format(day, 'd')}
                  </p>
                </div>

                {isHoliday ? (
                  <div className="text-center">
                    <CalendarOff className="w-5 h-5 text-red-500 mx-auto mb-1" />
                    <p className="text-xs text-red-600">Holiday</p>
                  </div>
                ) : daySchedule?.enabled !== false && defaultDaySchedule?.enabled ? (
                  <div className="space-y-1">
                    <div className="flex items-center justify-center text-xs">
                      <Clock className="w-3 h-3 mr-1 text-gray-400" />
                      <span className="text-gray-600">
                        {daySchedule?.start || defaultDaySchedule.start} - {daySchedule?.end || defaultDaySchedule.end}
                      </span>
                    </div>
                    {hasSpecialHours && (
                      <p className="text-xs text-yellow-600 text-center">Special Hours</p>
                    )}
                    <div className="text-center">
                      <p className="text-xs text-green-600">
                        {daySchedule?.slots?.filter(s => s.available).length || 
                         generateTimeSlots(
                           daySchedule?.start || defaultDaySchedule.start, 
                           daySchedule?.end || defaultDaySchedule.end,
                           30,
                           true
                         ).length} slots
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="text-center">
                    <Lock className="w-5 h-5 text-gray-400 mx-auto mb-1" />
                    <p className="text-xs text-gray-500">Closed</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const DayDetailView = () => {
    if (!selectedDate) return null;

    const dateKey = format(selectedDate, 'yyyy-MM-dd');
    const daySchedule = scheduleData[dateKey];
    const dayName = format(selectedDate, 'EEEE').toLowerCase();
    const defaultDaySchedule = defaultSchedule[dayName];
    const dayBlockedSlots = blockedSlots[dateKey] || [];

    const slots = daySchedule?.slots || 
                  (defaultDaySchedule?.enabled ? 
                    generateTimeSlots(defaultDaySchedule.start, defaultDaySchedule.end) : []);

    return (
      <div
        className="bg-white rounded-lg shadow-lg p-6"
      >
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold">
            {format(selectedDate, 'EEEE, MMMM d, yyyy')}
          </h3>
          <div className="flex space-x-2">
            {editMode ? (
              <>
                <button
                  onClick={() => {
                    saveScheduleChanges();
                    setEditMode(false);
                  }}
                  className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors flex items-center"
                >
                  <Save className="w-4 h-4 mr-2" />
                  Save
                </button>
                <button
                  onClick={() => setEditMode(false)}
                  className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                onClick={() => setEditMode(true)}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center"
              >
                <Edit className="w-4 h-4 mr-2" />
                Edit
              </button>
            )}
          </div>
        </div>

        {editMode ? (
          <div className="space-y-4">
            {/* Working Hours */}
            <div className="flex items-center space-x-4">
              <label className="text-sm font-medium text-gray-700 w-24">Working:</label>
              <input
                type="time"
                value={daySchedule?.start || defaultDaySchedule?.start || '09:00'}
                onChange={(e) => {
                  setScheduleData(prev => ({
                    ...prev,
                    [dateKey]: {
                      ...prev[dateKey],
                      start: e.target.value,
                      slots: generateTimeSlots(e.target.value, daySchedule?.end || defaultDaySchedule?.end || '17:00')
                    }
                  }));
                }}
                className="px-3 py-2 border border-gray-300 rounded-lg"
              />
              <span>to</span>
              <input
                type="time"
                value={daySchedule?.end || defaultDaySchedule?.end || '17:00'}
                onChange={(e) => {
                  setScheduleData(prev => ({
                    ...prev,
                    [dateKey]: {
                      ...prev[dateKey],
                      end: e.target.value,
                      slots: generateTimeSlots(daySchedule?.start || defaultDaySchedule?.start || '09:00', e.target.value)
                    }
                  }));
                }}
                className="px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>

            {/* Lunch Break */}
            <div className="flex items-center space-x-4">
              <label className="text-sm font-medium text-gray-700 w-24">Lunch:</label>
              <input
                type="time"
                value={daySchedule?.lunch?.start || defaultDaySchedule?.lunch?.start || '12:00'}
                onChange={(e) => {
                  setScheduleData(prev => ({
                    ...prev,
                    [dateKey]: {
                      ...prev[dateKey],
                      lunch: {
                        ...prev[dateKey]?.lunch,
                        start: e.target.value
                      }
                    }
                  }));
                }}
                className="px-3 py-2 border border-gray-300 rounded-lg"
              />
              <span>to</span>
              <input
                type="time"
                value={daySchedule?.lunch?.end || defaultDaySchedule?.lunch?.end || '13:00'}
                onChange={(e) => {
                  setScheduleData(prev => ({
                    ...prev,
                    [dateKey]: {
                      ...prev[dateKey],
                      lunch: {
                        ...prev[dateKey]?.lunch,
                        end: e.target.value
                      }
                    }
                  }));
                }}
                className="px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>

            {/* Special Options */}
            <div className="flex items-center space-x-4">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={daySchedule?.enabled !== false}
                  onChange={(e) => {
                    setScheduleData(prev => ({
                      ...prev,
                      [dateKey]: {
                        ...prev[dateKey],
                        enabled: e.target.checked
                      }
                    }));
                  }}
                  className="mr-2"
                />
                <span className="text-sm">Office Open</span>
              </label>

              <button
                onClick={() => addHoliday(selectedDate, prompt('Holiday name:'))}
                className="px-3 py-1 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors text-sm"
              >
                Mark as Holiday
              </button>

              <button
                onClick={() => {
                  const start = prompt('Special hours start time (HH:MM):');
                  const end = prompt('Special hours end time (HH:MM):');
                  const reason = prompt('Reason for special hours:');
                  if (start && end) {
                    addSpecialHours(selectedDate, start, end, reason);
                  }
                }}
                className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-lg hover:bg-yellow-200 transition-colors text-sm"
              >
                Set Special Hours
              </button>
            </div>
          </div>
        ) : (
          <div className="text-sm text-gray-600 mb-4">
            <p>Working Hours: {daySchedule?.start || defaultDaySchedule?.start} - {daySchedule?.end || defaultDaySchedule?.end}</p>
            {(daySchedule?.lunch || defaultDaySchedule?.lunch) && (
              <p>Lunch Break: {daySchedule?.lunch?.start || defaultDaySchedule?.lunch?.start} - {daySchedule?.lunch?.end || defaultDaySchedule?.lunch?.end}</p>
            )}
          </div>
        )}

        {/* Time Slots Grid */}
        <div className="mt-6">
          <h4 className="text-sm font-medium text-gray-700 mb-3">Available Time Slots</h4>
          <div className="grid grid-cols-6 gap-2">
            {slots.map((slot) => {
              const isBlocked = dayBlockedSlots.includes(slot.time);
              const isPastTime = isPast(selectedDate) && !isToday(selectedDate);

              return (
                <button
                  key={slot.time}
                  onClick={() => editMode && toggleSlotAvailability(selectedDate, slot.time)}
                  disabled={!editMode || isPastTime}
                  className={`p-2 rounded-lg text-sm font-medium transition-colors ${
                    isBlocked 
                      ? 'bg-red-100 text-red-700 line-through' 
                      : 'bg-green-100 text-green-700'
                  } ${editMode && !isPastTime ? 'hover:opacity-90 cursor-pointer' : 'cursor-default'}
                  ${isPastTime ? 'opacity-50' : ''}`}
                >
                  {slot.time}
                  {isBlocked && <Lock className="w-3 h-3 inline ml-1" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Quick Actions */}
        {editMode && (
          <div className="mt-6 flex space-x-2">
            <button
              onClick={() => {
                const dateKey = format(selectedDate, 'yyyy-MM-dd');
                setBlockedSlots(prev => ({
                  ...prev,
                  [dateKey]: slots.map(s => s.time)
                }));
              }}
              className="px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-sm"
            >
              Block All Slots
            </button>
            <button
              onClick={() => {
                const dateKey = format(selectedDate, 'yyyy-MM-dd');
                setBlockedSlots(prev => ({
                  ...prev,
                  [dateKey]: []
                }));
              }}
              className="px-3 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-sm"
            >
              Unblock All Slots
            </button>
          </div>
        )}
      </div>
    );
  };

  const TemplateSettings = () => (
    <div>
      <h3 className="text-lg font-semibold mb-4">Default Schedule Template</h3>
      
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Day</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Working Hours</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Lunch Break</th>
              <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">Slots</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {Object.entries(defaultSchedule).map(([day, schedule]) => (
              <tr key={day} className={!schedule.enabled ? 'opacity-50' : ''}>
                <td className="px-3 py-3">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={schedule.enabled}
                      onChange={(e) => {
                        setDefaultSchedule(prev => ({
                          ...prev,
                          [day]: { ...prev[day], enabled: e.target.checked }
                        }));
                      }}
                      className="mr-2"
                    />
                    <span className="capitalize font-medium text-sm">{day}</span>
                  </label>
                </td>
                <td className="px-3 py-3">
                  {schedule.enabled ? (
                    <div className="flex items-center space-x-1">
                      <input
                        type="time"
                        value={schedule.start}
                        onChange={(e) => {
                          setDefaultSchedule(prev => ({
                            ...prev,
                            [day]: { ...prev[day], start: e.target.value }
                          }));
                        }}
                        className="px-2 py-1 border border-gray-300 rounded text-sm"
                      />
                      <span className="text-sm">-</span>
                      <input
                        type="time"
                        value={schedule.end}
                        onChange={(e) => {
                          setDefaultSchedule(prev => ({
                            ...prev,
                            [day]: { ...prev[day], end: e.target.value }
                          }));
                        }}
                        className="px-2 py-1 border border-gray-300 rounded text-sm"
                      />
                    </div>
                  ) : (
                    <span className="text-sm text-gray-400">Closed</span>
                  )}
                </td>
                <td className="px-3 py-3">
                  {schedule.enabled && schedule.lunch ? (
                    <div className="flex items-center space-x-1">
                      <Coffee className="w-4 h-4 text-gray-400" />
                      <input
                        type="time"
                        value={schedule.lunch.start}
                        onChange={(e) => {
                          setDefaultSchedule(prev => ({
                            ...prev,
                            [day]: { 
                              ...prev[day], 
                              lunch: { ...prev[day].lunch, start: e.target.value }
                            }
                          }));
                        }}
                        className="px-2 py-1 border border-gray-300 rounded text-sm"
                      />
                      <span className="text-sm">-</span>
                      <input
                        type="time"
                        value={schedule.lunch.end}
                        onChange={(e) => {
                          setDefaultSchedule(prev => ({
                            ...prev,
                            [day]: { 
                              ...prev[day], 
                              lunch: { ...prev[day].lunch, end: e.target.value }
                            }
                          }));
                        }}
                        className="px-2 py-1 border border-gray-300 rounded text-sm"
                      />
                    </div>
                  ) : (
                    <span className="text-sm text-gray-400">-</span>
                  )}
                </td>
                <td className="px-3 py-3 text-center">
                  <span className="text-sm font-medium text-green-600">
                    {schedule.enabled ? generateTimeSlots(schedule.start, schedule.end, 30, true).length : 0}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6 flex space-x-3">
        <button
          onClick={applyTemplateToWeek}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
        >
          Apply to Current Week
        </button>
        <button
          onClick={saveScheduleChanges}
          className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
        >
          Save Template
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800">Schedule Management Portal</h1>
        <p className="text-gray-600 mt-2">Manage appointment slots, working hours, and availability</p>
      </div>

      {/* Status Bar */}
      {saveStatus && (
        <div
          className={`mb-4 p-4 rounded-lg flex items-center transition-opacity ${
            saveStatus === 'saving' ? 'bg-blue-100 text-blue-700' :
            saveStatus === 'saved' ? 'bg-green-100 text-green-700' :
            'bg-red-100 text-red-700'
          }`}
        >
          {saveStatus === 'saving' && <RefreshCw className="w-5 h-5 mr-2 animate-spin" />}
          {saveStatus === 'saved' && <CheckCircle className="w-5 h-5 mr-2" />}
          {saveStatus === 'error' && <XCircle className="w-5 h-5 mr-2" />}
          <span>
            {saveStatus === 'saving' ? 'Saving changes...' :
             saveStatus === 'saved' ? 'Changes saved successfully!' :
             'Error saving changes. Please try again.'}
          </span>
        </div>
      )}

      {/* Dentist Filter */}
      <div className="mb-6 bg-white rounded-lg shadow p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <label className="text-sm font-medium text-gray-700">View Schedule For:</label>
            <select
              value={selectedDentist}
              onChange={(e) => setSelectedDentist(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Dentists</option>
              {dentists.map(dentist => (
                <option key={dentist.id} value={dentist.id}>
                  Dr. {dentist.name}
                </option>
              ))}
            </select>
          </div>
          
          <div className="flex space-x-2">
            <button
              onClick={() => setCurrentWeek(new Date())}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Today
            </button>
            <button
              onClick={loadScheduleData}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="space-y-6">
        {/* Week View */}
        <WeekView />
        
        {/* Day Detail View - shown when a date is selected */}
        {selectedDate && <DayDetailView />}
        
        {/* Bottom Section - Template Settings */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <TemplateSettings />
        </div>
        
        {/* Holidays Section - Full width but with max height */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h3 className="text-lg font-semibold mb-4">Upcoming Holidays</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {holidays.length === 0 ? (
              <p className="text-sm text-gray-500 col-span-full">No holidays scheduled</p>
            ) : (
              holidays.map((holiday, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{holiday.name}</p>
                    <p className="text-xs text-gray-600">{holiday.date}</p>
                  </div>
                  <button
                    onClick={() => setHolidays(prev => prev.filter((_, i) => i !== index))}
                    className="ml-2 text-red-600 hover:text-red-700 flex-shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminSchedulePortal;