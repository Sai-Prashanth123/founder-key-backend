import prisma from '@config/database';
import redis from '@config/redis';
import { env } from '@config/env';
import { supabaseAdmin, supabasePublic } from '@config/supabase';
import { REDIS_KEYS, TOKEN_TTL } from '@config/constants';
import { hashPassword, comparePassword, generateToken } from '@utils/crypto';
import { signAccessToken, signRefreshToken, verifyRefreshToken, getTokenExpiry } from '@utils/jwt';
import { sendEmail, verificationEmail, passwordResetEmail, welcomeEmail } from '@utils/email';
import {
  ConflictError,
  NotFoundError,
  UnauthorizedError,
  BadRequestError,
  ForbiddenError,
} from '@utils/errors';
import logger from '@utils/logger';
import { TokenPair } from '@appTypes/index';
import { RegisterDto, LoginDto, AuthUser, AuthResponse, GoogleVerifyDto, OAuthUserInfo, GoogleOAuthUrlResponse } from './auth.types';

export class AuthService {
  async register(dto: RegisterDto): Promise<AuthResponse> {
    const existingUser = await prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      throw new ConflictError('An account with this email already exists');
    }

    const hashedPassword = await hashPassword(dto.password);
    const emailVerifyToken = generateToken(32);

    const user = await prisma.user.create({
      data: {
        email: dto.email,
        password: hashedPassword,
        role: (dto.role as 'ATTENDEE' | 'ORGANIZER') ?? 'ATTENDEE',
        profile: {
          create: {
            firstName: dto.firstName,
            lastName: dto.lastName,
            company: dto.company ?? null,
          },
        },
        gamification: {
          create: {
            fkScore: 0,
            level: 1,
          },
        },
      },
      include: {
        profile: true,
      },
    });

    // Store email verification token in Redis
    await redis.setex(
      `${REDIS_KEYS.EMAIL_VERIFY}${emailVerifyToken}`,
      TOKEN_TTL.EMAIL_VERIFY,
      user.id
    );

    // Send verification email (async, don't await)
    const verifyUrl = `${env.FRONTEND_URL}/verify-email?token=${emailVerifyToken}`;
    sendEmail(
      user.email,
      'Verify Your Email - Founder Key',
      verificationEmail(`${dto.firstName} ${dto.lastName}`, emailVerifyToken, verifyUrl)
    ).catch((err: Error) => logger.error('Failed to send verification email', { error: err.message }));

    const tokens = await this.generateTokenPair(user.id, user.role, user.tier);

    const authUser: AuthUser = {
      id: user.id,
      email: user.email,
      role: user.role as 'ATTENDEE' | 'ORGANIZER' | 'ADMIN',
      tier: user.tier as 'FREE' | 'FOUNDER',
      isActive: user.isActive,
      isEmailVerified: user.isEmailVerified,
      profile: user.profile
        ? {
            firstName: user.profile.firstName,
            lastName: user.profile.lastName,
            avatar: user.profile.avatar,
            company: user.profile.company,
          }
        : null,
    };

    return { user: authUser, tokens };
  }

  async login(dto: LoginDto): Promise<AuthResponse> {
    const user = await prisma.user.findUnique({
      where: { email: dto.email },
      include: { profile: true },
    });

    if (!user) {
      throw new UnauthorizedError('Invalid email or password');
    }

    if (!user.password) {
      throw new UnauthorizedError('This account uses Google sign-in. Please sign in with Google.');
    }
    const isPasswordValid = await comparePassword(dto.password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedError('Invalid email or password');
    }

    if (!user.isActive || user.deletedAt) {
      throw new ForbiddenError('Your account has been deactivated. Please contact support.');
    }

    if (!user.isEmailVerified && env.NODE_ENV === 'production') {
      throw new ForbiddenError('Please verify your email address before logging in');
    }

    const tokens = await this.generateTokenPair(user.id, user.role, user.tier);

    const authUser: AuthUser = {
      id: user.id,
      email: user.email,
      role: user.role as 'ATTENDEE' | 'ORGANIZER' | 'ADMIN',
      tier: user.tier as 'FREE' | 'FOUNDER',
      isActive: user.isActive,
      isEmailVerified: user.isEmailVerified,
      profile: user.profile
        ? {
            firstName: user.profile.firstName,
            lastName: user.profile.lastName,
            avatar: user.profile.avatar,
            company: user.profile.company,
          }
        : null,
    };

    return { user: authUser, tokens };
  }

  async refreshTokens(refreshToken: string): Promise<TokenPair> {
    const decoded = verifyRefreshToken(refreshToken);

    // Check if refresh token exists in Redis
    const redisKey = `${REDIS_KEYS.REFRESH_TOKEN}${decoded.userId}:${refreshToken}`;
    const exists = await redis.exists(redisKey);

    if (!exists) {
      throw new UnauthorizedError('Refresh token has been revoked or expired');
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
    });

    if (!user || !user.isActive || user.deletedAt) {
      throw new UnauthorizedError('User account is not active');
    }

    // Delete old refresh token
    await redis.del(redisKey);

    // Generate new token pair
    return this.generateTokenPair(user.id, user.role, user.tier);
  }

  async logout(userId: string, refreshToken: string): Promise<void> {
    const redisKey = `${REDIS_KEYS.REFRESH_TOKEN}${userId}:${refreshToken}`;
    await redis.del(redisKey);
  }

  async forgotPassword(email: string): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { email },
      include: { profile: true },
    });

    // Don't reveal if user exists or not
    if (!user || !user.isActive || user.deletedAt) {
      return;
    }

    const resetToken = generateToken(32);
    const redisKey = `${REDIS_KEYS.PASSWORD_RESET}${resetToken}`;

    await redis.setex(redisKey, TOKEN_TTL.PASSWORD_RESET, user.id);

    const resetUrl = `${env.FRONTEND_URL}/reset-password?token=${resetToken}`;
    const name = user.profile ? `${user.profile.firstName} ${user.profile.lastName}` : user.email;

    await sendEmail(
      user.email,
      'Password Reset Request - Founder Key',
      passwordResetEmail(name, resetToken, resetUrl)
    );
  }

  async resetPassword(token: string, password: string): Promise<void> {
    const redisKey = `${REDIS_KEYS.PASSWORD_RESET}${token}`;
    const userId = await redis.get(redisKey);

    if (!userId) {
      throw new BadRequestError('Invalid or expired password reset token');
    }

    const hashedPassword = await hashPassword(password);

    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    // Invalidate the reset token
    await redis.del(redisKey);

    // Invalidate all refresh tokens for the user
    await this.invalidateAllRefreshTokens(userId);
  }

  async verifyEmail(token: string): Promise<void> {
    const redisKey = `${REDIS_KEYS.EMAIL_VERIFY}${token}`;
    const userId = await redis.get(redisKey);

    if (!userId) {
      throw new BadRequestError('Invalid or expired verification token');
    }

    const user = await prisma.user.findUnique({ where: { id: userId }, include: { profile: true } });
    if (!user) {
      throw new NotFoundError('User');
    }

    if (user.isEmailVerified) {
      await redis.del(redisKey);
      return; // Already verified
    }

    await prisma.user.update({
      where: { id: userId },
      data: { isEmailVerified: true },
    });

    await redis.del(redisKey);

    // Send welcome email
    const name = user.profile ? `${user.profile.firstName} ${user.profile.lastName}` : user.email;
    sendEmail(user.email, 'Welcome to Founder Key!', welcomeEmail(name)).catch((err: Error) =>
      logger.error('Failed to send welcome email', { error: err.message })
    );
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<void> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundError('User');
    }

    if (!user.password) {
      throw new BadRequestError('This account uses Google sign-in and has no password to change.');
    }
    const isCurrentPasswordValid = await comparePassword(currentPassword, user.password);
    if (!isCurrentPasswordValid) {
      throw new UnauthorizedError('Current password is incorrect');
    }

    const hashedPassword = await hashPassword(newPassword);

    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    // Invalidate all refresh tokens
    await this.invalidateAllRefreshTokens(userId);
  }

  async getMe(userId: string): Promise<AuthUser> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });

    if (!user) {
      throw new NotFoundError('User');
    }

    return {
      id: user.id,
      email: user.email,
      role: user.role as 'ATTENDEE' | 'ORGANIZER' | 'ADMIN',
      tier: user.tier as 'FREE' | 'FOUNDER',
      isActive: user.isActive,
      isEmailVerified: user.isEmailVerified,
      profile: user.profile
        ? {
            firstName: user.profile.firstName,
            lastName: user.profile.lastName,
            avatar: user.profile.avatar,
            company: user.profile.company,
          }
        : null,
    };
  }

  // ─── Google OAuth via Supabase ───────────────────────────────────────────

  /**
   * Returns the Supabase Google OAuth URL.
   * The frontend redirects the user to this URL to start the Google login flow.
   */
  async getGoogleOAuthUrl(redirectTo?: string): Promise<GoogleOAuthUrlResponse> {
    const { data, error } = await supabasePublic.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectTo ?? `${env.FRONTEND_URL}/auth/google/callback`,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    });

    if (error || !data.url) {
      logger.error('Failed to generate Google OAuth URL', { error });
      throw new BadRequestError('Failed to generate Google OAuth URL');
    }

    return { url: data.url };
  }

  /**
   * Verifies a Supabase access token obtained after Google OAuth on the frontend.
   * Extracts the Google user profile, finds or creates a user in our DB,
   * and returns our own JWT token pair.
   */
  async googleAuth(dto: GoogleVerifyDto): Promise<AuthResponse> {
    // Step 1: Verify token with Supabase Admin SDK
    const { data, error } = await supabaseAdmin.auth.getUser(dto.supabaseToken);

    if (error || !data.user) {
      logger.warn('Invalid Supabase token received for Google auth', { error });
      throw new UnauthorizedError('Invalid or expired Google token. Please sign in again.');
    }

    const supabaseUser = data.user;

    // Step 2: Extract Google profile info from Supabase user metadata
    const googleId = supabaseUser.id; // Supabase user ID (linked to Google)
    const email = supabaseUser.email;
    if (!email) {
      throw new BadRequestError('Google account does not have an email address');
    }

    const metadata = supabaseUser.user_metadata ?? {};
    const fullName: string = metadata.full_name ?? metadata.name ?? '';
    const nameParts = fullName.trim().split(' ');
    const firstName = metadata.given_name ?? nameParts[0] ?? 'User';
    const lastName = metadata.family_name ?? nameParts.slice(1).join(' ') ?? '';
    const avatar: string | undefined = metadata.avatar_url ?? metadata.picture;

    const oauthInfo: OAuthUserInfo = {
      googleId,
      email,
      firstName,
      lastName,
      avatar,
      emailVerified: supabaseUser.email_confirmed_at != null,
    };

    // Step 3: Find existing user by googleId or email
    let user = await prisma.user.findFirst({
      where: {
        OR: [{ googleId: oauthInfo.googleId }, { email: oauthInfo.email }],
      },
      include: { profile: true },
    });

    if (user) {
      // User exists — link Google if not already linked, update avatar if missing
      const updateData: Record<string, unknown> = {};

      if (!user.googleId) {
        updateData.googleId = oauthInfo.googleId;
        updateData.authProvider = 'google';
        updateData.isEmailVerified = true;
      }

      if (Object.keys(updateData).length > 0) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: updateData,
          include: { profile: true },
        });
      }

      // Update avatar in profile if not set yet
      if (user.profile && !user.profile.avatar && oauthInfo.avatar) {
        await prisma.profile.update({
          where: { userId: user.id },
          data: { avatar: oauthInfo.avatar },
        });
        if (user.profile) user.profile.avatar = oauthInfo.avatar;
      }

      logger.info('Google OAuth: existing user logged in', { userId: user.id, email: user.email });
    } else {
      // New user — create account from Google data
      const role = (dto.role as 'ATTENDEE' | 'ORGANIZER') ?? 'ATTENDEE';

      user = await prisma.user.create({
        data: {
          email: oauthInfo.email,
          googleId: oauthInfo.googleId,
          authProvider: 'google',
          password: null, // No password for OAuth users
          isEmailVerified: true, // Google emails are pre-verified
          role,
          profile: {
            create: {
              firstName: oauthInfo.firstName,
              lastName: oauthInfo.lastName,
              avatar: oauthInfo.avatar ?? null,
            },
          },
          gamification: {
            create: {
              fkScore: 0,
              level: 1,
            },
          },
        },
        include: { profile: true },
      });

      // Send welcome email (non-blocking)
      sendEmail(
        user.email,
        'Welcome to Founder Key!',
        welcomeEmail(`${oauthInfo.firstName} ${oauthInfo.lastName}`)
      ).catch((err: Error) =>
        logger.error('Failed to send welcome email after Google signup', { error: err.message })
      );

      logger.info('Google OAuth: new user created', { userId: user.id, email: user.email });
    }

    if (!user.isActive || user.deletedAt) {
      throw new ForbiddenError('Your account has been deactivated. Please contact support.');
    }

    // Step 4: Generate our own JWT tokens
    const tokens = await this.generateTokenPair(user.id, user.role, user.tier);

    const authUser: AuthUser = {
      id: user.id,
      email: user.email,
      role: user.role as 'ATTENDEE' | 'ORGANIZER' | 'ADMIN',
      tier: user.tier as 'FREE' | 'FOUNDER',
      isActive: user.isActive,
      isEmailVerified: user.isEmailVerified,
      profile: user.profile
        ? {
            firstName: user.profile.firstName,
            lastName: user.profile.lastName,
            avatar: user.profile.avatar,
            company: user.profile.company,
          }
        : null,
    };

    return { user: authUser, tokens };
  }

  // ─────────────────────────────────────────────────────────────────────────

  async generateTokenPair(userId: string, role: string, tier: string): Promise<TokenPair> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundError('User');

    const payload = {
      userId,
      email: user.email,
      role: role as 'ATTENDEE' | 'ORGANIZER' | 'ADMIN',
      tier: tier as 'FREE' | 'FOUNDER',
    };

    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);

    const ttl = TOKEN_TTL.REFRESH_TOKEN;
    const redisKey = `${REDIS_KEYS.REFRESH_TOKEN}${userId}:${refreshToken}`;
    await redis.setex(redisKey, ttl, userId);

    return { accessToken, refreshToken };
  }

  private async invalidateAllRefreshTokens(userId: string): Promise<void> {
    const pattern = `${REDIS_KEYS.REFRESH_TOKEN}${userId}:*`;
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  }

  async resendVerificationEmail(email: string): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { email },
      include: { profile: true },
    });

    if (!user || user.isEmailVerified) return;

    const emailVerifyToken = generateToken(32);
    await redis.setex(
      `${REDIS_KEYS.EMAIL_VERIFY}${emailVerifyToken}`,
      TOKEN_TTL.EMAIL_VERIFY,
      user.id
    );

    const verifyUrl = `${env.FRONTEND_URL}/verify-email?token=${emailVerifyToken}`;
    const name = user.profile ? `${user.profile.firstName} ${user.profile.lastName}` : user.email;

    await sendEmail(
      user.email,
      'Verify Your Email - Founder Key',
      verificationEmail(name, emailVerifyToken, verifyUrl)
    );
  }
}

export default new AuthService();
