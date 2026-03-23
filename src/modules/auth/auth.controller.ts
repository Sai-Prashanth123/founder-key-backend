import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import authService from './auth.service';
import { sendSuccess, sendCreated } from '@utils/response';
import {
  RegisterDto,
  LoginDto,
  ChangePasswordDto,
} from './auth.validation';
import { BadRequestError } from '@utils/errors';
import { GoogleVerifyDto } from './auth.types';

export class AuthController {
  async register(req: Request, res: Response): Promise<void> {
    const dto = req.body as RegisterDto;
    const result = await authService.register(dto);
    sendCreated(res, result, 'Account created successfully. Please verify your email.');
  }

  async login(req: Request, res: Response): Promise<void> {
    const dto = req.body as LoginDto;
    const result = await authService.login(dto);

    // Set refresh token as httpOnly cookie
    res.cookie('refreshToken', result.tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    sendSuccess(res, result, 'Login successful');
  }

  async refreshToken(req: Request, res: Response): Promise<void> {
    const { refreshToken } = req.body as { refreshToken: string };
    const tokens = await authService.refreshTokens(refreshToken);

    res.cookie('refreshToken', tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    sendSuccess(res, tokens, 'Tokens refreshed successfully');
  }

  async logout(req: Request, res: Response): Promise<void> {
    const userId = req.user!.userId;
    const { refreshToken } = req.body as { refreshToken?: string };

    if (refreshToken) {
      await authService.logout(userId, refreshToken);
    }

    res.clearCookie('refreshToken');
    sendSuccess(res, null, 'Logged out successfully');
  }

  async forgotPassword(req: Request, res: Response): Promise<void> {
    const { email } = req.body as { email: string };
    await authService.forgotPassword(email);
    sendSuccess(
      res,
      null,
      'If an account with this email exists, a password reset link has been sent.'
    );
  }

  async resetPassword(req: Request, res: Response): Promise<void> {
    const { token, password } = req.body as { token: string; password: string };
    await authService.resetPassword(token, password);
    sendSuccess(res, null, 'Password reset successfully. Please log in with your new password.');
  }

  async verifyEmail(req: Request, res: Response): Promise<void> {
    const { token } = req.params as { token: string };
    if (!token) throw new BadRequestError('Verification token is required');
    await authService.verifyEmail(token);
    sendSuccess(res, null, 'Email verified successfully. You can now log in.');
  }

  async changePassword(req: Request, res: Response): Promise<void> {
    const userId = req.user!.userId;
    const dto = req.body as ChangePasswordDto;
    await authService.changePassword(userId, dto.currentPassword, dto.newPassword);
    sendSuccess(res, null, 'Password changed successfully');
  }

  async getMe(req: Request, res: Response): Promise<void> {
    const userId = req.user!.userId;
    const user = await authService.getMe(userId);
    sendSuccess(res, user, 'User retrieved successfully');
  }

  async resendVerification(req: Request, res: Response): Promise<void> {
    const { email } = req.body as { email: string };
    await authService.resendVerificationEmail(email);
    sendSuccess(res, null, 'If your email is not verified, a new verification email has been sent.');
  }

  // ─── Google OAuth ─────────────────────────────────────────────────────────

  /**
   * GET /auth/google/url
   * Returns the Supabase Google OAuth URL.
   * Frontend redirects the user to this URL to start Google sign-in.
   */
  async getGoogleOAuthUrl(req: Request, res: Response): Promise<void> {
    const redirectTo = req.query.redirectTo as string | undefined;
    const result = await authService.getGoogleOAuthUrl(redirectTo);
    sendSuccess(res, result, 'Google OAuth URL generated');
  }

  /**
   * POST /auth/google/verify
   * Frontend sends the Supabase access_token obtained after Google OAuth.
   * Backend verifies it, finds/creates a user, and returns our own JWT tokens.
   *
   * Body: { supabaseToken: string, role?: 'ATTENDEE' | 'ORGANIZER' }
   */
  async googleVerify(req: Request, res: Response): Promise<void> {
    const dto = req.body as GoogleVerifyDto;

    if (!dto.supabaseToken) {
      throw new BadRequestError('supabaseToken is required');
    }

    const result = await authService.googleAuth(dto);

    // Set refresh token as httpOnly cookie (same as email/password login)
    res.cookie('refreshToken', result.tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    sendSuccess(res, result, 'Google sign-in successful');
  }
}

export default new AuthController();
