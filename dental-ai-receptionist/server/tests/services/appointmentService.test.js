import { jest } from '@jest/globals';
import appointmentService from '../../services/appointmentService.js';
import Appointment from '../../models/Appointment.js';
import Patient from '../../models/Patient.js';
import emailService from '../../services/emailService.js';
import smsService from '../../services/smsService.js';

// Mock dependencies
jest.mock('../../models/Appointment.js');
jest.mock('../../models/Patient.js');
jest.mock('../../services/emailService.js');
jest.mock('../../services/smsService.js');

describe('AppointmentService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createAppointment', () => {
    it('should create a new appointment successfully', async () => {
      const mockPatient = {
        _id: 'patient123',
        email: 'patient@test.com',
        phoneNumber: '+1234567890',
        preferences: {
          notifications: {
            email: true,
            sms: true
          }
        }
      };

      const mockAppointment = {
        _id: 'apt123',
        patientId: 'patient123',
        dentistId: 'dentist123',
        dateTime: new Date('2024-03-15T10:00:00'),
        type: 'checkup',
        status: 'scheduled',
        save: jest.fn().mockResolvedValue(true)
      };

      Patient.findById.mockResolvedValue(mockPatient);
      Appointment.mockImplementation(() => mockAppointment);
      Appointment.findOne.mockResolvedValue(null); // No conflicts

      const result = await appointmentService.createAppointment({
        patientId: 'patient123',
        dentistId: 'dentist123',
        dateTime: '2024-03-15T10:00:00',
        type: 'checkup'
      });

      expect(result).toHaveProperty('_id', 'apt123');
      expect(Appointment.findOne).toHaveBeenCalledWith({
        dentistId: 'dentist123',
        dateTime: expect.any(Date),
        status: { $in: ['scheduled', 'confirmed'] }
      });
      expect(emailService.sendAppointmentConfirmation).toHaveBeenCalled();
      expect(smsService.sendAppointmentConfirmation).toHaveBeenCalled();
    });

    it('should throw error when appointment slot is already taken', async () => {
      Appointment.findOne.mockResolvedValue({ _id: 'existing' });

      await expect(appointmentService.createAppointment({
        patientId: 'patient123',
        dentistId: 'dentist123',
        dateTime: '2024-03-15T10:00:00',
        type: 'checkup'
      })).rejects.toThrow('Time slot already booked');
    });

    it('should handle appointment creation without notifications', async () => {
      const mockPatient = {
        _id: 'patient123',
        preferences: {
          notifications: {
            email: false,
            sms: false
          }
        }
      };

      Patient.findById.mockResolvedValue(mockPatient);
      Appointment.findOne.mockResolvedValue(null);
      Appointment.mockImplementation(() => ({
        save: jest.fn().mockResolvedValue(true)
      }));

      await appointmentService.createAppointment({
        patientId: 'patient123',
        dentistId: 'dentist123',
        dateTime: '2024-03-15T10:00:00',
        type: 'checkup'
      });

      expect(emailService.sendAppointmentConfirmation).not.toHaveBeenCalled();
      expect(smsService.sendAppointmentConfirmation).not.toHaveBeenCalled();
    });
  });

  describe('cancelAppointment', () => {
    it('should cancel appointment successfully', async () => {
      const mockAppointment = {
        _id: 'apt123',
        status: 'scheduled',
        patientId: { email: 'patient@test.com' },
        save: jest.fn().mockResolvedValue(true),
        populate: jest.fn().mockReturnThis()
      };

      Appointment.findById.mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockAppointment)
      });

      const result = await appointmentService.cancelAppointment('apt123', 'Patient request');

      expect(result.status).toBe('cancelled');
      expect(result.cancellationReason).toBe('Patient request');
      expect(mockAppointment.save).toHaveBeenCalled();
    });

    it('should throw error when appointment not found', async () => {
      Appointment.findById.mockReturnValue({
        populate: jest.fn().mockResolvedValue(null)
      });

      await expect(appointmentService.cancelAppointment('nonexistent'))
        .rejects.toThrow('Appointment not found');
    });

    it('should throw error when appointment already cancelled', async () => {
      const mockAppointment = {
        _id: 'apt123',
        status: 'cancelled'
      };

      Appointment.findById.mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockAppointment)
      });

      await expect(appointmentService.cancelAppointment('apt123'))
        .rejects.toThrow('Appointment is already cancelled');
    });
  });

  describe('rescheduleAppointment', () => {
    it('should reschedule appointment successfully', async () => {
      const mockAppointment = {
        _id: 'apt123',
        status: 'scheduled',
        dateTime: new Date('2024-03-15T10:00:00'),
        dentistId: 'dentist123',
        save: jest.fn().mockResolvedValue(true)
      };

      Appointment.findById.mockResolvedValue(mockAppointment);
      Appointment.findOne.mockResolvedValue(null); // No conflicts

      const newDateTime = new Date('2024-03-20T14:00:00');
      const result = await appointmentService.rescheduleAppointment('apt123', newDateTime);

      expect(result.dateTime).toEqual(newDateTime);
      expect(result.status).toBe('rescheduled');
      expect(mockAppointment.save).toHaveBeenCalled();
    });

    it('should throw error when new time slot is taken', async () => {
      const mockAppointment = {
        _id: 'apt123',
        status: 'scheduled',
        dentistId: 'dentist123'
      };

      Appointment.findById.mockResolvedValue(mockAppointment);
      Appointment.findOne.mockResolvedValue({ _id: 'conflict' });

      await expect(appointmentService.rescheduleAppointment(
        'apt123',
        new Date('2024-03-20T14:00:00')
      )).rejects.toThrow('New time slot is already booked');
    });
  });

  describe('getAvailableSlots', () => {
    it('should return available time slots', async () => {
      const bookedAppointments = [
        { dateTime: new Date('2024-03-15T10:00:00') },
        { dateTime: new Date('2024-03-15T14:00:00') }
      ];

      Appointment.find.mockResolvedValue(bookedAppointments);

      const slots = await appointmentService.getAvailableSlots(
        'dentist123',
        new Date('2024-03-15')
      );

      expect(slots).toBeInstanceOf(Array);
      expect(slots.length).toBeGreaterThan(0);
      expect(Appointment.find).toHaveBeenCalledWith({
        dentistId: 'dentist123',
        dateTime: {
          $gte: expect.any(Date),
          $lt: expect.any(Date)
        },
        status: { $in: ['scheduled', 'confirmed'] }
      });
    });

    it('should exclude lunch hours from available slots', async () => {
      Appointment.find.mockResolvedValue([]);

      const slots = await appointmentService.getAvailableSlots(
        'dentist123',
        new Date('2024-03-15')
      );

      const lunchSlots = slots.filter(slot => {
        const hour = new Date(slot).getHours();
        return hour >= 12 && hour < 13;
      });

      expect(lunchSlots).toHaveLength(0);
    });
  });

  describe('sendReminders', () => {
    it('should send reminders for upcoming appointments', async () => {
      const mockAppointments = [
        {
          _id: 'apt1',
          patientId: {
            email: 'patient1@test.com',
            phoneNumber: '+1234567890',
            preferences: { notifications: { email: true, sms: true } }
          },
          dateTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
          reminderSent: false,
          save: jest.fn().mockResolvedValue(true)
        },
        {
          _id: 'apt2',
          patientId: {
            email: 'patient2@test.com',
            preferences: { notifications: { email: true, sms: false } }
          },
          dateTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
          reminderSent: false,
          save: jest.fn().mockResolvedValue(true)
        }
      ];

      Appointment.find.mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockAppointments)
      });

      const result = await appointmentService.sendReminders();

      expect(result.sent).toBe(2);
      expect(emailService.sendReminder).toHaveBeenCalledTimes(2);
      expect(smsService.sendReminder).toHaveBeenCalledTimes(1);
      expect(mockAppointments[0].reminderSent).toBe(true);
      expect(mockAppointments[1].reminderSent).toBe(true);
    });

    it('should not send reminders for appointments already reminded', async () => {
      const mockAppointments = [
        {
          _id: 'apt1',
          reminderSent: true
        }
      ];

      Appointment.find.mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockAppointments)
      });

      const result = await appointmentService.sendReminders();

      expect(result.sent).toBe(0);
      expect(emailService.sendReminder).not.toHaveBeenCalled();
    });
  });

  describe('checkForConflicts', () => {
    it('should detect scheduling conflicts', async () => {
      Appointment.findOne.mockResolvedValue({ _id: 'conflict' });

      const hasConflict = await appointmentService.checkForConflicts(
        'dentist123',
        new Date('2024-03-15T10:00:00')
      );

      expect(hasConflict).toBe(true);
    });

    it('should return false when no conflicts', async () => {
      Appointment.findOne.mockResolvedValue(null);

      const hasConflict = await appointmentService.checkForConflicts(
        'dentist123',
        new Date('2024-03-15T10:00:00')
      );

      expect(hasConflict).toBe(false);
    });
  });
});