import { UserRole, UserTier, TokenPair } from '@appTypes/index';

export interface RegisterDto {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role?: UserRole;
  company?: string;
}

export interface LoginDto {
  email: string;
  password: string;
}

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  tier: UserTier;
  isActive: boolean;
  isEmailVerified: boolean;
  profile: {
    firstName: string;
    lastName: string;
    avatar: string | null;
    company: string | null;
  } | null;
}

export interface ResetPasswordDto {
  token: string;
  password: string;
  confirmPassword: string;
}

export interface ChangePasswordDto {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export interface AuthResponse {
  user: AuthUser;
  tokens: TokenPair;
}

// OAuth types
export interface GoogleVerifyDto {
  supabaseToken: string;
  role?: 'ATTENDEE' | 'ORGANIZER';
}

export interface OAuthUserInfo {
  googleId: string;
  email: string;
  firstName: string;
  lastName: string;
  avatar?: string;
  emailVerified: boolean;
}

export interface GoogleOAuthUrlResponse {
  url: string;
}

export { TokenPair };
