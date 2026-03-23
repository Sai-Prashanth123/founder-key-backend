import { AuthService } from '../../src/modules/auth/auth.service';
import { ConflictError, UnauthorizedError, ForbiddenError, BadRequestError } from '../../src/utils/errors';

// Mock prisma
jest.mock('../../src/config/database', () => ({
  default: {
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    profile: {
      findUnique: jest.fn(),
    },
  },
}));

jest.mock('../../src/config/redis', () => ({
  default: {
    get: jest.fn(),
    set: jest.fn(),
    setex: jest.fn(),
    del: jest.fn(),
    exists: jest.fn(),
    keys: jest.fn().mockResolvedValue([]),
  },
  redis: {
    get: jest.fn(),
    set: jest.fn(),
    setex: jest.fn(),
    del: jest.fn(),
    exists: jest.fn(),
    keys: jest.fn().mockResolvedValue([]),
  },
}));

jest.mock('../../src/utils/email', () => ({
  sendEmail: jest.fn().mockResolvedValue(undefined),
  verificationEmail: jest.fn().mockReturnValue('<p>Verify</p>'),
  welcomeEmail: jest.fn().mockReturnValue('<p>Welcome</p>'),
  passwordResetEmail: jest.fn().mockReturnValue('<p>Reset</p>'),
}));

jest.mock('../../src/utils/jwt', () => ({
  signAccessToken: jest.fn().mockReturnValue('mock-access-token'),
  signRefreshToken: jest.fn().mockReturnValue('mock-refresh-token'),
  verifyRefreshToken: jest.fn(),
  getTokenExpiry: jest.fn().mockReturnValue(new Date()),
}));

jest.mock('../../src/utils/crypto', () => ({
  hashPassword: jest.fn().mockResolvedValue('hashed-password'),
  comparePassword: jest.fn(),
  generateToken: jest.fn().mockReturnValue('mock-token-32chars'),
}));

const prisma = require('../../src/config/database').default;
const redisModule = require('../../src/config/redis');
const { comparePassword } = require('../../src/utils/crypto');
const { verifyRefreshToken } = require('../../src/utils/jwt');

describe('AuthService', () => {
  let authService: AuthService;

  beforeEach(() => {
    authService = new AuthService();
    jest.clearAllMocks();
  });

  describe('register', () => {
    const registerDto = {
      email: 'test@example.com',
      password: 'Test@1234!',
      firstName: 'John',
      lastName: 'Doe',
      role: 'ATTENDEE' as const,
    };

    it('should successfully register a new user', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({
        id: 'user-id-1',
        email: registerDto.email,
        role: 'ATTENDEE',
        tier: 'FREE',
        isActive: true,
        isEmailVerified: false,
        profile: {
          firstName: 'John',
          lastName: 'Doe',
          avatar: null,
          company: null,
        },
      });
      redisModule.redis.setex.mockResolvedValue('OK');
      prisma.user.findUnique.mockResolvedValueOnce(null)
        .mockResolvedValue({
          id: 'user-id-1',
          email: registerDto.email,
          role: 'ATTENDEE',
          tier: 'FREE',
        });

      const result = await authService.register(registerDto);

      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('tokens');
      expect(result.user.email).toBe(registerDto.email);
      expect(result.tokens.accessToken).toBe('mock-access-token');
    });

    it('should throw ConflictError if email already exists', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'existing-user',
        email: registerDto.email,
      });

      await expect(authService.register(registerDto)).rejects.toThrow(ConflictError);
    });
  });

  describe('login', () => {
    const loginDto = {
      email: 'test@example.com',
      password: 'Test@1234!',
    };

    const mockUser = {
      id: 'user-id-1',
      email: loginDto.email,
      password: 'hashed-password',
      role: 'ATTENDEE',
      tier: 'FREE',
      isActive: true,
      isEmailVerified: true,
      deletedAt: null,
      profile: {
        firstName: 'John',
        lastName: 'Doe',
        avatar: null,
        company: null,
      },
    };

    it('should successfully login with valid credentials', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      comparePassword.mockResolvedValue(true);
      redisModule.redis.setex.mockResolvedValue('OK');
      prisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await authService.login(loginDto);

      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('tokens');
      expect(result.user.email).toBe(loginDto.email);
    });

    it('should throw UnauthorizedError for invalid email', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(authService.login(loginDto)).rejects.toThrow(UnauthorizedError);
    });

    it('should throw UnauthorizedError for wrong password', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      comparePassword.mockResolvedValue(false);

      await expect(authService.login(loginDto)).rejects.toThrow(UnauthorizedError);
    });

    it('should throw ForbiddenError for unverified email', async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...mockUser,
        isEmailVerified: false,
      });
      comparePassword.mockResolvedValue(true);

      await expect(authService.login(loginDto)).rejects.toThrow(ForbiddenError);
    });

    it('should throw ForbiddenError for inactive user', async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...mockUser,
        isActive: false,
      });
      comparePassword.mockResolvedValue(true);

      await expect(authService.login(loginDto)).rejects.toThrow(ForbiddenError);
    });
  });

  describe('refreshTokens', () => {
    it('should successfully refresh tokens', async () => {
      const mockDecodedToken = {
        userId: 'user-id-1',
        email: 'test@example.com',
        role: 'ATTENDEE',
        tier: 'FREE',
      };

      verifyRefreshToken.mockReturnValue(mockDecodedToken);
      redisModule.redis.exists.mockResolvedValue(1);
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-id-1',
        email: 'test@example.com',
        role: 'ATTENDEE',
        tier: 'FREE',
        isActive: true,
        deletedAt: null,
      });
      redisModule.redis.del.mockResolvedValue(1);
      redisModule.redis.setex.mockResolvedValue('OK');

      const result = await authService.refreshTokens('mock-refresh-token');

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
    });

    it('should throw UnauthorizedError for invalid refresh token', async () => {
      verifyRefreshToken.mockImplementation(() => {
        throw new UnauthorizedError('Invalid refresh token');
      });

      await expect(authService.refreshTokens('invalid-token')).rejects.toThrow(UnauthorizedError);
    });

    it('should throw UnauthorizedError if token not found in Redis', async () => {
      verifyRefreshToken.mockReturnValue({
        userId: 'user-id-1',
        email: 'test@example.com',
        role: 'ATTENDEE',
        tier: 'FREE',
      });
      redisModule.redis.exists.mockResolvedValue(0); // Token not in Redis

      await expect(authService.refreshTokens('expired-token')).rejects.toThrow(UnauthorizedError);
    });
  });

  describe('changePassword', () => {
    it('should successfully change password', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-id-1',
        password: 'old-hashed-password',
      });
      comparePassword.mockResolvedValue(true);
      prisma.user.update.mockResolvedValue({ id: 'user-id-1' });
      redisModule.redis.keys.mockResolvedValue([]);

      await expect(
        authService.changePassword('user-id-1', 'OldPass@123!', 'NewPass@456!')
      ).resolves.not.toThrow();
    });

    it('should throw UnauthorizedError for wrong current password', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-id-1',
        password: 'hashed-password',
      });
      comparePassword.mockResolvedValue(false);

      await expect(
        authService.changePassword('user-id-1', 'WrongPass@123!', 'NewPass@456!')
      ).rejects.toThrow(UnauthorizedError);
    });
  });

  describe('verifyEmail', () => {
    it('should successfully verify email', async () => {
      redisModule.redis.get.mockResolvedValue('user-id-1');
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-id-1',
        email: 'test@example.com',
        isEmailVerified: false,
        profile: { firstName: 'John', lastName: 'Doe' },
      });
      prisma.user.update.mockResolvedValue({ id: 'user-id-1', isEmailVerified: true });
      redisModule.redis.del.mockResolvedValue(1);

      await expect(authService.verifyEmail('valid-token')).resolves.not.toThrow();
    });

    it('should throw BadRequestError for invalid token', async () => {
      redisModule.redis.get.mockResolvedValue(null);

      await expect(authService.verifyEmail('invalid-token')).rejects.toThrow(BadRequestError);
    });
  });
});
