const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.test' });

beforeAll(async () => {
  const url = process.env.TEST_MONGODB_URI || 'mongodb://localhost:27017/dental_test';
  await mongoose.connect(url);
});

afterEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany();
  }
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
});

global.testUser = {
  email: 'test@example.com',
  password: 'Test123!@#',
  profile: {
    firstName: 'Test',
    lastName: 'User',
    phone: '5551234567',
    dateOfBirth: new Date('1990-01-01')
  }
};

global.testPatient = {
  email: 'patient@example.com',
  password: 'Patient123!@#',
  profile: {
    firstName: 'Test',
    lastName: 'Patient',
    phone: '5559876543',
    dateOfBirth: new Date('1985-05-15')
  },
  role: 'patient'
};

global.testDentist = {
  email: 'dentist@example.com',
  password: 'Dentist123!@#',
  profile: {
    firstName: 'Dr',
    lastName: 'Dentist',
    phone: '5555551234',
    specialization: 'General Dentistry',
    licenseNumber: 'DDS12345'
  },
  role: 'dentist'
};