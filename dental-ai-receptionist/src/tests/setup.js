import '@testing-library/jest-dom';
import { vi } from 'vitest';

global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

window.HTMLElement.prototype.scrollIntoView = vi.fn();

vi.mock('../services/apiService', () => ({
  default: {
    getStats: vi.fn(),
    getAppointments: vi.fn(),
    createAppointment: vi.fn(),
    updateAppointment: vi.fn(),
    cancelAppointment: vi.fn(),
    getPatients: vi.fn(),
    createPatient: vi.fn(),
    getDentists: vi.fn(),
    getCallLogs: vi.fn(),
    createCallLog: vi.fn(),
    reportEmergency: vi.fn(),
    getAnalytics: vi.fn(),
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    setAuthToken: vi.fn(),
  }
}));