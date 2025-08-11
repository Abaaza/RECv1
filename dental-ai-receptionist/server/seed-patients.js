import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Patient from './models/Patient.js';

dotenv.config();

const samplePatients = [
  {
    firstName: 'John',
    lastName: 'Smith',
    email: 'john.smith@email.com',
    password: 'TempPass123!',
    phone: '555-123-4567',
    dateOfBirth: new Date('1989-03-15'),
    gender: 'male',
    address: {
      street: '123 Main St',
      city: 'New York',
      state: 'NY',
      zipCode: '10001',
      country: 'USA'
    },
    medicalHistory: [
      {
        condition: 'Hypertension',
        diagnosedDate: new Date('2020-01-15'),
        medications: ['Lisinopril 10mg'],
        notes: 'Well controlled with medication'
      },
      {
        condition: 'Type 2 Diabetes',
        diagnosedDate: new Date('2019-06-20'),
        medications: ['Metformin 500mg'],
        notes: 'Diet controlled, HbA1c 6.5'
      }
    ],
    allergies: [
      {
        allergen: 'Penicillin',
        reaction: 'Rash and swelling',
        severity: 'severe'
      },
      {
        allergen: 'Latex',
        reaction: 'Skin irritation',
        severity: 'mild'
      }
    ],
    currentMedications: [
      {
        name: 'Lisinopril',
        dosage: '10mg',
        frequency: 'Once daily',
        prescribedBy: 'Dr. Johnson',
        startDate: new Date('2020-01-15')
      },
      {
        name: 'Metformin',
        dosage: '500mg',
        frequency: 'Twice daily',
        prescribedBy: 'Dr. Johnson',
        startDate: new Date('2019-06-20')
      }
    ],
    insurance: {
      provider: 'Delta Dental',
      memberId: 'DD123456789',
      groupNumber: 'GRP001',
      effectiveDate: new Date('2023-01-01'),
      expirationDate: new Date('2024-12-31'),
      verified: true,
      verifiedAt: new Date()
    },
    emergencyContact: {
      name: 'Jane Smith',
      relationship: 'Spouse',
      phone: '555-987-6543',
      alternatePhone: '555-876-5432'
    },
    treatmentHistory: [
      {
        date: new Date('2023-12-10'),
        procedure: 'Filling - Tooth #14',
        procedureCode: 'D2392',
        tooth: ['14'],
        notes: 'Composite filling, no complications',
        cost: 250,
        insuranceCovered: 200,
        patientPaid: 50
      },
      {
        date: new Date('2023-08-20'),
        procedure: 'Root Canal - Tooth #30',
        procedureCode: 'D3330',
        tooth: ['30'],
        notes: 'Successful root canal therapy',
        cost: 1200,
        insuranceCovered: 800,
        patientPaid: 400
      }
    ],
    lastVisit: new Date('2024-01-15'),
    nextRecallDate: new Date('2024-07-15'),
    status: 'active',
    riskFactors: {
      smoking: false,
      diabetes: true,
      heartDisease: false,
      pregnancy: false,
      immunocompromised: false,
      bleedingDisorder: false
    },
    preferences: {
      appointmentReminders: {
        email: true,
        sms: true,
        call: false,
        advanceNotice: 24
      },
      preferredTimeOfDay: 'morning',
      preferredDays: ['Monday', 'Tuesday', 'Wednesday'],
      language: 'en',
      communicationPreference: 'email'
    },
    notes: 'Patient prefers morning appointments. Anxious about dental procedures.'
  },
  {
    firstName: 'Sarah',
    lastName: 'Johnson',
    email: 'sarah.johnson@email.com',
    password: 'TempPass123!',
    phone: '555-234-5678',
    dateOfBirth: new Date('1996-07-22'),
    gender: 'female',
    address: {
      street: '456 Oak Ave',
      city: 'Los Angeles',
      state: 'CA',
      zipCode: '90001',
      country: 'USA'
    },
    medicalHistory: [],
    allergies: [],
    currentMedications: [
      {
        name: 'Birth Control',
        dosage: 'Standard',
        frequency: 'Daily',
        prescribedBy: 'Dr. Williams',
        startDate: new Date('2022-01-01')
      }
    ],
    insurance: {
      provider: 'Aetna',
      memberId: 'AET987654321',
      groupNumber: 'GRP002',
      effectiveDate: new Date('2023-01-01'),
      expirationDate: new Date('2024-12-31'),
      verified: true,
      verifiedAt: new Date()
    },
    emergencyContact: {
      name: 'Mike Johnson',
      relationship: 'Brother',
      phone: '555-876-5432'
    },
    treatmentHistory: [
      {
        date: new Date('2024-01-20'),
        procedure: 'Cleaning',
        procedureCode: 'D1110',
        notes: 'Routine cleaning, excellent oral hygiene',
        cost: 150,
        insuranceCovered: 150,
        patientPaid: 0
      }
    ],
    lastVisit: new Date('2024-01-20'),
    nextRecallDate: new Date('2024-07-20'),
    status: 'active',
    riskFactors: {
      smoking: false,
      diabetes: false,
      heartDisease: false,
      pregnancy: false,
      immunocompromised: false,
      bleedingDisorder: false
    },
    preferences: {
      appointmentReminders: {
        email: true,
        sms: true,
        call: false,
        advanceNotice: 48
      },
      preferredTimeOfDay: 'afternoon',
      preferredDays: ['Thursday', 'Friday'],
      language: 'en',
      communicationPreference: 'sms'
    },
    notes: 'Excellent oral hygiene. No issues.'
  },
  {
    firstName: 'Michael',
    lastName: 'Brown',
    email: 'michael.brown@email.com',
    password: 'TempPass123!',
    phone: '555-345-6789',
    dateOfBirth: new Date('1975-11-30'),
    gender: 'male',
    address: {
      street: '789 Pine St',
      city: 'Chicago',
      state: 'IL',
      zipCode: '60601',
      country: 'USA'
    },
    medicalHistory: [
      {
        condition: 'Heart Disease',
        diagnosedDate: new Date('2021-03-10'),
        medications: ['Atorvastatin 20mg', 'Aspirin 81mg'],
        notes: 'Stable with medication'
      }
    ],
    allergies: [
      {
        allergen: 'Codeine',
        reaction: 'Nausea and dizziness',
        severity: 'moderate'
      }
    ],
    currentMedications: [
      {
        name: 'Atorvastatin',
        dosage: '20mg',
        frequency: 'Once daily',
        prescribedBy: 'Dr. Lee',
        startDate: new Date('2021-03-10')
      },
      {
        name: 'Aspirin',
        dosage: '81mg',
        frequency: 'Once daily',
        prescribedBy: 'Dr. Lee',
        startDate: new Date('2021-03-10')
      }
    ],
    insurance: {
      provider: 'Blue Cross Blue Shield',
      memberId: 'BCBS456789012',
      groupNumber: 'GRP003',
      effectiveDate: new Date('2023-01-01'),
      expirationDate: new Date('2024-12-31'),
      verified: true,
      verifiedAt: new Date()
    },
    emergencyContact: {
      name: 'Lisa Brown',
      relationship: 'Wife',
      phone: '555-456-7890'
    },
    treatmentHistory: [
      {
        date: new Date('2023-11-15'),
        procedure: 'Crown - Tooth #19',
        procedureCode: 'D2750',
        tooth: ['19'],
        notes: 'Porcelain crown placed successfully',
        cost: 1500,
        insuranceCovered: 750,
        patientPaid: 750
      }
    ],
    lastVisit: new Date('2023-11-15'),
    nextRecallDate: new Date('2024-05-15'),
    status: 'active',
    riskFactors: {
      smoking: false,
      diabetes: false,
      heartDisease: true,
      pregnancy: false,
      immunocompromised: false,
      bleedingDisorder: false
    },
    preferences: {
      appointmentReminders: {
        email: true,
        sms: false,
        call: true,
        advanceNotice: 72
      },
      preferredTimeOfDay: 'morning',
      preferredDays: ['Monday', 'Wednesday', 'Friday'],
      language: 'en',
      communicationPreference: 'phone'
    },
    notes: 'Requires antibiotic prophylaxis before procedures due to heart condition.'
  }
];

async function seedPatients() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Clear existing patients (optional - comment out if you want to keep existing data)
    await Patient.deleteMany({});
    console.log('Cleared existing patients');

    // Insert sample patients
    const createdPatients = await Patient.insertMany(samplePatients);
    console.log(`Created ${createdPatients.length} sample patients`);

    // List created patients
    createdPatients.forEach(patient => {
      console.log(`- ${patient.firstName} ${patient.lastName} (${patient.email})`);
    });

    console.log('\nPatients seeded successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding patients:', error);
    process.exit(1);
  }
}

seedPatients();