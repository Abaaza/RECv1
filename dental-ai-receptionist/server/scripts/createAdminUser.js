import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env') });

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/dental-ai', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('MongoDB connected');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

// Import the actual User model
import User from '../models/User.js';

// Create admin user
const createAdminUser = async () => {
  try {
    await connectDB();

    // Delete existing admin if exists
    const existingAdmin = await User.findOne({ email: 'admin@dental.com' });
    if (existingAdmin) {
      await User.deleteOne({ email: 'admin@dental.com' });
      console.log('Deleted existing admin user');
    }

    // Create admin user with proper profile fields
    // Note: password will be hashed automatically by the User model's pre-save hook
    const adminUser = new User({
      email: 'admin@dental.com',
      password: 'admin123',
      role: 'admin',
      profile: {
        firstName: 'System',
        lastName: 'Administrator',
        phone: '+1234567890',
        dateOfBirth: new Date('1980-01-01'),
        address: {
          street: '123 Admin Street',
          city: 'Healthcare City',
          state: 'CA',
          zipCode: '12345'
        }
      },
      isActive: true
    });

    await adminUser.save();
    console.log('Admin user created successfully!');
    console.log('Email: admin@dental.com');
    console.log('Password: admin123');
    console.log('Please change the password after first login');

    process.exit(0);
  } catch (error) {
    console.error('Error creating admin user:', error);
    process.exit(1);
  }
};

createAdminUser();