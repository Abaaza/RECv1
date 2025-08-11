const request = require('supertest');
const app = require('../server');
const User = require('../models/User');
const Appointment = require('../models/Appointment');

describe('Appointment Endpoints', () => {
  let authToken;
  let patientId;
  let dentistId;

  beforeEach(async () => {
    const patient = new User(global.testPatient);
    patient.password = await patient.hashPassword(global.testPatient.password);
    await patient.save();
    patientId = patient._id;

    const dentist = new User(global.testDentist);
    dentist.password = await dentist.hashPassword(global.testDentist.password);
    await dentist.save();
    dentistId = dentist._id;

    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: global.testPatient.email,
        password: global.testPatient.password
      });

    authToken = res.body.token;
  });

  describe('POST /api/appointments', () => {
    it('should create a new appointment', async () => {
      const appointmentData = {
        patientId: patientId.toString(),
        dentistId: dentistId.toString(),
        date: new Date(Date.now() + 86400000).toISOString(),
        time: '10:00',
        duration: 30,
        type: 'checkup',
        reason: 'Regular checkup'
      };

      const res = await request(app)
        .post('/api/appointments')
        .set('Authorization', `Bearer ${authToken}`)
        .send(appointmentData);

      expect(res.statusCode).toBe(201);
      expect(res.body).toHaveProperty('_id');
      expect(res.body.type).toBe('checkup');
      expect(res.body.status).toBe('scheduled');
    });

    it('should not create appointment in the past', async () => {
      const appointmentData = {
        patientId: patientId.toString(),
        dentistId: dentistId.toString(),
        date: new Date(Date.now() - 86400000).toISOString(),
        time: '10:00',
        duration: 30,
        type: 'checkup'
      };

      const res = await request(app)
        .post('/api/appointments')
        .set('Authorization', `Bearer ${authToken}`)
        .send(appointmentData);

      expect(res.statusCode).toBe(400);
      expect(res.body).toHaveProperty('error');
    });

    it('should not create overlapping appointments', async () => {
      const appointmentTime = new Date(Date.now() + 86400000);
      
      const firstAppointment = new Appointment({
        patientId: patientId,
        dentistId: dentistId,
        date: appointmentTime,
        time: '10:00',
        duration: 30,
        type: 'checkup',
        status: 'scheduled'
      });
      await firstAppointment.save();

      const res = await request(app)
        .post('/api/appointments')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          patientId: patientId.toString(),
          dentistId: dentistId.toString(),
          date: appointmentTime.toISOString(),
          time: '10:15',
          duration: 30,
          type: 'cleaning'
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.error).toContain('overlap');
    });

    it('should validate appointment type', async () => {
      const res = await request(app)
        .post('/api/appointments')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          patientId: patientId.toString(),
          dentistId: dentistId.toString(),
          date: new Date(Date.now() + 86400000).toISOString(),
          time: '10:00',
          duration: 30,
          type: 'invalid-type'
        });

      expect(res.statusCode).toBe(400);
      expect(res.body).toHaveProperty('error');
    });
  });

  describe('GET /api/appointments', () => {
    beforeEach(async () => {
      const appointments = [
        {
          patientId: patientId,
          dentistId: dentistId,
          date: new Date(Date.now() + 86400000),
          time: '09:00',
          duration: 30,
          type: 'checkup',
          status: 'scheduled'
        },
        {
          patientId: patientId,
          dentistId: dentistId,
          date: new Date(Date.now() + 172800000),
          time: '14:00',
          duration: 60,
          type: 'cleaning',
          status: 'scheduled'
        },
        {
          patientId: patientId,
          dentistId: dentistId,
          date: new Date(Date.now() - 86400000),
          time: '11:00',
          duration: 30,
          type: 'checkup',
          status: 'completed'
        }
      ];

      await Appointment.insertMany(appointments);
    });

    it('should get all appointments for authenticated user', async () => {
      const res = await request(app)
        .get('/api/appointments')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
    });

    it('should filter appointments by date range', async () => {
      const startDate = new Date().toISOString();
      const endDate = new Date(Date.now() + 259200000).toISOString();

      const res = await request(app)
        .get('/api/appointments')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ startDate, endDate });

      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      res.body.forEach(appointment => {
        const appointmentDate = new Date(appointment.date);
        expect(appointmentDate >= new Date(startDate)).toBe(true);
        expect(appointmentDate <= new Date(endDate)).toBe(true);
      });
    });

    it('should filter appointments by status', async () => {
      const res = await request(app)
        .get('/api/appointments')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ status: 'scheduled' });

      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      res.body.forEach(appointment => {
        expect(appointment.status).toBe('scheduled');
      });
    });

    it('should not get appointments without authentication', async () => {
      const res = await request(app)
        .get('/api/appointments');

      expect(res.statusCode).toBe(401);
      expect(res.body).toHaveProperty('error');
    });
  });

  describe('GET /api/appointments/:id', () => {
    let appointmentId;

    beforeEach(async () => {
      const appointment = new Appointment({
        patientId: patientId,
        dentistId: dentistId,
        date: new Date(Date.now() + 86400000),
        time: '10:00',
        duration: 30,
        type: 'checkup',
        status: 'scheduled'
      });
      await appointment.save();
      appointmentId = appointment._id;
    });

    it('should get appointment by id', async () => {
      const res = await request(app)
        .get(`/api/appointments/${appointmentId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body._id).toBe(appointmentId.toString());
      expect(res.body.type).toBe('checkup');
    });

    it('should not get appointment with invalid id', async () => {
      const res = await request(app)
        .get('/api/appointments/invalidid123')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(400);
      expect(res.body).toHaveProperty('error');
    });

    it('should not get non-existent appointment', async () => {
      const fakeId = '507f1f77bcf86cd799439011';
      const res = await request(app)
        .get(`/api/appointments/${fakeId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(404);
      expect(res.body).toHaveProperty('error');
    });
  });

  describe('PUT /api/appointments/:id', () => {
    let appointmentId;

    beforeEach(async () => {
      const appointment = new Appointment({
        patientId: patientId,
        dentistId: dentistId,
        date: new Date(Date.now() + 86400000),
        time: '10:00',
        duration: 30,
        type: 'checkup',
        status: 'scheduled'
      });
      await appointment.save();
      appointmentId = appointment._id;
    });

    it('should update appointment', async () => {
      const updates = {
        time: '14:00',
        duration: 60,
        reason: 'Updated reason for appointment'
      };

      const res = await request(app)
        .put(`/api/appointments/${appointmentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updates);

      expect(res.statusCode).toBe(200);
      expect(res.body.time).toBe('14:00');
      expect(res.body.duration).toBe(60);
      expect(res.body.reason).toBe('Updated reason for appointment');
    });

    it('should update appointment status', async () => {
      const res = await request(app)
        .put(`/api/appointments/${appointmentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'confirmed' });

      expect(res.statusCode).toBe(200);
      expect(res.body.status).toBe('confirmed');
    });

    it('should not update to invalid status', async () => {
      const res = await request(app)
        .put(`/api/appointments/${appointmentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'invalid-status' });

      expect(res.statusCode).toBe(400);
      expect(res.body).toHaveProperty('error');
    });

    it('should not update completed appointment', async () => {
      await Appointment.findByIdAndUpdate(appointmentId, { status: 'completed' });

      const res = await request(app)
        .put(`/api/appointments/${appointmentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ time: '15:00' });

      expect(res.statusCode).toBe(400);
      expect(res.body.error).toContain('completed');
    });
  });

  describe('DELETE /api/appointments/:id', () => {
    let appointmentId;

    beforeEach(async () => {
      const appointment = new Appointment({
        patientId: patientId,
        dentistId: dentistId,
        date: new Date(Date.now() + 86400000),
        time: '10:00',
        duration: 30,
        type: 'checkup',
        status: 'scheduled'
      });
      await appointment.save();
      appointmentId = appointment._id;
    });

    it('should cancel appointment', async () => {
      const res = await request(app)
        .delete(`/api/appointments/${appointmentId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.status).toBe('cancelled');
    });

    it('should not cancel appointment less than 24 hours before', async () => {
      const appointment = new Appointment({
        patientId: patientId,
        dentistId: dentistId,
        date: new Date(Date.now() + 3600000),
        time: '10:00',
        duration: 30,
        type: 'checkup',
        status: 'scheduled'
      });
      await appointment.save();

      const res = await request(app)
        .delete(`/api/appointments/${appointment._id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(400);
      expect(res.body.error).toContain('24 hours');
    });

    it('should not cancel already cancelled appointment', async () => {
      await Appointment.findByIdAndUpdate(appointmentId, { status: 'cancelled' });

      const res = await request(app)
        .delete(`/api/appointments/${appointmentId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(400);
      expect(res.body.error).toContain('already cancelled');
    });
  });

  describe('GET /api/appointments/available-slots', () => {
    it('should get available time slots', async () => {
      const date = new Date(Date.now() + 86400000).toISOString().split('T')[0];

      const res = await request(app)
        .get('/api/appointments/available-slots')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ 
          date,
          dentistId: dentistId.toString(),
          duration: 30
        });

      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body.slots)).toBe(true);
      expect(res.body.slots.length).toBeGreaterThan(0);
    });

    it('should exclude booked slots', async () => {
      const date = new Date(Date.now() + 86400000);
      
      const appointment = new Appointment({
        patientId: patientId,
        dentistId: dentistId,
        date: date,
        time: '10:00',
        duration: 30,
        type: 'checkup',
        status: 'scheduled'
      });
      await appointment.save();

      const res = await request(app)
        .get('/api/appointments/available-slots')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ 
          date: date.toISOString().split('T')[0],
          dentistId: dentistId.toString(),
          duration: 30
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.slots).not.toContain('10:00');
    });

    it('should handle different appointment durations', async () => {
      const date = new Date(Date.now() + 86400000).toISOString().split('T')[0];

      const res = await request(app)
        .get('/api/appointments/available-slots')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ 
          date,
          dentistId: dentistId.toString(),
          duration: 60
        });

      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body.slots)).toBe(true);
    });
  });
});