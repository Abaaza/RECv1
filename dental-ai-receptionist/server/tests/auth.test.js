const request = require('supertest');
const app = require('../server');
const User = require('../models/User');
const jwt = require('jsonwebtoken');

describe('Authentication Endpoints', () => {
  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'newuser@example.com',
          password: 'Password123!',
          profile: {
            firstName: 'New',
            lastName: 'User',
            phone: '5551234567',
            dateOfBirth: '1990-01-01'
          }
        });

      expect(res.statusCode).toBe(201);
      expect(res.body).toHaveProperty('message', 'User registered successfully');
      expect(res.body).toHaveProperty('user');
      expect(res.body.user.email).toBe('newuser@example.com');
    });

    it('should not register user with existing email', async () => {
      const user = new User(global.testUser);
      await user.save();

      const res = await request(app)
        .post('/api/auth/register')
        .send(global.testUser);

      expect(res.statusCode).toBe(400);
      expect(res.body).toHaveProperty('error');
    });

    it('should validate required fields', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'incomplete@example.com'
        });

      expect(res.statusCode).toBe(400);
      expect(res.body).toHaveProperty('error');
    });

    it('should validate email format', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'invalidemail',
          password: 'Password123!',
          profile: {
            firstName: 'Test',
            lastName: 'User',
            phone: '5551234567'
          }
        });

      expect(res.statusCode).toBe(400);
      expect(res.body).toHaveProperty('error');
    });

    it('should enforce password strength requirements', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'weak@example.com',
          password: '123',
          profile: {
            firstName: 'Test',
            lastName: 'User',
            phone: '5551234567'
          }
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.error).toContain('password');
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      const user = new User(global.testUser);
      user.password = await user.hashPassword(global.testUser.password);
      await user.save();
    });

    it('should login with valid credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: global.testUser.email,
          password: global.testUser.password
        });

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('token');
      expect(res.body).toHaveProperty('user');
      expect(res.body.user.email).toBe(global.testUser.email);
    });

    it('should not login with invalid password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: global.testUser.email,
          password: 'wrongpassword'
        });

      expect(res.statusCode).toBe(401);
      expect(res.body).toHaveProperty('error', 'Invalid credentials');
    });

    it('should not login with non-existent email', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'Password123!'
        });

      expect(res.statusCode).toBe(401);
      expect(res.body).toHaveProperty('error');
    });

    it('should handle login attempts for inactive users', async () => {
      await User.updateOne(
        { email: global.testUser.email },
        { isActive: false }
      );

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: global.testUser.email,
          password: global.testUser.password
        });

      expect(res.statusCode).toBe(403);
      expect(res.body).toHaveProperty('error');
    });
  });

  describe('GET /api/auth/profile', () => {
    let authToken;
    let userId;

    beforeEach(async () => {
      const user = new User(global.testUser);
      user.password = await user.hashPassword(global.testUser.password);
      await user.save();
      userId = user._id;

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: global.testUser.email,
          password: global.testUser.password
        });

      authToken = res.body.token;
    });

    it('should get user profile with valid token', async () => {
      const res = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('email', global.testUser.email);
      expect(res.body).toHaveProperty('profile');
    });

    it('should not get profile without token', async () => {
      const res = await request(app)
        .get('/api/auth/profile');

      expect(res.statusCode).toBe(401);
      expect(res.body).toHaveProperty('error');
    });

    it('should not get profile with invalid token', async () => {
      const res = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', 'Bearer invalidtoken123');

      expect(res.statusCode).toBe(401);
      expect(res.body).toHaveProperty('error');
    });

    it('should not get profile with expired token', async () => {
      const expiredToken = jwt.sign(
        { userId: userId },
        process.env.JWT_SECRET || 'test-secret',
        { expiresIn: '-1h' }
      );

      const res = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(res.statusCode).toBe(401);
      expect(res.body).toHaveProperty('error');
    });
  });

  describe('PUT /api/auth/profile', () => {
    let authToken;

    beforeEach(async () => {
      const user = new User(global.testUser);
      user.password = await user.hashPassword(global.testUser.password);
      await user.save();

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: global.testUser.email,
          password: global.testUser.password
        });

      authToken = res.body.token;
    });

    it('should update user profile', async () => {
      const updates = {
        profile: {
          firstName: 'Updated',
          lastName: 'Name',
          phone: '5559999999'
        }
      };

      const res = await request(app)
        .put('/api/auth/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send(updates);

      expect(res.statusCode).toBe(200);
      expect(res.body.profile.firstName).toBe('Updated');
      expect(res.body.profile.lastName).toBe('Name');
    });

    it('should not update email to existing email', async () => {
      const anotherUser = new User({
        email: 'another@example.com',
        password: 'Password123!',
        profile: {
          firstName: 'Another',
          lastName: 'User',
          phone: '5559999999'
        }
      });
      await anotherUser.save();

      const res = await request(app)
        .put('/api/auth/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ email: 'another@example.com' });

      expect(res.statusCode).toBe(400);
      expect(res.body).toHaveProperty('error');
    });
  });

  describe('POST /api/auth/forgot-password', () => {
    beforeEach(async () => {
      const user = new User(global.testUser);
      await user.save();
    });

    it('should send password reset email for valid email', async () => {
      const res = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: global.testUser.email });

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('message');
    });

    it('should handle non-existent email gracefully', async () => {
      const res = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'nonexistent@example.com' });

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('message');
    });
  });

  describe('POST /api/auth/reset-password', () => {
    let resetToken;

    beforeEach(async () => {
      const user = new User(global.testUser);
      resetToken = user.generateResetToken();
      user.resetPasswordToken = resetToken;
      user.resetPasswordExpires = Date.now() + 3600000;
      await user.save();
    });

    it('should reset password with valid token', async () => {
      const res = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: resetToken,
          newPassword: 'NewPassword123!'
        });

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('message', 'Password reset successful');
    });

    it('should not reset password with invalid token', async () => {
      const res = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: 'invalidtoken',
          newPassword: 'NewPassword123!'
        });

      expect(res.statusCode).toBe(400);
      expect(res.body).toHaveProperty('error');
    });

    it('should not reset password with expired token', async () => {
      await User.updateOne(
        { email: global.testUser.email },
        { resetPasswordExpires: Date.now() - 3600000 }
      );

      const res = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: resetToken,
          newPassword: 'NewPassword123!'
        });

      expect(res.statusCode).toBe(400);
      expect(res.body).toHaveProperty('error');
    });
  });
});