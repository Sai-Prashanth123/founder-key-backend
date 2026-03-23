import { Router } from 'express';
import authController from './auth.controller';
import { authenticate } from '@middlewares/authenticate';
import { validate } from '@middlewares/validate';
import { authLimiter } from '@middlewares/rateLimiter';
import {
  registerSchema,
  loginSchema,
  refreshTokenSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
} from './auth.validation';

const router = Router();

/**
 * @openapi
 * /auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Register a new user
 *     security: []
 */
router.post('/register', authLimiter, validate(registerSchema), authController.register.bind(authController));

/**
 * @openapi
 * /auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Login with email and password
 *     security: []
 */
router.post('/login', authLimiter, validate(loginSchema), authController.login.bind(authController));

/**
 * @openapi
 * /auth/refresh-token:
 *   post:
 *     tags: [Auth]
 *     summary: Refresh access token
 *     security: []
 */
router.post('/refresh-token', validate(refreshTokenSchema), authController.refreshToken.bind(authController));

/**
 * @openapi
 * /auth/logout:
 *   post:
 *     tags: [Auth]
 *     summary: Logout user
 */
router.post('/logout', authenticate, authController.logout.bind(authController));

/**
 * @openapi
 * /auth/forgot-password:
 *   post:
 *     tags: [Auth]
 *     summary: Request password reset
 *     security: []
 */
router.post('/forgot-password', authLimiter, validate(forgotPasswordSchema), authController.forgotPassword.bind(authController));

/**
 * @openapi
 * /auth/reset-password:
 *   post:
 *     tags: [Auth]
 *     summary: Reset password with token
 *     security: []
 */
router.post('/reset-password', validate(resetPasswordSchema), authController.resetPassword.bind(authController));

/**
 * @openapi
 * /auth/verify-email/{token}:
 *   get:
 *     tags: [Auth]
 *     summary: Verify email address
 *     security: []
 */
router.get('/verify-email/:token', authController.verifyEmail.bind(authController));

/**
 * @openapi
 * /auth/resend-verification:
 *   post:
 *     tags: [Auth]
 *     summary: Resend verification email
 *     security: []
 */
router.post('/resend-verification', authLimiter, authController.resendVerification.bind(authController));

/**
 * @openapi
 * /auth/change-password:
 *   put:
 *     tags: [Auth]
 *     summary: Change password (authenticated)
 */
router.put('/change-password', authenticate, validate(changePasswordSchema), authController.changePassword.bind(authController));

/**
 * @openapi
 * /auth/me:
 *   get:
 *     tags: [Auth]
 *     summary: Get current authenticated user
 */
router.get('/me', authenticate, authController.getMe.bind(authController));

// ─── Google OAuth (via Supabase) ─────────────────────────────────────────────

/**
 * @openapi
 * /auth/google/url:
 *   get:
 *     tags: [Auth]
 *     summary: Get Google OAuth URL
 *     description: |
 *       Returns the Supabase Google OAuth URL.
 *       The frontend redirects the user to this URL to begin Google sign-in.
 *       After Google auth, Supabase redirects back to your frontend with an access_token.
 *       Then call POST /auth/google/verify with that token.
 *     security: []
 *     parameters:
 *       - in: query
 *         name: redirectTo
 *         schema:
 *           type: string
 *         description: Custom redirect URL after OAuth (defaults to FRONTEND_URL/auth/google/callback)
 */
router.get('/google/url', authLimiter, authController.getGoogleOAuthUrl.bind(authController));

/**
 * @openapi
 * /auth/google/verify:
 *   post:
 *     tags: [Auth]
 *     summary: Verify Supabase Google token and get app JWT
 *     description: |
 *       After Google OAuth on the frontend using Supabase JS client,
 *       send the Supabase access_token here to get our app's JWT tokens.
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - supabaseToken
 *             properties:
 *               supabaseToken:
 *                 type: string
 *                 description: The access_token from Supabase after Google OAuth
 *               role:
 *                 type: string
 *                 enum: [ATTENDEE, ORGANIZER]
 *                 description: Role for new users only (existing users keep their role)
 */
router.post('/google/verify', authLimiter, authController.googleVerify.bind(authController));

export default router;
