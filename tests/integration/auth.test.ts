import request from 'supertest';
import app from '../../src/app';
import { createTestUser, cleanupUsers } from '../helpers/auth.helper';
import { attendeeFixture, invalidUserFixtures } from '../fixtures/users.fixture';

// Mock external services
jest.mock('../../src/config/redis', () => ({
  default: {
    get: jest.fn().mockImplementation((key: string) => {
      if (key.includes('email_verify:')) return Promise.resolve('test-user-id');
      if (key.includes('password_reset:')) return Promise.resolve('test-user-id');
      return Promise.resolve(null);
    }),
    set: jest.fn().mockResolvedValue('OK'),
    setex: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
    exists: jest.fn().mockResolvedValue(1),
    keys: jest.fn().mockResolvedValue([]),
    quit: jest.fn().mockResolvedValue('OK'),
  },
  redis: {
    get: jest.fn().mockImplementation((key: string) => {
      if (key.includes('email_verify:')) return Promise.resolve('test-user-id');
      if (key.includes('password_reset:')) return Promise.resolve('test-user-id');
      return Promise.resolve(null);
    }),
    set: jest.fn().mockResolvedValue('OK'),
    setex: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
    exists: jest.fn().mockResolvedValue(1),
    keys: jest.fn().mockResolvedValue([]),
  },
  disconnectRedis: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../src/utils/email', () => ({
  sendEmail: jest.fn().mockResolvedValue(undefined),
  verificationEmail: jest.fn().mockReturnValue('<p>Verify</p>'),
  welcomeEmail: jest.fn().mockReturnValue('<p>Welcome</p>'),
  passwordResetEmail: jest.fn().mockReturnValue('<p>Reset</p>'),
}));

const API_BASE = '/api/v1';
const createdUserIds: string[] = [];

describe('Auth Integration Tests', () => {
  describe('POST /api/v1/auth/register', () => {
    it('should register a new user successfully', async () => {
      const uniqueEmail = `test-reg-${Date.now()}@test.com`;

      const response = await request(app)
        .post(`${API_BASE}/auth/register`)
        .send({
          ...attendeeFixture,
          email: uniqueEmail,
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('user');
      expect(response.body.data).toHaveProperty('tokens');
      expect(response.body.data.user.email).toBe(uniqueEmail);
      expect(response.body.data.user).not.toHaveProperty('password');

      if (response.body.data.user.id) {
        createdUserIds.push(response.body.data.user.id as string);
      }
    });

    it('should return 422 for invalid email', async () => {
      const response = await request(app)
        .post(`${API_BASE}/auth/register`)
        .send(invalidUserFixtures.invalidEmail)
        .expect(422);

      expect(response.body.success).toBe(false);
      expect(response.body).toHaveProperty('errors');
    });

    it('should return 422 for weak password', async () => {
      const response = await request(app)
        .post(`${API_BASE}/auth/register`)
        .send(invalidUserFixtures.weakPassword)
        .expect(422);

      expect(response.body.success).toBe(false);
    });

    it('should return 409 for duplicate email', async () => {
      const uniqueEmail = `test-dup-${Date.now()}@test.com`;

      await request(app)
        .post(`${API_BASE}/auth/register`)
        .send({ ...attendeeFixture, email: uniqueEmail });

      const response = await request(app)
        .post(`${API_BASE}/auth/register`)
        .send({ ...attendeeFixture, email: uniqueEmail })
        .expect(409);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/v1/auth/login', () => {
    let testUser: { id: string; email: string; password: string; accessToken: string };

    beforeAll(async () => {
      testUser = await createTestUser('ATTENDEE', {
        email: `test-login-${Date.now()}@test.com`,
      });
      createdUserIds.push(testUser.id);
    });

    it('should login successfully with valid credentials', async () => {
      const response = await request(app)
        .post(`${API_BASE}/auth/login`)
        .send({
          email: testUser.email,
          password: testUser.password,
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('tokens');
      expect(response.body.data.tokens).toHaveProperty('accessToken');
      expect(response.body.data.tokens).toHaveProperty('refreshToken');
    });

    it('should return 401 for wrong password', async () => {
      const response = await request(app)
        .post(`${API_BASE}/auth/login`)
        .send({
          email: testUser.email,
          password: 'WrongPass@123!',
        })
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should return 401 for non-existent email', async () => {
      const response = await request(app)
        .post(`${API_BASE}/auth/login`)
        .send({
          email: 'nonexistent@test.com',
          password: 'SomePass@123!',
        })
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should return 422 for missing email', async () => {
      const response = await request(app)
        .post(`${API_BASE}/auth/login`)
        .send({ password: 'Test@1234!' })
        .expect(422);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/v1/auth/refresh-token', () => {
    it('should refresh tokens successfully', async () => {
      // First login to get tokens
      const testUser = await createTestUser('ATTENDEE', {
        email: `test-refresh-${Date.now()}@test.com`,
      });
      createdUserIds.push(testUser.id);

      const loginResponse = await request(app)
        .post(`${API_BASE}/auth/login`)
        .send({ email: testUser.email, password: testUser.password });

      const { refreshToken } = loginResponse.body.data.tokens as {
        refreshToken: string;
      };

      const response = await request(app)
        .post(`${API_BASE}/auth/refresh-token`)
        .send({ refreshToken })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('accessToken');
    });

    it('should return 401 for invalid refresh token', async () => {
      const response = await request(app)
        .post(`${API_BASE}/auth/refresh-token`)
        .send({ refreshToken: 'invalid-token' })
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/v1/auth/logout', () => {
    it('should logout successfully', async () => {
      const testUser = await createTestUser('ATTENDEE', {
        email: `test-logout-${Date.now()}@test.com`,
      });
      createdUserIds.push(testUser.id);

      const response = await request(app)
        .post(`${API_BASE}/auth/logout`)
        .set('Authorization', `Bearer ${testUser.accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should return 401 without auth token', async () => {
      await request(app).post(`${API_BASE}/auth/logout`).expect(401);
    });
  });

  describe('GET /api/v1/auth/me', () => {
    it('should return current user', async () => {
      const testUser = await createTestUser('ATTENDEE', {
        email: `test-me-${Date.now()}@test.com`,
      });
      createdUserIds.push(testUser.id);

      const response = await request(app)
        .get(`${API_BASE}/auth/me`)
        .set('Authorization', `Bearer ${testUser.accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.email).toBe(testUser.email);
      expect(response.body.data).not.toHaveProperty('password');
    });

    it('should return 401 without auth token', async () => {
      await request(app).get(`${API_BASE}/auth/me`).expect(401);
    });

    it('should return 401 with invalid token', async () => {
      await request(app)
        .get(`${API_BASE}/auth/me`)
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });
  });

  afterAll(async () => {
    await cleanupUsers(createdUserIds);
  });
});
