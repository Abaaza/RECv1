import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';

class ApiService {
  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    });

    // Request interceptor for error handling
    this.client.interceptors.response.use(
      response => response,
      error => {
        if (error.response) {
          // Server responded with error status
          console.error('API Error:', error.response.data);
          throw new Error(error.response.data.error || 'Server error occurred');
        } else if (error.request) {
          // Request made but no response
          console.error('Network Error:', error.message);
          throw new Error('Network error - please check your connection');
        } else {
          // Request setup error
          console.error('Request Error:', error.message);
          throw new Error('Failed to make request');
        }
      }
    );
  }

  // Health check
  async checkHealth() {
    const response = await this.client.get('/health');
    return response.data;
  }

  // Appointments
  async getAppointments(date = null) {
    const params = date ? { date } : {};
    const response = await this.client.get('/appointments', { params });
    return response.data;
  }

  async searchAppointments(filters) {
    const response = await this.client.get('/appointments/search', { params: filters });
    return response.data;
  }

  async createAppointment(appointmentData) {
    const response = await this.client.post('/appointments', appointmentData);
    return response.data;
  }

  async updateAppointment(id, updates) {
    const response = await this.client.put(`/appointments/${id}`, updates);
    return response.data;
  }

  async cancelAppointment(id) {
    const response = await this.client.delete(`/appointments/${id}`);
    return response.data;
  }

  async getAvailableSlots(date, duration = 30) {
    const response = await this.client.get('/available-slots', { 
      params: { date, duration } 
    });
    return response.data;
  }

  // Patients
  async getPatients(params = {}) {
    const response = await this.client.get('/patientsv2', { params });
    return response.data;
  }

  async getPatient(id) {
    const response = await this.client.get(`/patientsv2/${id}`);
    return response.data;
  }

  async createPatient(patientData) {
    const response = await this.client.post('/patientsv2', patientData);
    return response.data;
  }

  async updatePatient(id, updates) {
    const response = await this.client.put(`/patientsv2/${id}`, updates);
    return response.data;
  }

  async deletePatient(id) {
    const response = await this.client.delete(`/patientsv2/${id}`);
    return response.data;
  }

  async addTreatment(patientId, treatmentData) {
    const response = await this.client.post(`/patientsv2/${patientId}/treatments`, treatmentData);
    return response.data;
  }

  async updateMedicalHistory(patientId, medicalData) {
    const response = await this.client.put(`/patientsv2/${patientId}/medical`, medicalData);
    return response.data;
  }

  async getDueForRecall(daysAhead = 30) {
    const response = await this.client.get('/patientsv2/recalls/due', { params: { daysAhead } });
    return response.data;
  }

  // Dentists
  async getDentists() {
    const response = await this.client.get('/schedule/dentists');
    return response.data;
  }

  async getAvailableDentists() {
    const response = await this.client.get('/dentists/available');
    return response.data;
  }

  // Call Logs
  async getCallLogs() {
    const response = await this.client.get('/call-logs');
    return response.data;
  }

  async createCallLog(logData) {
    const response = await this.client.post('/call-logs', logData);
    return response.data;
  }

  // Emergency
  async reportEmergency(emergencyData) {
    const response = await this.client.post('/emergencies', emergencyData);
    return response.data;
  }

  // Statistics
  async getStats() {
    const response = await this.client.get('/stats');
    return response.data;
  }

  // Analytics
  async getAnalytics(params = {}) {
    const response = await this.client.get('/analyticsv2', { params });
    return response.data;
  }

  async getAppointmentAnalytics(params = {}) {
    const response = await this.client.get('/analytics/appointments', { params });
    return response.data;
  }

  async getRevenueAnalytics(params = {}) {
    const response = await this.client.get('/analytics/revenue', { params });
    return response.data;
  }

  async getPerformanceAnalytics(params = {}) {
    const response = await this.client.get('/analytics/performance', { params });
    return response.data;
  }

  async getPatientRetention(params = {}) {
    const response = await this.client.get('/analytics/patient-retention', { params });
    return response.data;
  }

  // Schedule Management
  async getSchedule(params = {}) {
    const response = await this.client.get('/schedule', { params });
    return response.data;
  }

  async updateSchedule(scheduleData) {
    const response = await this.client.post('/schedule/update', scheduleData);
    return response.data;
  }

  async getHolidays(year = null) {
    const params = year ? { year } : {};
    const response = await this.client.get('/schedule/holidays', { params });
    return response.data;
  }

  async addHoliday(holidayData) {
    const response = await this.client.post('/schedule/holidays', holidayData);
    return response.data;
  }

  async deleteHoliday(date) {
    const response = await this.client.delete(`/schedule/holidays/${date}`);
    return response.data;
  }

  async blockSlot(slotData) {
    const response = await this.client.post('/schedule/block-slot', slotData);
    return response.data;
  }

  async unblockSlot(slotData) {
    const response = await this.client.post('/schedule/unblock-slot', slotData);
    return response.data;
  }

  async applyScheduleTemplate(templateData) {
    const response = await this.client.post('/schedule/apply-template', templateData);
    return response.data;
  }

  async getScheduleAvailableSlots(params) {
    const response = await this.client.get('/schedule/available-slots', { params });
    return response.data;
  }

  // Insurance Management
  async verifyInsurance(insuranceData) {
    const response = await this.client.post('/insurance/verify', insuranceData);
    return response.data;
  }

  async getInsuranceVerifications(patientId) {
    const response = await this.client.get(`/insurance/verifications/${patientId}`);
    return response.data;
  }

  async createInsuranceClaim(claimData) {
    const response = await this.client.post('/insurance/claims', claimData);
    return response.data;
  }

  async getInsuranceClaims(params = {}) {
    const response = await this.client.get('/insurance/claims', { params });
    return response.data;
  }

  async updateInsuranceClaim(claimId, updates) {
    const response = await this.client.put(`/insurance/claims/${claimId}`, updates);
    return response.data;
  }

  // Treatment Plans
  async getTreatmentPlans(patientId) {
    const response = await this.client.get(`/treatment-plans/patient/${patientId}`);
    return response.data;
  }

  async createTreatmentPlan(treatmentData) {
    const response = await this.client.post('/treatment-plans', treatmentData);
    return response.data;
  }

  async updateTreatmentPlan(planId, updates) {
    const response = await this.client.put(`/treatment-plans/${planId}`, updates);
    return response.data;
  }

  async deleteTreatmentPlan(planId) {
    const response = await this.client.delete(`/treatment-plans/${planId}`);
    return response.data;
  }

  async getTreatmentPlanStats() {
    const response = await this.client.get('/treatment-plans/stats');
    return response.data;
  }

  // Insurance Statistics
  async getInsuranceStatistics() {
    const response = await this.client.get('/insurance/statistics');
    return response.data;
  }

  // Notifications
  async getNotifications(params = {}) {
    const response = await this.client.get('/notifications', { params });
    return response.data;
  }

  async markNotificationAsRead(notificationId) {
    const response = await this.client.put(`/notifications/${notificationId}/read`);
    return response.data;
  }

  async markAllNotificationsAsRead() {
    const response = await this.client.put('/notifications/read-all');
    return response.data;
  }

  // Emergencies
  async getActiveEmergencies() {
    const response = await this.client.get('/emergencies/active');
    return response.data;
  }

  async updateEmergency(emergencyId, updates) {
    const response = await this.client.put(`/emergencies/${emergencyId}`, updates);
    return response.data;
  }

  async resolveEmergency(emergencyId, resolution) {
    const response = await this.client.post(`/emergencies/${emergencyId}/resolve`, resolution);
    return response.data;
  }

  // Authentication
  async login(credentials) {
    const response = await this.client.post('/auth/login', credentials);
    if (response.data.token) {
      this.client.defaults.headers.common['Authorization'] = `Bearer ${response.data.token}`;
    }
    return response.data;
  }

  async register(userData) {
    const response = await this.client.post('/auth/register', userData);
    return response.data;
  }

  async verifyTwoFactor(data) {
    const response = await this.client.post('/auth/verify-2fa', data);
    if (response.data.token) {
      this.client.defaults.headers.common['Authorization'] = `Bearer ${response.data.token}`;
    }
    return response.data;
  }

  async requestPasswordReset(email) {
    const response = await this.client.post('/auth/forgot-password', { email });
    return response.data;
  }

  async resetPassword(data) {
    const response = await this.client.post('/auth/reset-password', data);
    return response.data;
  }

  async logout() {
    delete this.client.defaults.headers.common['Authorization'];
    localStorage.removeItem('authToken');
    localStorage.removeItem('patientData');
  }

  setAuthToken(token) {
    if (token) {
      this.client.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
      delete this.client.defaults.headers.common['Authorization'];
    }
  }
}

export default new ApiService();